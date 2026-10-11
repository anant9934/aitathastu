import os,sys,pytest
from pathlib import Path
from io import BytesIO
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas
from docx import Document
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['EXTRACTOR_API_TOKEN']='test-local-secret-token-only'
os.environ['EXTRACTOR_VERIFIER_TOKEN']='test-verified-token-only'
os.environ['STORAGE_DIR']=str(Path(__file__).resolve().parents[1]/'.test-data')
from app.main import app,store

SAMPLE='''Ananya Sharma
AI/ML Student and Python Developer
ananya.sharma@example.com | +91 9876543210
GitHub: https://github.com/ananya-ml
LinkedIn: https://linkedin.com/in/ananya-ml

EDUCATION
B.Tech in Computer Science | Lovely Professional University | 2022 - 2026 | CGPA: 8.7/10
Class 12 | CBSE Board | 2022 | 91%
Class 10 | CBSE Board | 2020 | 94%

TECHNICAL SKILLS
Python, PyTorch, Machine Learning, SQL, React, Docker, Git

PROJECTS
Student Performance Predictor | Python, Scikit-learn
- Built a prediction model with reported 87% accuracy using Python and Pandas.
Smart Campus Chatbot | RAG, LangChain
- Designed a retrieval-based Q&A assistant.

INTERNSHIPS
AI Intern | Example Research Lab | 2025
- Built prototype ML pipeline with Python.

CERTIFICATIONS
Machine Learning Specialization - Coursera 2024

AWARDS
Hackathon finalist (participation) 2025
'''

@pytest.fixture
def client():
    return TestClient(app)
@pytest.fixture
def auth():return {'Authorization':'Bearer test-local-secret-token-only'}
@pytest.fixture
def sample():return SAMPLE
@pytest.fixture
def pdf(sample):
    buf=BytesIO(); c=canvas.Canvas(buf,pagesize=(595,842)); y=805
    for line in sample.splitlines():
        c.drawString(40,y,line[:105]);y-=18
        if y<55:c.showPage();y=805
    c.save();return buf.getvalue()
@pytest.fixture
def docx_file(sample):
    doc=Document()
    for t in sample.splitlines():doc.add_paragraph(t)
    buf=BytesIO();doc.save(buf);return buf.getvalue()
@pytest.fixture
def ocr_png():
    image=Image.new('RGB',(1500,720),'white');draw=ImageDraw.Draw(image)
    try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',38)
    except OSError:font=ImageFont.load_default()
    for n,t in enumerate(['Ananya Sharma','EDUCATION','B.Tech Computer Science 2022 - 2026','TECHNICAL SKILLS','Python, SQL, PyTorch']):draw.text((70,50+n*105),t,fill='black',font=font)
    buf=BytesIO();image.save(buf,format='PNG');return buf.getvalue()
