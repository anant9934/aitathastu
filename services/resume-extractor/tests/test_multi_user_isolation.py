"""Automated verification of cross-user document isolation, scoped authorization, and verifier permissions."""
import time
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.auth import sign_user_token

client = TestClient(app)

def test_cross_user_isolation_and_scoping():
    user_a = "person_user_alpha_101"
    user_b = "person_user_bravo_202"

    headers_service_a = {
        "Authorization": f"Bearer {settings.extractor_api_token}",
        "X-User-Id": user_a,
        "X-Org-Id": "org_lpu",
        "X-User-Role": "student"
    }
    headers_service_b = {
        "Authorization": f"Bearer {settings.extractor_api_token}",
        "X-User-Id": user_b,
        "X-User-Role": "student"
    }
    # Verifier privilege comes only from the separate verifier credential,
    # scoped to the verifier's organization.
    headers_verifier = {
        "Authorization": f"Bearer {settings.extractor_verifier_token}",
        "X-User-Id": "person_verifier_staff_999",
        "X-Org-Id": "org_lpu",
    }
    # A regular service-token caller claiming the verifier role in a header.
    headers_forged_verifier = {
        "Authorization": f"Bearer {settings.extractor_api_token}",
        "X-User-Id": "person_attacker_666",
        "X-User-Role": "verifier",
    }
    headers_other_org_verifier = {
        "Authorization": f"Bearer {settings.extractor_verifier_token}",
        "X-User-Id": "person_verifier_other_777",
        "X-Org-Id": "org_other",
    }

    # 1. User A uploads a text resume
    sample_cv = b"RESUME\nAnant Kumar\nEmail: anant@example.com\nEDUCATION\nB.Tech Computer Science\nLPU 2026\nSKILLS\nPython\nReact"
    res_upload = client.post(
        "/api/resumes/upload",
        files={"file": ("resume.txt", sample_cv, "text/plain")},
        headers=headers_service_a
    )
    assert res_upload.status_code == 201
    doc_id = res_upload.json()["document_id"]

    # 2. User B attempts to access User A's document status -> 404 (non-leaky)
    res_b_status = client.get(f"/api/resumes/{doc_id}/status", headers=headers_service_b)
    assert res_b_status.status_code == 404

    # 3. User B attempts to fetch User A's document -> 404
    res_b_doc = client.get(f"/api/resumes/{doc_id}", headers=headers_service_b)
    assert res_b_doc.status_code == 404

    # 4. User B attempts to trigger extraction on User A's document -> 404
    res_b_extract = client.post("/api/resumes/extract", json={"document_id": doc_id}, headers=headers_service_b)
    assert res_b_extract.status_code == 404

    # 5. User B attempts to delete User A's document -> 404
    res_b_del = client.delete(f"/api/resumes/{doc_id}", headers=headers_service_b)
    assert res_b_del.status_code == 404

    # 6. User A triggers extraction -> 202
    res_a_extract = client.post("/api/resumes/extract", json={"document_id": doc_id}, headers=headers_service_a)
    assert res_a_extract.status_code == 202

    # Allow synchronous background task to finish processing
    time.sleep(0.5)

    # 7. User A views their own document -> 200 with completed profile
    res_a_doc = client.get(f"/api/resumes/{doc_id}", headers=headers_service_a)
    assert res_a_doc.status_code == 200
    profile = res_a_doc.json()["profile"]
    assert profile is not None
    assert profile["document_id"] == doc_id

    # 8a. A forged X-User-Role header grants nothing: treated as a plain student -> 404
    assert client.get(f"/api/resumes/{doc_id}", headers=headers_forged_verifier).status_code == 404
    # 8b. A real verifier from a different organization cannot see it -> 404
    assert client.get(f"/api/resumes/{doc_id}", headers=headers_other_org_verifier).status_code == 404

    # 8. Verifier in the same organization CAN view User A's document
    res_ver_doc = client.get(f"/api/resumes/{doc_id}", headers=headers_verifier)
    assert res_ver_doc.status_code == 200

    # 9. Verifier independently verifies an education field
    edu_records = profile["groups"]["education"]
    assert len(edu_records) > 0
    record_id = edu_records[0]["record_id"]

    res_verify = client.post(
        f"/api/resumes/{doc_id}/review",
        json={"group": "education", "record_id": record_id, "field": "qualification", "action": "verify"},
        headers=headers_verifier
    )
    assert res_verify.status_code == 200
    assert res_verify.json()["record"]["fields"]["qualification"]["review_state"] == "independently_verified"

    # 9b. Owner with a forged verifier header cannot self-verify -> 403
    forged_owner = {**headers_service_a, "X-User-Role": "verifier"}
    other_field = next(k for k in edu_records[0]["fields"] if k != "qualification")
    res_forged_verify = client.post(
        f"/api/resumes/{doc_id}/review",
        json={"group": "education", "record_id": record_id, "field": other_field, "action": "verify"},
        headers=forged_owner
    )
    assert res_forged_verify.status_code == 403

    # 10. Student CANNOT overwrite or unverify an independently verified field -> 403
    res_student_overwrite = client.post(
        f"/api/resumes/{doc_id}/review",
        json={"group": "education", "record_id": record_id, "field": "qualification", "action": "correct", "corrected_value": "M.Sc"},
        headers=headers_service_a
    )
    assert res_student_overwrite.status_code == 403

    # 11. Scoped signed token test: token scoped only for 'status' cannot review -> 403
    token_status_only = sign_user_token({
        "sub": user_a,
        "role": "student",
        "act": "status",
        "doc": doc_id,
        "exp": int(time.time()) + 300
    }, settings.extractor_api_token)

    res_scoped_status = client.get(f"/api/resumes/{doc_id}/status", headers={"Authorization": f"Bearer {token_status_only}"})
    assert res_scoped_status.status_code == 200

    res_scoped_review = client.post(
        f"/api/resumes/{doc_id}/review",
        json={"group": "education", "record_id": record_id, "field": "qualification", "action": "accept"},
        headers={"Authorization": f"Bearer {token_status_only}"}
    )
    assert res_scoped_review.status_code == 403

    # 12. Expired signed token -> 401
    token_expired = sign_user_token({
        "sub": user_a,
        "role": "student",
        "act": "*",
        "exp": int(time.time()) - 10
    }, settings.extractor_api_token)
    res_expired = client.get(f"/api/resumes/{doc_id}/status", headers={"Authorization": f"Bearer {token_expired}"})
    assert res_expired.status_code == 401

    # Clean up User A's document
    res_a_del = client.delete(f"/api/resumes/{doc_id}", headers=headers_service_a)
    assert res_a_del.status_code == 204
