"""Evidence-preserving extraction helpers and normalization."""
import re,uuid
from urllib.parse import urlsplit,urlunsplit
from ..schema import Evidence,ExtractedField,Record
from ..document import Line

EMAIL=re.compile(r'(?<![\w.\-])([\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,})(?![\w.])')
URL=re.compile(r'(?<![@\w.])(?:(?:https?://)?(?:www\.)?(?:[\w-]+\.)+[a-z]{2,}(?:/[^\s\]>),;]*)?)',re.I)
PHONE=re.compile(r'(?<![\w])(?:\+\d{1,3}[\s.\-]?)?(?:\(?\d{2,5}\)?[\s.\-]?)?\d{3,5}[\s.\-]?\d{3,5}(?!\w)')
YEAR=re.compile(r'\b(?:19|20)\d{2}\b')
EDU=re.compile(r'\b(?:B\.?Tech|B\.?E\.?|Bachelor|BSc|B\.Sc|BCA|BBA|BA|B\.Com|BS|M\.?Tech|Master|MSc|M\.Sc|MCA|MBA|MS|Ph\.?D|Doctorate|Diploma|Associate|Class\s*(?:10|12|X|XII)\b|10th|12th|High School|Senior Secondary|Secondary School|Intermediate|Matriculation|Higher Secondary)\b',re.I)
GRADE=re.compile(r'\b(?:CGPA|GPA)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?(?:\s*/\s*\d{1,2})?)|\b\d{1,3}(?:\.\d+)?\s*%',re.I)
METRIC=re.compile(r'\b\d+(?:\.\d+)?\s*(?:%|x\b|users\b|hours\b|ms\b|points\b|rank\b)',re.I)
DOI=re.compile(r'\b10\.\d{4,9}/[^\s,;]+',re.I)
SKILL_NAMES='Python,Java,C++,C,C#,JavaScript,TypeScript,HTML,CSS,SQL,Go,Rust,R,PyTorch,TensorFlow,Scikit-learn,Keras,OpenCV,NumPy,Pandas,Matplotlib,LangChain,LLM,RAG,Machine Learning,Deep Learning,NLP,Computer Vision,Generative AI,Transformers,FastAPI,Django,Flask,React,Next.js,Node.js,Express,PostgreSQL,MySQL,MongoDB,Redis,Docker,Kubernetes,AWS,Azure,GCP,Git,GitHub,GitHub Actions,Linux,Tableau,Power BI,Excel,PowerPoint,Canva,Data Structures,Algorithms,DBMS,Data Modeling,Cybersecurity,Networking,Statistics,Data Analysis,GraphQL,Tailwind,CI/CD,Kafka,PyPDF,Redux,Vite,REST APIs,WordPress,Drupal,Joomla,phpMyAdmin,Prestashop,Adobe Captivate,Adobe Flash,Adobe Fireworks,Adobe Illustrator,Adobe InDesign,Adobe Photoshop,Adobe Connect,Eclipse,Microsoft Word,Microsoft Office,MS SQL Server,Sisense,Zoho Analytics,GoodData,Qlik Sense,PHP,XHTML,XML,JSP,Supabase,Prisma,Confluence,Pixelmator,Front-End Development,Web Development,Responsive UI,Artificial Intelligence,Mathematics,Problem Solving,Entrepreneurship,Leadership,Collaboration'.split(',')
SKILLS={s.lower():s for s in SKILL_NAMES}
SKILLS.update({
    'sklearn':'Scikit-learn','ml':'Machine Learning','gen ai':'Generative AI','generative ai':'Generative AI',
    'retrieval augmented generation':'RAG','large language models':'LLM','postgres':'PostgreSQL','js':'JavaScript',
    'ts':'TypeScript','py':'Python','cpp':'C++','tailwind css':'Tailwind','aws cloud':'AWS','azure cloud':'Azure',
    'google cloud':'GCP','illustrator':'Adobe Illustrator','photoshop':'Adobe Photoshop','indesign':'Adobe InDesign',
    'ms excel':'Excel','microsoft excel':'Excel','ms powerpoint':'PowerPoint','power point':'PowerPoint',
    'c5':'CSS','mongadb':'MongoDB','al':'Artificial Intelligence','ai':'Artificial Intelligence',
    'front end development':'Front-End Development','frontend development':'Front-End Development',
    'frontend':'Front-End Development','front-end':'Front-End Development','web dev':'Web Development',
    'responsive design':'Responsive UI'
})
PLATFORMS={'github.com':'GitHub','linkedin.com':'LinkedIn','leetcode.com':'LeetCode','hackerrank.com':'HackerRank','hackerearth.com':'HackerEarth','codechef.com':'CodeChef','kaggle.com':'Kaggle','huggingface.co':'Hugging Face','orcid.org':'ORCID','scholar.google.com':'Google Scholar','stackoverflow.com':'Stack Overflow','dev.to':'DEV Community'}

def redact_phone_from_snippet(text: str) -> str:
    return PHONE.sub('[PHONE_EXCLUDED]', text)

def evidence(line): return Evidence(page=line.page,section=line.section,snippet=redact_phone_from_snippet(line.text[:320]),method=line.method,block_id=line.block_id)
def field(value,line,confidence=.86):
    value=str(value).strip()
    return ExtractedField(value=value,original_value=value,evidence=[evidence(line)],confidence=round(min(confidence,.63) if line.method=='ocr' else confidence,2))
def record(items): return Record(record_id=str(uuid.uuid4()),fields={k:field(*v) for k,v in items.items() if v and v[0]})
def add(groups,group,items):
    if items: groups[group].append(record(items))
def lines_of(content,section): return [l for l in content.lines if l.section==section]
def years(text):
    match=YEAR.findall(text)
    return (match[0] if match else None,match[-1] if len(match)>1 else None)
def normalize_url(raw):
    raw=raw.rstrip('.,);]>')
    if raw.startswith('mailto:'): return None
    raw=raw if raw.startswith(('https://','http://')) else 'https://'+raw
    try:
        p=urlsplit(raw)
        if not p.hostname or '.' not in p.hostname or p.username or p.password: return None
        h=p.hostname.lower().replace('www.', '')
        if h in ('next.js', 'node.js', 'react.js', 'vue.js', 'three.js', 'express.js'): return None
        if re.match(r'^(?:b|m)\.(?:tech|sc|com|e|arch)$', h) or len(h.split('.')[0]) <= 1: return None
        return urlunsplit(('https',p.netloc.lower(),p.path.rstrip('/'),p.query,''))
    except ValueError: return None

def url_pairs(content):
    found=[]
    for line in content.lines:
        for m in URL.finditer(line.text): found.append((m.group(0),line,'visible'))
    for i,(url,page) in enumerate(content.hyperlinks):
        found.append((url,Line(url,page,'hyperlink',f'link-{page}-{i}',section='embedded link'),'embedded'))
    return found

def detect_skills(text):
    # Word boundaries avoid false matches such as "go" in "Google"; use curated dictionary only.
    found=[]
    for raw,canonical in sorted(SKILLS.items(),key=lambda x:-len(x[0])):
        if len(raw) <= 2:
            pat = r'(?:^|[\s,;/|•*])' + re.escape(raw) + r'(?:[\s,;/|•*]|$)'
        else:
            pat = r'(?<![\w+])' + re.escape(raw) + r'(?![\w+])'
        if re.search(pat,text,re.I) and canonical not in found: found.append(canonical)
    return found

def category(skill):
    if skill in ['Python','Java','C++','C','C#','JavaScript','TypeScript','SQL','Go','Rust','R','PHP','XHTML']: return 'Programming'
    if skill in ['PyTorch','TensorFlow','Scikit-learn','Keras','Machine Learning','Deep Learning','NLP','Computer Vision','OpenCV','Transformers','Artificial Intelligence']: return 'AI & Data'
    if skill in ['LLM','RAG','LangChain','Generative AI']: return 'Generative AI'
    if skill in ['Pandas','NumPy','Matplotlib','Statistics','Data Analysis','Tableau','Power BI','Excel','Sisense','Zoho Analytics','GoodData','Qlik Sense']: return 'Data Science'
    if skill in ['PostgreSQL','MySQL','MongoDB','Redis','DBMS','Data Modeling','MS SQL Server','Supabase','Prisma','phpMyAdmin']: return 'Databases'
    if skill in ['Docker','Kubernetes','AWS','Azure','GCP','GitHub Actions','CI/CD','Kafka']: return 'Cloud/DevOps'
    if skill in ['FastAPI','Django','Flask','React','Next.js','Node.js','Express','HTML','CSS','GraphQL','Tailwind','Vite','Redux','REST APIs','WordPress','Drupal','Joomla','Prestashop','XML','JSP','Front-End Development','Web Development','Responsive UI']: return 'Development'
    if skill in ['Adobe Captivate','Adobe Flash','Adobe Fireworks','Adobe Illustrator','Adobe InDesign','Adobe Photoshop','Adobe Connect','Eclipse','Microsoft Word','Microsoft Office','Confluence','Pixelmator','PowerPoint','Canva','Git','GitHub']: return 'Tools'
    if skill in ['Mathematics','Problem Solving','Entrepreneurship','Leadership','Collaboration']: return 'Core Strengths'
    return 'Tools & Fundamentals'

