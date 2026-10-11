"""Exercising all declared groups and security-negative upload cases."""
from io import BytesIO
import fitz
from app.document import read_document
from app.extraction.pipeline import extract_profile
from app.schema import GROUP_FIELDS,ResumeProfile
from app.config import settings

EXTENDED = '''
Asha Mehta
AI Engineer
asha@example.com
https://github.com/asha/research
SUMMARY
Machine learning graduate interested in responsible AI.
EDUCATION
B.Tech Computer Science | Test University | 2022 - 2026 | CGPA: 9.1/10
WORK EXPERIENCE
Data Engineer | DataLab | 2025 - 2026
- Built a forecasting pipeline using Python and SQL with 40% faster response.
INTERNSHIPS
ML Intern | ABC Lab | 2024
- Implemented PyTorch classification with 3 months of experience.
TECHNICAL SKILLS
Python, JavaScript, PyTorch, PostgreSQL, Docker
PROJECTS
Weather Forecasting | Python
- Developed a prediction model.
AWARDS
Regional Hackathon Winner 2025
CERTIFICATIONS
AWS Machine Learning Certificate 2025
RESEARCH
AI Fairness Paper, preprint, DOI: 10.1234/dataset123 2025
BOOKS AND PATENTS
Patent application filed for Context Restoration 2026
LEADERSHIP
President of AI Club 2025
'''

def test_all_fifteen_groups_represented():
    content=read_document(EXTENDED.encode(),'txt',settings)
    p=extract_profile(content,'all-groups')
    assert set(p.groups)==set(GROUP_FIELDS)
    assert all(p.groups[name] for name in GROUP_FIELDS)
    assert all(f.original_value for records in p.groups.values() for r in records for f in r.fields.values())
    assert 'Patent application' in p.groups['books_patents'][0].fields['title'].value
    assert p.groups['books_patents'][0].fields['status'].review_state.value=='extracted'

def test_no_email_domain_as_profile_link():
    text=b'Asha Mehta\nasha@example.com\nSKILLS\nPython'
    p=extract_profile(read_document(text,'txt',settings),'email-not-link')
    assert not p.groups['digital_footprint']

def test_rtf_parsed_without_execution():
    b=b'{\\rtf1\\ansi Asha Mehta\\par EDUCATION\\par B.Tech Computer Science\\par SKILLS\\par Python}'
    p=extract_profile(read_document(b,'rtf',settings),'rtf')
    assert p.groups['education']
    assert p.groups['skills']

def test_encrypted_pdf_rejected(client,auth):
    pdf=fitz.open();page=pdf.new_page();page.insert_text((50,50),'Confidential Resume')
    data=pdf.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256,user_pw='secret',owner_pw='owner')
    r=client.post('/api/resumes/upload',headers=auth,files={'file':('secret.pdf',data)})
    assert r.status_code==400
    assert 'Encrypted' in r.text

def test_missing_record_returns_non_leaky_error(client,auth):
    import uuid
    docid=str(uuid.uuid4())
    r=client.get(f'/api/resumes/{docid}',headers=auth)
    assert r.status_code==404
    assert '/mnt/' not in r.text

def test_reject_record_preserves_original(client,auth):
    up=client.post('/api/resumes/upload',headers=auth,files={'file':('a.txt',b'Asha Mehta\nSKILLS\nPython')})
    docid=up.json()['document_id']
    client.post('/api/resumes/extract',headers=auth,json={'document_id':docid})
    record=client.get(f'/api/resumes/{docid}',headers=auth).json()['profile']['groups']['skills'][0]
    r=client.post(f'/api/resumes/{docid}/review',headers=auth,json={'group':'skills','record_id':record['record_id'],'action':'reject'})
    assert r.status_code==200
    assert r.json()['record']['record_state']=='rejected'

def test_declared_mime_mismatch_rejected(client,auth):
    r=client.post('/api/resumes/upload',headers=auth,files={'file':('r.txt',b'Asha Mehta','application/pdf')})
    assert r.status_code==400
    assert 'MIME' in r.text

def test_path_traversal_document_id_refused(client,auth):
    for docid in ('..%2F..%2Fetc%2Fpasswd','not-a-uuid'):
        r=client.get(f'/api/resumes/{docid}',headers=auth)
        assert r.status_code in (400,404)
        assert 'traceback' not in r.text.lower()
