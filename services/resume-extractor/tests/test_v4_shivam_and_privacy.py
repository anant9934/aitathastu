"""V4.0 Resume Intelligence Engine Acceptance & Privacy Tests.
Covers:
1. Strict phone number privacy firewall (no phone in structured fields or snippets).
2. Preservation of legitimate non-contact numbers (CGPA, dates, metrics, percentages).
3. Primary acceptance test on Shivam resume fixture.
"""
import os
import pytest
from app.document import read_document
from app.config import settings
from app.extraction.pipeline import extract_profile

SYNTHETIC_PHONE_CV = '''
Candidate With Diverse Contacts
contact@privacy-domain.org | +91 9508108025 | (555) 234-5678 | +1-800-555-0199
Call/WhatsApp: +44 20 7946 0991 | Mobile: 9876543210
Tel: 011-23456789
Location: New Delhi, India
Website: https://candidate-privacy.dev

EDUCATION
Lovely Professional University | 2022 - 2026
B.Tech in Artificial Intelligence | CGPA: 8.93 / 10 | Percentage: 89%

PROJECTS
RevenueScaler
- Led development across 3 distributed microservices, processing 10000+ requests/sec.
- Contributed to 6L+ cumulative revenue with 99.9% uptime.

EXPERIENCE
Alpha Technologies | Jul 2024 - Present
Lead Systems Engineer
- Improved throughput by 45% across 12 node clusters.
'''

def test_zero_phone_extraction_privacy():
    """Verify that phone numbers in any format are NEVER extracted into contact or profile groups."""
    content = read_document(SYNTHETIC_PHONE_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'test-privacy-doc')
    
    # Check contact group
    contact_group = profile.groups.get('contact', [])
    for rec in contact_group:
        assert 'phone' not in rec.fields, f"Prohibited phone field found in contact: {rec.fields}"
        assert 'country_code' not in rec.fields, f"Prohibited country_code found: {rec.fields}"
    
    # Check all fields across all groups for phone numbers
    phone_tokens = ['9508108025', '234-5678', '555-0199', '7946 0991', '9876543210', '23456789']
    for group_name, records in profile.groups.items():
        for rec in records:
            for field_name, fld in rec.fields.items():
                val = fld.value
                for token in phone_tokens:
                    assert token not in val, f"Phone token '{token}' leaked into group '{group_name}', field '{field_name}': {val}"
                for ev in fld.evidence:
                    for token in phone_tokens:
                        assert token not in ev.snippet, f"Phone token '{token}' leaked into snippet of group '{group_name}': {ev.snippet}"

def test_legitimate_numeric_data_preserved():
    """Verify that dates, CGPA, metrics, percentages are never damaged by privacy redaction."""
    content = read_document(SYNTHETIC_PHONE_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'test-numeric-doc')
    
    edu = profile.groups['education'][0]
    assert '8.93' in edu.fields['grade'].value
    assert edu.fields['start_date'].value == '2022'
    
    proj = profile.groups['projects'][0]
    desc = proj.fields['description'].value
    assert '10000+' in desc or '10000' in desc
    assert '6L+' in desc or 'revenue' in desc
    
    exp = profile.groups['experience'][0]
    assert exp.fields['start_date'].value == 'Jul 2024'
    assert exp.fields['end_date'].value == 'Present'

def test_shivam_resume_acceptance():
    """Test primary acceptance criteria on private-fixtures/myresume.pdf if present."""
    fixture_path = 'private-fixtures/myresume.pdf'
    if not os.path.exists(fixture_path):
        pytest.skip("private-fixtures/myresume.pdf not present in test runner")
        
    with open(fixture_path, 'rb') as f:
        pdf_bytes = f.read()
    content = read_document(pdf_bytes, 'pdf', settings)
    profile = extract_profile(content, 'shivam-acceptance-doc')
    
    # A. Identity
    id_records = profile.groups.get('identity', [])
    assert len(id_records) >= 1
    assert 'SHIVAM KUMAR SINGH' in id_records[0].fields['full_name'].value
    
    contact_records = profile.groups.get('contact', [])
    assert any('shiviii5165@gmail.com' in r.fields.get('email', {}).value for r in contact_records)
    for r in contact_records:
        assert 'phone' not in r.fields
        assert 'country_code' not in r.fields
        
    # B. Explicit skills: exactly 27 from skills section
    skills = profile.groups.get('skills', [])
    explicit_skills = [s for s in skills if s.fields.get('sections_found', {}).value == 'skills']
    assert len(explicit_skills) == 27, f"Expected 27 explicit skills, got {len(explicit_skills)}: {[s.fields['canonical_name'].value for s in explicit_skills]}"
    
    explicit_names = {s.fields['canonical_name'].value for s in explicit_skills}
    # Check key skills across all 5 categories
    expected_sample = {
        'Python', 'C', 'JavaScript', 'SQL', 'HTML', 'CSS',
        'React', 'FastAPI', 'Front-End Development', 'Web Development', 'Responsive UI',
        'Artificial Intelligence', 'Machine Learning', 'DBMS', 'Data Modeling',
        'Git', 'GitHub', 'PostgreSQL', 'MongoDB', 'Excel', 'PowerPoint', 'Canva',
        'Mathematics', 'Problem Solving', 'Entrepreneurship', 'Leadership', 'Collaboration'
    }
    assert expected_sample == explicit_names
    
    # C. Projects: exactly 3
    projects = profile.groups.get('projects', [])
    assert len(projects) == 3
    titles = [p.fields['title'].value for p in projects]
    assert any('TeachGenie' in t for t in titles)
    assert any('EduCore' in t for t in titles)
    assert any('Self-Surveillance' in t or 'Surveillance' in t for t in titles)
    
    # D. Professional experience & leadership: exactly 4 roles (not mislabeled as internships)
    exp = profile.groups.get('experience', [])
    assert len(exp) == 4, f"Expected 4 experience roles, got {len(exp)}"
    orgs = [e.fields['organization'].value for e in exp]
    assert any('Nayee Asha' in o for o in orgs)
    assert any('Study LPU' in o for o in orgs)
    assert any('Mangalkit' in o for o in orgs)
    assert any('Founders Verbinden' in o for o in orgs)
    assert len(profile.groups.get('internships', [])) == 0
    
    # E. Certifications: exactly 7
    certs = profile.groups.get('certifications', [])
    assert len(certs) == 7
    cert_issuers = {c.fields.get('issuer', {}).value for c in certs}
    assert 'Infosys' in cert_issuers
    assert 'Simplilearn' in cert_issuers
    assert 'HackerRank' in cert_issuers
    assert 'Oracle' in cert_issuers
    
    # F. Education: exactly 2
    edu = profile.groups.get('education', [])
    assert len(edu) == 2
    edu_insts = [e.fields['institution'].value for e in edu]
    assert any('Lovely Professional University' in inst for inst in edu_insts)
    assert any('Rajkiya Jila' in inst or 'Arrah' in inst for inst in edu_insts)
    
    # G. Achievements: exactly 3
    awards = profile.groups.get('awards', [])
    assert len(awards) == 3
    
    # H. Digital Profiles: 2 (GitHub, LinkedIn)
    dfs = profile.groups.get('digital_footprint', [])
    platforms = {d.fields['platform'].value for d in dfs}
    assert 'LinkedIn' in platforms
    assert 'GitHub' in platforms
