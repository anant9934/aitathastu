"""AI Tathastu Universal Resume Extractor API. Production multi-user scoped authorization and document isolation."""
from __future__ import annotations
import json, os, secrets, time, uuid
from datetime import datetime, timezone
from dataclasses import asdict
from typing import Annotated
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .schema import (ResumeProfile, UploadResponse, ExtractionRequest, ReviewRequest, ReviewState, ReviewEvent, StatusResponse, SectionPreview, DocumentView, GROUP_FIELDS)
from .ingest import validate_upload, IngestionError
from .document import read_document
from .extraction.pipeline import extract_profile
from .store import LocalStore
from .auth import UserContext, get_current_user, authorize_action, check_document_access

app = FastAPI(
    title='AI Tathastu Universal Resume Extractor',
    version='2.0.0',
    description='Deterministic, evidence-linked resume extraction. Multi-user document isolation and auditable review.'
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'DELETE', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type', 'X-User-Id', 'X-User-Role', 'X-Org-Id', 'X-Auth-Scope']
)

store = LocalStore(settings.storage_dir)

def meta_for(docid: str, user: UserContext) -> dict:
    try:
        meta = store.get_meta(docid)
        check_document_access(meta, user, docid)
        return meta
    except (KeyError, ValueError):
        raise HTTPException(404, 'Document not found') from None

def valid_profile(docid: str, user: UserContext) -> ResumeProfile:
    meta_for(docid, user)
    try:
        return ResumeProfile.model_validate(store.read_json(docid, 'profile.json'))
    except KeyError:
        raise HTTPException(409, 'No extraction result yet') from None

def processing(docid: str):
    # State changes represent real work, never synthetic percentages.
    try:
        # Use background internal access to read document for extraction
        meta = store.get_meta(docid)
        if meta['status'] not in ('queued', 'uploaded'):
            return
        store.update_meta(docid, {'status': 'processing'})
        began = time.perf_counter()
        payload = store.document_path(docid).read_bytes()
        content = read_document(payload, meta['format'], settings)
        profile = extract_profile(content, docid, began)
        store.save_json(docid, 'sections.json', [asdict(l) for l in content.lines])
        store.save_json(docid, 'profile.json', profile.model_dump(mode='json'))
        store.update_meta(docid, {'status': profile.metadata.status, 'warnings': profile.metadata.warnings})
    except Exception as e:
        # Exclude document contents and filesystem paths from logs/API responses.
        store.update_meta(docid, {
            'status': 'failed',
            'warnings': [f'Processing error: {type(e).__name__}. Please retry or use another file.']
        })

@app.get('/health')
def health():
    import sys
    try:
        import pytesseract
        ocr_ver = str(pytesseract.get_tesseract_version())
    except Exception:
        ocr_ver = "unavailable"
    return {
        'status': 'ok',
        'schema_version': '2.0',
        'python_version': sys.version.split()[0],
        'tesseract_version': ocr_ver,
        'git_commit': os.environ.get('RENDER_GIT_COMMIT', 'unknown')[:12]
    }

@app.post('/api/resumes/upload', response_model=UploadResponse, status_code=201)
async def upload(
    file: Annotated[UploadFile, File()],
    user: UserContext = Depends(authorize_action('upload'))
):
    original = (file.filename or 'resume').replace('\\', '/').split('/')[-1][:120]
    payload = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    try:
        fmt = validate_upload(original, payload, settings.max_upload_mb, settings.max_pages)
        allowed_mime = {
            'pdf': {'application/pdf'},
            'docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'},
            'txt': {'text/plain'},
            'rtf': {'application/rtf', 'text/rtf', 'application/x-rtf'},
            'png': {'image/png'},
            'jpg': {'image/jpeg'},
            'jpeg': {'image/jpeg'},
        }
        submitted_mime = (file.content_type or '').lower().split(';')[0].strip()
        if submitted_mime and submitted_mime not in ('application/octet-stream', 'binary/octet-stream') and submitted_mime not in allowed_mime[fmt]:
            raise IngestionError('Declared MIME type does not match document format.')
    except IngestionError as e:
        raise HTTPException(400, str(e)) from None

    docid = str(uuid.uuid4())
    store.create(
        docid,
        original,
        payload,
        {
            'document_id': docid,
            'filename': original,
            'owner_id': user.user_id,
            'org_id': user.org_id,
            'format': fmt,
            'status': 'uploaded',
            'warnings': [],
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    )
    return UploadResponse(document_id=docid, filename=original, status='uploaded', max_pages=settings.max_pages)

@app.post('/api/resumes/extract', response_model=StatusResponse, status_code=202)
def extract(
    request: ExtractionRequest,
    tasks: BackgroundTasks,
    user: UserContext = Depends(authorize_action('extract'))
):
    meta = meta_for(request.document_id, user)
    if meta['status'] in ('queued', 'processing'):
        return StatusResponse(document_id=request.document_id, status=meta['status'], warnings=meta.get('warnings', []))
    if meta['status'] in ('completed', 'partial'):
        return StatusResponse(document_id=request.document_id, status=meta['status'], warnings=meta.get('warnings', []))

    store.update_meta(request.document_id, {'status': 'queued', 'warnings': []})
    tasks.add_task(processing, request.document_id)
    return StatusResponse(document_id=request.document_id, status='queued')


@app.post('/api/resumes/upload-and-extract', status_code=200)
async def upload_and_extract(
    file: Annotated[UploadFile, File()],
    user: UserContext = Depends(authorize_action('upload'))
):
    """Synchronous single-request upload + extract. Returns the full profile in one call.
    Used by Vercel onboarding flow to bypass Vercel serverless OCR limitations.
    Extraction runs synchronously (max settings.max_processing_seconds).
    """
    original = (file.filename or 'resume').replace('\\', '/').split('/')[-1][:120]
    payload = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)

    try:
        fmt = validate_upload(original, payload, settings.max_upload_mb, settings.max_pages)
    except IngestionError as e:
        raise HTTPException(400, str(e)) from None

    docid = str(uuid.uuid4())
    store.create(
        docid,
        original,
        payload,
        {
            'document_id': docid,
            'filename': original,
            'owner_id': user.user_id,
            'org_id': user.org_id,
            'format': fmt,
            'status': 'uploaded',
            'warnings': [],
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    )

    # Run extraction synchronously (Render has Tesseract; this is safe outside serverless)
    try:
        store.update_meta(docid, {'status': 'processing'})
        began = time.perf_counter()
        content = read_document(payload, fmt, settings)
        profile = extract_profile(content, docid, began)
        store.save_json(docid, 'sections.json', [asdict(l) for l in content.lines])
        store.save_json(docid, 'profile.json', profile.model_dump(mode='json'))
        store.update_meta(docid, {'status': profile.metadata.status, 'warnings': profile.metadata.warnings})
    except Exception as e:
        store.update_meta(docid, {
            'status': 'failed',
            'warnings': [f'Processing error: {type(e).__name__}. Please retry or use another file.']
        })
        raise HTTPException(422, f'Extraction failed: {type(e).__name__}') from None

    try:
        profile_data = ResumeProfile.model_validate(store.read_json(docid, 'profile.json'))
    except (KeyError, Exception):
        raise HTTPException(409, 'Extraction completed but profile could not be read') from None

    raw_text = '\n'.join(
        line.text for line in content.lines if line.text and line.text.strip()
    ) if content.lines else ''

    return JSONResponse({
        'ok': True,
        'document_id': docid,
        'status': profile_data.metadata.status,
        'profile': profile_data.model_dump(mode='json'),
        'raw_text': raw_text[:50000],  # cap to 50k chars for network efficiency
        'warnings': profile_data.metadata.warnings,
        'ocr_used': profile_data.metadata.ocr_used,
        'processing_seconds': profile_data.metadata.processing_seconds,
    })


@app.get('/api/resumes/{document_id}/status', response_model=StatusResponse)
def status(
    document_id: str,
    user: UserContext = Depends(authorize_action('status'))
):
    m = meta_for(document_id, user)
    return StatusResponse(document_id=document_id, status=m['status'], warnings=m.get('warnings', []))

@app.get('/api/resumes/{document_id}', response_model=DocumentView)
def get_document(
    document_id: str,
    user: UserContext = Depends(authorize_action('view'))
):
    st = status(document_id, user)
    try:
        result = valid_profile(document_id, user)
    except HTTPException:
        result = None
    return DocumentView(profile=result, status=st)

@app.get('/api/resumes/{document_id}/sections', response_model=list[SectionPreview])
def sections(
    document_id: str,
    user: UserContext = Depends(authorize_action('view'))
):
    meta_for(document_id, user)
    try:
        lines = store.read_json(document_id, 'sections.json')
    except KeyError:
        raise HTTPException(409, 'Not processed') from None
    return [SectionPreview(section=l['section'], page=l['page'], text=l['text'][:6000]) for l in lines]

@app.post('/api/resumes/{document_id}/review')
def review(
    document_id: str,
    action: ReviewRequest,
    user: UserContext = Depends(authorize_action('review'))
):
    profile = valid_profile(document_id, user)
    if action.group not in GROUP_FIELDS:
        raise HTTPException(400, 'Invalid information group')
    row = next((r for r in profile.groups[action.group] if r.record_id == action.record_id), None)
    if row is None:
        raise HTTPException(404, 'Record not found')
    if action.field is None:
        if action.action != 'reject':
            raise HTTPException(400, 'Record-level review supports reject only')
        row.record_state = ReviewState.rejected
    else:
        item = row.fields.get(action.field)
        if item is None:
            raise HTTPException(404, 'Field not found')
        if item.review_state == ReviewState.independently_verified and user.role != 'verifier':
            raise HTTPException(403, 'Verified fields require verifier authorization')
        if action.action == 'verify' and user.role != 'verifier':
            raise HTTPException(403, 'Independent verification requires a separate verifier token')
        if action.action == 'correct' and (action.corrected_value is None or not action.corrected_value.strip()):
            raise HTTPException(400, 'A corrected value is required')

        new_state = {
            'accept': ReviewState.reviewed,
            'correct': ReviewState.reviewed,
            'reject': ReviewState.rejected,
            'uncertain': ReviewState.uncertain,
            'confirm': ReviewState.student_confirmed,
            'verify': ReviewState.independently_verified
        }[action.action]

        previous = item.value
        item.history.append(ReviewEvent(
            action=action.action,
            actor=user.role,
            timestamp=datetime.now(timezone.utc),
            previous_value=previous,
            new_value=action.corrected_value.strip() if action.action == 'correct' else None,
            previous_state=item.review_state
        ))
        if action.action == 'correct':
            item.value = action.corrected_value.strip()
        item.review_state = new_state

    profile.metadata.reviewed_at = datetime.now(timezone.utc)
    store.save_json(document_id, 'profile.json', profile.model_dump(mode='json'))
    return {'ok': True, 'record': row.model_dump(mode='json')}

@app.get('/api/resumes/{document_id}/export')
def export(
    document_id: str,
    format: str = Query('json', pattern='^(json|summary)$'),
    user: UserContext = Depends(authorize_action('export'))
):
    profile = valid_profile(document_id, user)
    if format == 'json':
        return JSONResponse(
            profile.model_dump(mode='json'),
            headers={
                'Content-Disposition': f'attachment; filename="resume-{document_id}.json"',
                'Cache-Control': 'no-store'
            }
        )

    parts = [
        f'AI Tathastu Resume Extraction — {document_id}',
        f'Schema: {profile.schema_version}',
        f'Status: {profile.metadata.status}',
        ''
    ]
    for group, records in profile.groups.items():
        if group == 'extraction_metadata':
            continue
        parts.append(group.replace('_', ' ').title())
        if not records:
            parts.append('  Not present in extracted document')
        for rec in records:
            if rec.record_state == ReviewState.rejected:
                continue
            for key, f in rec.fields.items():
                parts.append(f'  {key.replace("_", " ")}: {f.value} [{f.review_state.value}; heuristic {f.confidence:.2f}]')
        parts.append('')
    return PlainTextResponse(
        '\n'.join(parts),
        headers={
            'Content-Disposition': f'attachment; filename="resume-{document_id}.txt"',
            'Cache-Control': 'no-store'
        }
    )

@app.post('/api/resumes/{document_id}/retry', response_model=StatusResponse, status_code=202)
def retry(
    document_id: str,
    tasks: BackgroundTasks,
    user: UserContext = Depends(authorize_action('retry'))
):
    m = meta_for(document_id, user)
    if m['status'] in ('queued', 'processing'):
        raise HTTPException(409, 'Document already processing')
    store.update_meta(document_id, {'status': 'queued', 'warnings': []})
    tasks.add_task(processing, document_id)
    return StatusResponse(document_id=document_id, status='queued')

@app.delete('/api/resumes/{document_id}', status_code=204)
def delete(
    document_id: str,
    user: UserContext = Depends(authorize_action('delete'))
):
    m = meta_for(document_id, user)
    if m['status'] in ('queued', 'processing'):
        raise HTTPException(409, 'Cannot delete while processing')
    store.delete(document_id)
    return None
