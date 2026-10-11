from __future__ import annotations
from io import BytesIO
from pathlib import Path
import zipfile
import fitz
from PIL import Image, UnidentifiedImageError

ACCEPTED = {'.pdf': 'pdf','.docx':'docx','.txt':'txt','.rtf':'rtf','.jpg':'jpg','.jpeg':'jpeg','.png':'png'}
class IngestionError(ValueError): pass

def validate_upload(filename: str, data: bytes, max_mb: int, max_pages: int) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ACCEPTED: raise IngestionError('Unsupported format. Upload PDF, DOCX, TXT, RTF, JPG, JPEG or PNG.')
    if not data: raise IngestionError('The document is empty.')
    if len(data) > max_mb*1024*1024: raise IngestionError(f'Maximum upload size: {max_mb} MB.')
    typ = ACCEPTED[suffix]
    if typ=='pdf':
        if not data.startswith(b'%PDF-'): raise IngestionError('The PDF signature does not match its extension.')
        try:
            with fitz.open(stream=data,filetype='pdf') as doc:
                if doc.needs_pass: raise IngestionError('Encrypted PDFs are not supported.')
                if doc.page_count > max_pages: raise IngestionError(f'PDF exceeds {max_pages} pages.')
                if doc.page_count==0: raise IngestionError('PDF has no pages.')
        except IngestionError: raise
        except Exception: raise IngestionError('Invalid or corrupt PDF.') from None
    elif typ=='docx':
        if not data.startswith(b'PK\x03\x04'): raise IngestionError('DOCX must be an Office ZIP document.')
        try:
            with zipfile.ZipFile(BytesIO(data)) as z:
                names = set(z.namelist())
                if 'word/document.xml' not in names or '[Content_Types].xml' not in names:
                    raise IngestionError('Invalid DOCX structure.')
                if len(names)>1500 or sum(x.file_size for x in z.infolist())>100*1024*1024:
                    raise IngestionError('DOCX decompression limits exceeded.')
                if any(x.filename.startswith('/') or '..' in Path(x.filename).parts for x in z.infolist()):
                    raise IngestionError('Unsafe DOCX archive.')
        except (zipfile.BadZipFile,RuntimeError): raise IngestionError('Corrupt DOCX archive.') from None
    elif typ in ('jpg','jpeg','png'):
        if typ=='png' and not data.startswith(b'\x89PNG\r\n\x1a\n'): raise IngestionError('Invalid PNG signature.')
        if typ in ('jpg','jpeg') and not data.startswith(b'\xff\xd8\xff'): raise IngestionError('Invalid JPEG signature.')
        try:
            with Image.open(BytesIO(data)) as im:
                im.verify()
            with Image.open(BytesIO(data)) as im:
                if im.width*im.height>30_000_000: raise IngestionError('Image resolution is too large.')
        except (UnidentifiedImageError,OSError,ValueError) as e:
            if isinstance(e, IngestionError): raise
            raise IngestionError('Invalid or corrupt image.') from None
    elif typ=='rtf':
        if not data.lstrip().startswith(b'{\\rtf'): raise IngestionError('Invalid RTF signature.')
    else:
        if b'\x00' in data[:2048]: raise IngestionError('TXT appears to be binary data.')
        try: data.decode('utf-8-sig')
        except UnicodeDecodeError:
            try: data.decode('cp1252')
            except UnicodeDecodeError: raise IngestionError('Unsupported text encoding.')
    return typ
