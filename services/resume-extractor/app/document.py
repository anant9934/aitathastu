"""Native parsing + selective OCR + evidence-aware section reconstruction."""
from dataclasses import dataclass, asdict
from io import BytesIO
import re
import time
import numpy as np
import cv2
import fitz
import pytesseract
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
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
    im=ImageOps.exif_transpose(im).convert('RGB')
    if min(im.size)<700: warnings.append(f'Page {page}: low resolution, OCR may be unreliable.')
    try:
        orientation = pytesseract.image_to_osd(im,timeout=min(3,seconds))
        match = re.search(r'Rotate: (\d+)',orientation)
        if match and int(match.group(1)) in (90,180,270):
            im=im.rotate(-int(match.group(1)),expand=True)
    except Exception:
        pass  # Sparse images often have no reliable orientation estimate.
    im=ImageEnhance.Contrast(ImageOps.grayscale(im).filter(ImageFilter.MedianFilter(3))).enhance(1.8)
    gray=np.array(im)
    if gray.shape[0]>80 and gray.shape[1]>80:
        bw=cv2.threshold(gray,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]
        ink=np.column_stack(np.where(bw<128))
        if len(ink)>100:
            angle=cv2.minAreaRect(ink[:, ::-1].astype(np.float32))[-1]
            if angle < -45: angle+=90
            if 0.5<abs(angle)<6:
                matrix=cv2.getRotationMatrix2D((gray.shape[1]/2,gray.shape[0]/2),angle,1)
                im=Image.fromarray(cv2.warpAffine(bw,matrix,(gray.shape[1],gray.shape[0]),borderValue=255))
    try:
        txt=pytesseract.image_to_data(im,config='--psm 3',output_type=pytesseract.Output.DICT,timeout=seconds)
    except (RuntimeError,pytesseract.TesseractNotFoundError):
        warnings.append(f'Page {page}: OCR failed or exceeded timeout.')
        return []
    groups={}
    for i,word in enumerate(txt['text']):
        if word.strip():
            key=(txt['block_num'][i],txt['par_num'][i],txt['line_num'][i])
            groups.setdefault(key,[]).append((txt['left'][i],word))
    return [Line(' '.join(w for _,w in sorted(words)),page,'ocr',f'ocr-{page}-{k}') for k,words in groups.items()]

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
                if sum(len(x.text) for x in native)<55:
                    attempted=True
                    try:
                        if page.rect.width*page.rect.height*4>30_000_000:
                            warnings.append(f'Page {pageno}: rendered OCR image exceeds safe pixel limit.')
                            continue
                        pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
                        ocr=_ocr(Image.open(BytesIO(pix.tobytes('png'))),pageno,max(1,min(settings.max_ocr_seconds,int(deadline-time.monotonic()))),warnings)
                        existing={l.text.lower() for l in native}
                        fresh=[l for l in ocr if l.text.lower() not in existing]
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
