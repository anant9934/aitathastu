"""A missing OCR engine must fail the job with a distinct error code, not 'no text'."""
import time
import pytesseract


def test_missing_tesseract_reports_engine_unavailable(client, auth, ocr_png, monkeypatch):
    monkeypatch.setattr(pytesseract.pytesseract, 'tesseract_cmd', 'definitely-not-tesseract-binary')
    up = client.post('/api/resumes/upload', files={'file': ('scan.png', ocr_png, 'image/png')}, headers=auth)
    assert up.status_code == 201
    did = up.json()['document_id']
    assert client.post('/api/resumes/extract', json={'document_id': did}, headers=auth).status_code == 202
    for _ in range(20):
        st = client.get(f'/api/resumes/{did}/status', headers=auth).json()
        if st['status'] in ('failed', 'completed', 'partial'):
            break
        time.sleep(0.1)
    assert st['status'] == 'failed'
    assert st['error_code'] == 'OCR_ENGINE_UNAVAILABLE'


def test_text_endpoint_returns_extracted_lines(client, auth, pdf):
    up = client.post('/api/resumes/upload', files={'file': ('cv.pdf', pdf, 'application/pdf')}, headers=auth)
    did = up.json()['document_id']
    client.post('/api/resumes/extract', json={'document_id': did}, headers=auth)
    for _ in range(20):
        if client.get(f'/api/resumes/{did}/status', headers=auth).json()['status'] in ('completed', 'partial'):
            break
        time.sleep(0.1)
    body = client.get(f'/api/resumes/{did}/text', headers=auth).json()
    assert 'Ananya Sharma' in body['raw_text']
    assert body['ocr_used'] is False
