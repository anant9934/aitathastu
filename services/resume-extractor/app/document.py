"""Native parsing + selective OCR + evidence-aware section reconstruction."""
from dataclasses import dataclass
from io import BytesIO
import re
import time
import fitz
import pytesseract
from PIL import Image, ImageOps
from docx import Document

@dataclass
class Line:
    text: str
    page: int
    method: str
    block_id: str
    section: str = 'header'
    x: float = 0
    y: float = 0

@dataclass
class Content:
    lines: list[Line]
    pages: int
    format: str
    ocr_attempted: bool
    ocr_used: bool
    methods: list[str]
    warnings: list[str]
    hyperlinks: list[tuple[str,int]]

HEADINGS = {
 'summary':['summary','professional summary','career objective','objective','about me','profile','professional profile'],
 'education':['education','academic background','academics','academic qualifications','educational qualifications','qualifications'],
 'experience':['experience','work experience','professional experience','employment history','work history'],
 'internships':['internships','internship','industrial training','training','professional training'],
 'skills':['skills','technical skills','technical expertise','technologies','competencies','technical proficiencies','tools and technologies'],
 'projects':['projects','personal projects','academic projects','technical projects','project experience','selected projects'],
 'awards':['awards','achievements','honours and awards','honors and awards','accomplishments','scholarships'],
 'certifications':['certifications','certificates','courses and certifications','licenses and certifications','professional certifications','online courses'],
 'research':['research','publications','research publications','research experience','papers','research & projects'],
 'books_patents':['patents','books','books and patents','intellectual property'],
 'leadership':['leadership','volunteering','volunteer experience','community engagement','extracurricular activities','activities and leadership'],
 'contact':['contact','contact details','personal details']
}
def _heading(text):
    s=re.sub(r'^[\W_]+|[\W_]+$','',text.lower()).strip()
    return next((k for k,v in HEADINGS.items() if s in v),None)

def tag_sections(lines):
    section='header'
    for l in lines:
        h=_heading(l.text)
        if h: section=h; l.section='heading:'+h
        else: l.section=section

def _order(blocks,width):
    blocks=[b for b in blocks if isinstance(b[4],str) and b[4].strip()]
    left=[b for b in blocks if b[0]<width*.45 and b[2]<width*.6]
    right=[b for b in blocks if b[0]>width*.44 and b[2]>width*.62]
    if len(left)>=2 and len(right)>=2:
        top_y=min(min(b[1] for b in left),min(b[1] for b in right))
        top=[b for b in blocks if b[1]<top_y and b[2]-b[0]>width*.5]
        rest=[b for b in blocks if b not in top]
        return sorted(top,key=lambda b:(b[1],b[0])) + sorted([b for b in rest if (b[0]+b[2])/2<width*.52],key=lambda b:b[1]) + sorted([b for b in rest if (b[0]+b[2])/2>=width*.52],key=lambda b:b[1])
    return sorted(blocks,key=lambda b:(round(b[1]/8),b[0],b[1]))

def _ocr(im,page,seconds,warnings):
    im_gray = ImageOps.exif_transpose(im).convert('L')
    if min(im_gray.size)<500: warnings.append(f'Page {page}: low resolution, OCR may be unreliable.')
    # Only detect orientation if image is landscape (unusual for portrait resumes)
    if im_gray.width > im_gray.height * 1.2:
        try:
            orientation = pytesseract.image_to_osd(im_gray,timeout=min(2,seconds))
            match = re.search(r'Rotate: (\d+)',orientation)
            if match and int(match.group(1)) in (90,180,270):
                im_gray = im_gray.rotate(-int(match.group(1)),expand=True)
        except Exception:
            pass

    # Try high-speed contrast stretch first
    im_enhanced = ImageOps.autocontrast(im_gray)
    raw = ""
    try:
        raw = pytesseract.image_to_string(im_enhanced, config='--psm 3', timeout=seconds)
    except Exception:
        pass

    # Fallback 1: If psm 3 returned empty or very short, try without psm
    if not raw or len(raw.strip()) < 30:
        try:
            raw = pytesseract.image_to_string(im_enhanced, timeout=seconds)
        except Exception:
            pass

    # Fallback 2: Try psm 6 (single uniform block) on raw grayscale if still empty
    if not raw or len(raw.strip()) < 30:
        try:
            raw = pytesseract.image_to_string(im_gray, config='--psm 6', timeout=seconds)
        except Exception:
            pass

    lines = [Line(line.strip(),page,'ocr',f'ocr-{page}-{i}') for i,line in enumerate(raw.splitlines()) if line.strip()]
    if not lines:
        warnings.append(f'Page {page}: OCR returned no legible text.')
    return lines

def _rtf(data):
    s=data.decode('latin1',errors='replace')
    s=re.sub(r"\\'([0-9a-fA-F]{2})",lambda m:bytes.fromhex(m.group(1)).decode('cp1252',errors='replace'),s)
    s=re.sub(r'\\(par|line)\b\s*','\n',s)
    s=re.sub(r'\\tab\b\s*','\t',s)
    s=re.sub(r'\\u(-?\d+)\??',lambda m:chr(int(m.group(1))%65536),s)
    s=re.sub(r'\\[a-zA-Z]+-?\d*\s?','',s)
    s=re.sub(r'\\[^a-zA-Z]','',s)
    return s.replace('{','').replace('}','')

def read_document(data,fmt,settings):
    lines=[]; warnings=[]; methods=[]; links=[]; attempted=False; used=False; pages=1
    deadline=time.monotonic()+settings.max_processing_seconds
    if fmt=='pdf':
        with fitz.open(stream=data,filetype='pdf') as doc:
            pages=doc.page_count
            ocr_pages_processed = 0
            for pageno,page in enumerate(doc,1):
                if time.monotonic()>deadline:
                    warnings.append(f'Processing timeout after page {pageno-1}; extraction is partial.')
                    break
                native=[]
                for bi,b in enumerate(_order(page.get_text('blocks'),page.rect.width)):
                    for t in b[4].splitlines():
                        if t.strip(): native.append(Line(t.strip(),pageno,'native_pdf',f'pdf-{pageno}-{bi}',x=float(b[0]),y=float(b[1])))
                for link in page.get_links():
                    if url:=link.get('uri'):
                        if url.startswith(('https://','http://','mailto:')): links.append((url,pageno))
                if native: lines.extend(native); methods.append('native_pdf')
                if sum(len(x.text) for x in native) < 40 and ocr_pages_processed < 2:
                    attempted=True
                    ocr_pages_processed += 1
                    try:
                        if page.rect.width*page.rect.height*4>30_000_000:
                            warnings.append(f'Page {pageno}: rendered OCR image exceeds safe pixel limit.')
                            continue
                        pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False)
                        ocr=_ocr(Image.open(BytesIO(pix.tobytes('png'))),pageno,max(1,min(settings.max_ocr_seconds,int(deadline-time.monotonic()))),warnings)
                        # Only skip OCR lines that are substantial exact duplicates of native lines
                        existing={l.text.lower().strip() for l in native if len(l.text.strip())>10}
                        fresh=[l for l in ocr if l.text.lower().strip() not in existing]
                        if fresh: lines.extend(fresh); used=True; methods.append('ocr')
                    except Exception as e: warnings.append(f'Page {pageno}: OCR setup error ({type(e).__name__}).')
    elif fmt=='docx':
        doc=Document(BytesIO(data))
        for i,item in enumerate(doc.iter_inner_content()):
            if hasattr(item,'rows'):
                for j,row in enumerate(item.rows):
                    t=' | '.join(c.text.strip() for c in row.cells if c.text.strip())
                    if t: lines.append(Line(t,1,'docx',f'table-{i}-{j}'))
            elif item.text.strip(): lines.append(Line(item.text.strip(),1,'docx',f'para-{i}'))
        links=[(r.target_ref,1) for r in doc.part.rels.values() if r.reltype.endswith('/hyperlink') and str(r.target_ref).startswith(('http:','https:'))]
        methods=['docx']
        if len(lines)>180: pages=(len(lines)+59)//60; warnings.append('DOCX page numbers are estimates.')
    elif fmt in ('txt','rtf'):
        t=(data.decode('utf-8-sig',errors='replace') if fmt=='txt' else _rtf(data))
        lines=[Line(s.strip(),1,fmt,f'{fmt}-{i}') for i,s in enumerate(t.splitlines()) if s.strip()]
        methods=[fmt]
    elif fmt in ('png','jpg','jpeg'):
        attempted=True
        lines=_ocr(Image.open(BytesIO(data)),1,settings.max_ocr_seconds,warnings)
        used=bool(lines)
        if used: methods=['ocr']
    if used: warnings.append('OCR text must be checked against the source document.')
    if not lines: warnings.append('No reliable text extracted; missing values remain empty.')
    tag_sections(lines)
    return Content(lines,pages,fmt,attempted,used,list(dict.fromkeys(methods)),warnings,links)
