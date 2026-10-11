"""Explicitly invoked retention maintenance job; schedule externally in production."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.store import LocalStore
removed=LocalStore(settings.storage_dir).purge_expired(settings.retention_days)
print(f'Expired private documents deleted: {removed}')
