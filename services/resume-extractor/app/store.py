"""Atomic, private single-tenant local repository. Designed for a future DB/object-storage adapter."""
from __future__ import annotations
import json, os, secrets, shutil, tempfile, threading, time
from pathlib import Path
from typing import Protocol

class Storage(Protocol):
    def create(self, document_id: str, filename: str, payload: bytes, metadata: dict): ...
    def get_meta(self, document_id: str) -> dict: ...
    def update_meta(self, document_id: str, changes: dict) -> dict: ...
    def save_json(self, document_id: str, name: str, data: dict | list): ...
    def read_json(self, document_id: str, name: str) -> dict | list: ...
    def document_path(self, document_id: str) -> Path: ...
    def delete(self, document_id: str): ...

class LocalStore:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True,exist_ok=True)
        os.chmod(self.root,0o700)
        self.lock = threading.RLock()

    def _directory(self, document_id: str) -> Path:
        import uuid
        try:
            canonical = str(uuid.UUID(document_id))
        except (TypeError, ValueError):
            raise KeyError('Document not found')
        if canonical != document_id:
            raise KeyError('Document not found')
        return self.root / canonical

    @staticmethod
    def _atomic(path: Path, data: bytes):
        fd, temp = tempfile.mkstemp(prefix='.tmp-', dir=path.parent)
        try:
            with os.fdopen(fd, 'wb') as f:
                os.fchmod(f.fileno(),0o600)
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp,path)
        finally:
            if os.path.exists(temp): os.unlink(temp)

    def create(self, document_id: str, filename: str, payload: bytes, metadata: dict):
        with self.lock:
            folder = self._directory(document_id)
            folder.mkdir(mode=0o700,exist_ok=False)
            self._atomic(folder/'original', payload)
            self.save_json(document_id,'meta.json',metadata)

    def document_path(self, document_id: str) -> Path:
        folder = self._directory(document_id)
        path = folder/'original'
        if not path.is_file() or path.is_symlink(): raise KeyError('Document not found')
        return path

    def read_json(self, document_id: str, name: str):
        if name not in ('meta.json','profile.json','sections.json'): raise KeyError('Invalid resource')
        path = self._directory(document_id) / name
        if not path.is_file() or path.is_symlink(): raise KeyError('Document not found')
        return json.loads(path.read_text('utf-8'))

    def save_json(self, document_id: str, name: str, data):
        if name not in ('meta.json','profile.json','sections.json'): raise KeyError('Invalid resource')
        with self.lock:
            path = self._directory(document_id)/name
            self._atomic(path,json.dumps(data,ensure_ascii=False,default=str).encode('utf-8'))

    def get_meta(self, document_id: str) -> dict:
        return self.read_json(document_id,'meta.json')

    def update_meta(self, document_id: str, changes: dict) -> dict:
        with self.lock:
            meta = self.get_meta(document_id)
            meta.update(changes)
            self.save_json(document_id,'meta.json',meta)
            return meta

    def delete(self, document_id: str):
        with self.lock:
            folder = self._directory(document_id)
            if not folder.exists(): raise KeyError('Document not found')
            if folder.is_symlink(): raise KeyError('Document not found')
            shutil.rmtree(folder)

    def purge_expired(self, days: int) -> int:
        cutoff = time.time() - days*86400
        count = 0
        for child in self.root.iterdir():
            try:
                self._directory(child.name)
                if child.is_dir() and not child.is_symlink() and child.stat().st_mtime < cutoff:
                    self.delete(child.name)
                    count += 1
            except (KeyError,OSError): continue
        return count
