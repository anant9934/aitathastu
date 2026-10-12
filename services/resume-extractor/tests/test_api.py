from io import BytesIO
import json
import pytest
from app.schema import ResumeProfile,GROUP_FIELDS


def upload(client,auth,filename,data):
    r=client.post('/api/resumes/upload',files={'file':(filename,data)},headers=auth)
    assert r.status_code==201,r.text
    return r.json()['document_id']

def run(client,auth,docid):
    r=client.post('/api/resumes/extract',json={'document_id':docid},headers=auth)
    assert r.status_code==202,r.text
    d=client.get(f'/api/resumes/{docid}',headers=auth)
    assert d.status_code==200
    assert d.json()['profile'] is not None, d.text
    return ResumeProfile.model_validate(d.json()['profile'])

def test_health_and_auth(client,pdf,monkeypatch):
    monkeypatch.setenv('RENDER_GIT_COMMIT', 'a' * 40)
    health=client.get('/health')
    assert health.status_code==200
    assert health.json()['git_commit']=='a' * 12
    assert client.post('/api/resumes/upload',files={'file':('a.pdf',pdf)}).status_code==401
    assert client.post('/api/resumes/upload',files={'file':('a.pdf',pdf)},headers={'Authorization':'Bearer invalid'}).status_code==401

def test_pdf_end_to_end(client,auth,pdf):
    docid=upload(client,auth,'resume.pdf',pdf)
    profile=run(client,auth,docid)
    assert set(profile.groups)==set(GROUP_FIELDS)
    assert profile.schema_version=='2.0'
    assert profile.metadata.ocr_used is False
    assert any(f.value=='ananya.sharma@example.com' for r in profile.groups['contact'] for f in r.fields.values())
    assert len(profile.groups['education'])==3
    assert len(profile.groups['projects'])>=1
    assert profile.groups['skills']
    assert any(r.fields.get('platform') and r.fields['platform'].value=='GitHub' for r in profile.groups['digital_footprint'])
    assert all(f.evidence for name,rows in profile.groups.items() if name!='extraction_metadata' for row in rows for f in row.fields.values())
    assert client.get(f'/api/resumes/{docid}/sections',headers=auth).status_code==200
    assert client.get(f'/api/resumes/{docid}/export?format=json',headers=auth).json()['schema_version']=='2.0'
    assert 'Education' in client.get(f'/api/resumes/{docid}/export?format=summary',headers=auth).text

def test_review_correction_history_and_permissions(client,auth):
    did=upload(client,auth,'r.txt',b'Ananya Sharma\nananya@example.com\nSKILLS\nPython, SQL')
    p=run(client,auth,did)
    record=p.groups['identity'][0]
    field='full_name'
    base={'group':'identity','record_id':record.record_id,'field':field}
    r=client.post(f'/api/resumes/{did}/review',json={**base,'action':'correct','corrected_value':'Ananya S. Sharma'},headers=auth)
    assert r.status_code==200,r.text
    f=r.json()['record']['fields'][field]
    assert f['value']=='Ananya S. Sharma'
    assert f['original_value']=='Ananya Sharma'
    assert f['history'][0]['previous_value']=='Ananya Sharma'
    assert client.post(f'/api/resumes/{did}/review',json={**base,'action':'verify'},headers=auth).status_code==403
    verifier={'Authorization':'Bearer test-verified-token-only'}
    r=client.post(f'/api/resumes/{did}/review',json={**base,'action':'verify'},headers=verifier)
    assert r.status_code==200
    assert r.json()['record']['fields'][field]['review_state']=='independently_verified'
    assert client.post(f'/api/resumes/{did}/review',json={**base,'action':'correct','corrected_value':'X'},headers=auth).status_code==403

def test_docx_and_txt(client,auth,docx_file,sample):
    p=run(client,auth,upload(client,auth,'resume.docx',docx_file))
    assert p.groups['education'] and p.groups['skills']
    txt=run(client,auth,upload(client,auth,'resume.txt',sample.encode()))
    assert txt.metadata.file_format=='txt'
    assert txt.groups['identity']

def test_ocr_image(client,auth,ocr_png):
    p=run(client,auth,upload(client,auth,'scan.png',ocr_png))
    assert p.metadata.ocr_attempted is True
    if p.metadata.ocr_used:assert 'ocr' in p.metadata.extraction_methods

def test_invalid_files(client,auth):
    for name,data in [('a.pdf',b'not a pdf'),('a.docx',b'PK\x03\x04bad'),('a.png',b'bad'),('a.html',b'<script />'),('a.txt',b'\x00\x03\x00')]:
        r=client.post('/api/resumes/upload',headers=auth,files={'file':(name,data)})
        assert r.status_code==400,(name,r.text)

def test_delete_and_unknown_id(client,auth):
    did=upload(client,auth,'a.txt',b'Ananya Sharma\nEDUCATION\nB.Tech')
    assert client.delete(f'/api/resumes/{did}',headers=auth).status_code==204
    assert client.get(f'/api/resumes/{did}',headers=auth).status_code==404
    assert client.get('/api/resumes/../status',headers=auth).status_code!=200

def test_ambiguous_values_not_fabricated(client,auth):
    p=run(client,auth,upload(client,auth,'missing.txt',b'TECHNICAL SKILLS\nPython, Git\n'))
    assert not p.groups['education']
    assert not p.groups['awards']
    assert not p.groups['research']
    assert not p.groups['identity']
