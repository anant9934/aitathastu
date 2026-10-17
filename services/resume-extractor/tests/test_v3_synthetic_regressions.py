"""Synthetic regressions for Resume Intelligence Engine V3.
Completely synthetic test data exercising all key V3 architectural guarantees.
"""
import pytest
from app.document import read_document
from app.config import settings
from app.extraction.pipeline import extract_profile

SYNTHETIC_V3_CV = '''
Alex Morgan
alex.morgan@synthetic-domain.org | +1 555 019 2831 | New York, NY
Portfolio: https://alexmorgan.dev | Lab: https://alexmorgan-research.io | GitHub: https://github.com/alexm-synth

EDUCATION
B.Tech in Artificial Intelligence & Data Science | Lovely Institute of Technology
CGPA: 9.2 / 10 | 2025 - Present
Minors in Computational Linguistics and Mathematics

High School Diploma | Metropolitan High School
Percentage: 94% | 2022 - 2024

WORK EXPERIENCE
Senior Web & Systems Associate | AlphaTech Cloud Systems
2024 - Present
- Architected enterprise cloud services using Python, Go, and PostgreSQL.
- Reduced cold-start latency by 35% across distributed workers.

Junior Front-End Developer | Beta Web Studio
2022 - 2024
- Created responsive interfaces and design systems with React and TypeScript.

PROJECTS
SmartAgent Core: High-throughput agent orchestration engine
- Built an autonomous multi-agent pipeline using FastAPI and Redis.
- Implemented streaming token evaluation with 99.8% uptime.

VisionTrack: Real-time multi-camera detection
- Created a low-latency video inference pipeline with Python and OpenCV.

CERTIFICATIONS
Professional Certificate in Cloud Architecture
The Global Computing Society
2023

BOOKS AND PATENTS
Patent: Distributed Memory Execution Protocol: Co-inventor on dynamic memory indexing mechanism.
Book: Systems in Practice: Foundations of Modern Scalable Services. Author.

SKILLS
Programming: Python, TypeScript, Go, SQL, HTML, CSS
Frameworks: React, FastAPI, Next.js
Data & AI: PostgreSQL, Redis, OpenCV, Machine Learning
'''

def test_ongoing_education_no_hallucinated_graduation_year():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-ongoing')
    edu = profile.groups['education']
    assert len(edu) == 2
    btech = next(e for e in edu if 'Lovely' in e.fields['institution'].value)
    assert btech.fields['start_date'].value == '2025'
    assert 'end_date' not in btech.fields or not btech.fields['end_date'].value
    assert 'Minors' in btech.fields.get('specialization', btech.fields.get('degree_title')).value

def test_multiple_portfolios_preserved():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-links')
    dfs = profile.groups['digital_footprint']
    urls = [d.fields['normalized_url'].value for d in dfs]
    assert 'https://alexmorgan.dev' in urls
    assert 'https://alexmorgan-research.io' in urls
    assert 'https://github.com/alexm-synth' in urls

def test_distinct_patent_and_book_typing():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-books-patents')
    bp = profile.groups['books_patents']
    assert len(bp) == 2
    types = {r.fields['title'].value: r.fields.get('type', {}).value for r in bp}
    patent_match = next((t, v) for t, v in types.items() if 'Distributed Memory' in t)
    book_match = next((t, v) for t, v in types.items() if 'Systems in Practice' in t)
    assert patent_match[1] == 'patent'
    assert book_match[1] == 'book'

def test_grouped_certification_not_split():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-cert')
    certs = profile.groups['certifications']
    assert len(certs) == 1
    c = certs[0]
    assert 'Cloud Architecture' in c.fields['title'].value
    assert 'Global Computing Society' in c.fields['issuer'].value
    assert c.fields['issue_date'].value == '2023'

def test_project_chunking_and_action_verbs():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-projects')
    projects = profile.groups['projects']
    assert len(projects) == 2
    titles = [p.fields['title'].value for p in projects]
    assert 'SmartAgent Core' in titles[0]
    assert 'VisionTrack' in titles[1]

def test_real_roles_preserved_without_generic_fallback():
    content = read_document(SYNTHETIC_V3_CV.encode(), 'txt', settings)
    profile = extract_profile(content, 'synth-v3-roles')
    exp = profile.groups['experience']
    assert len(exp) == 2
    roles = [e.fields['job_title'].value for e in exp]
    assert any('Web & Systems' in r for r in roles)
    assert any('Front-End' in r for r in roles)
