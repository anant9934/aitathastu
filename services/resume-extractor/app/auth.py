"""Production multi-user authentication, document ownership, and signed token authorization."""
from __future__ import annotations
import base64, hmac, hashlib, json, secrets, time
from dataclasses import dataclass
from typing import Annotated, Literal
from fastapi import Header, HTTPException, Depends
from .config import settings

@dataclass
class UserContext:
    user_id: str
    role: Literal['student', 'verifier', 'admin']
    org_id: str | None = None
    scope: str = '*'
    scoped_doc_id: str | None = None

def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def _b64decode(s: str) -> bytes:
    padding = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + padding).encode('ascii'))

def sign_user_token(payload: dict, secret: str) -> str:
    serialized = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
    payload_b64 = _b64encode(serialized)
    sig = hmac.new(secret.encode('utf-8'), payload_b64.encode('ascii'), hashlib.sha256).digest()
    sig_b64 = _b64encode(sig)
    return f"u.{payload_b64}.{sig_b64}"

def verify_user_token(token: str, secret: str) -> dict | None:
    parts = token.split('.')
    if len(parts) != 3 or parts[0] != 'u':
        return None
    payload_b64, sig_b64 = parts[1], parts[2]
    expected_sig = hmac.new(secret.encode('utf-8'), payload_b64.encode('ascii'), hashlib.sha256).digest()
    try:
        actual_sig = _b64decode(sig_b64)
    except Exception:
        return None
    if not secrets.compare_digest(expected_sig, actual_sig):
        return None
    try:
        payload = json.loads(_b64decode(payload_b64).decode('utf-8'))
    except Exception:
        return None
    # Check expiry if present
    if 'exp' in payload and payload['exp'] < int(time.time()):
        return None
    return payload

def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
    x_user_role: Annotated[str | None, Header()] = None,
    x_org_id: Annotated[str | None, Header()] = None,
    x_auth_scope: Annotated[str | None, Header()] = None,
) -> UserContext:
    supplied = authorization.removeprefix('Bearer ').strip() if authorization else ''
    if not supplied:
        raise HTTPException(401, 'Authentication required')

    # Case 1: Signed short-lived client user token (e.g. for direct-to-Render uploads)
    if supplied.startswith('u.'):
        payload = verify_user_token(supplied, settings.extractor_api_token)
        if not payload:
            raise HTTPException(401, 'Invalid or expired user authorization token')
        sub = str(payload.get('sub', '')).strip()
        if not sub:
            raise HTTPException(401, 'Token missing valid user subject')
        role = payload.get('role', 'student')
        if role not in ('student', 'verifier', 'admin'):
            role = 'student'
        return UserContext(
            user_id=sub,
            role=role,
            org_id=payload.get('org'),
            scope=payload.get('act', '*'),
            scoped_doc_id=payload.get('doc')
        )

    # Case 2: Service-to-service bearer token with explicit user context headers
    is_service_token = secrets.compare_digest(supplied, settings.extractor_api_token)
    is_verifier_token = bool(settings.extractor_verifier_token and secrets.compare_digest(supplied, settings.extractor_verifier_token))

    if not is_service_token and not is_verifier_token:
        raise HTTPException(401, 'Invalid access token')

    # Determine user ID: from X-User-Id header (trusted service call), or default to single-tenant owner for tests
    effective_user_id = (x_user_id or '').strip() or settings.extractor_owner_id
    effective_role = 'verifier' if is_verifier_token else (x_user_role if x_user_role in ('verifier', 'admin') else 'student')
    effective_scope = (x_auth_scope or '*').strip() or '*'

    return UserContext(
        user_id=effective_user_id,
        role=effective_role,
        org_id=(x_org_id or '').strip() or None,
        scope=effective_scope
    )

def authorize_action(action: str):
    def dependency(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.scope != '*' and user.scope != action:
            raise HTTPException(403, f"Token scope '{user.scope}' does not permit '{action}'")
        return user
    return dependency

def check_document_access(meta: dict, user: UserContext, doc_id: str) -> None:
    # If token is restricted to a specific document ID, enforce it
    if user.scoped_doc_id and user.scoped_doc_id != doc_id:
        raise HTTPException(403, 'Token not authorized for this document')

    # Verifiers and admins can inspect all documents in their scope
    if user.role in ('verifier', 'admin'):
        if user.org_id and meta.get('org_id') and user.org_id != meta.get('org_id'):
            raise HTTPException(404, 'Document not found')
        return

    # Regular students: strictly isolated to their own documents
    doc_owner = meta.get('owner_id')
    if not doc_owner or doc_owner != user.user_id:
        # 404 prevents document enumeration across users
        raise HTTPException(404, 'Document not found')
