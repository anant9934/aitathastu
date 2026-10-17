"""Native parsing + selective OCR + evidence-aware section reconstruction."""
from dataclasses import dataclass, field
from io import BytesIO
import re
import time
import fitz
import pytesseract
import shutil, sys, os
from PIL import Image, ImageOps
from docx import Document

if not shutil.which('tesseract'):
    _venv_tess = os.path.join(sys.prefix, 'bin', 'tesseract')
    if os.path.exists(_venv_tess):
        pytesseract.pytesseract.tesseract_cmd = _venv_tess

class OcrEngineUnavailable(RuntimeError):
    """Raised when the Tesseract binary or its language data cannot be loaded.

    This is an infrastructure fault, not a property of the document, so it must
    surface as a distinct failure instead of 'no legible text'.
    """

def _tesseract(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except pytesseract.TesseractNotFoundError as e:
        raise OcrEngineUnavailable('Tesseract binary not found') from e
    except pytesseract.TesseractError as e:
        # Missing language data is reported by tesseract itself, not as NotFound.
        if 'traineddata' in str(e) or 'language' in str(e).lower():
            raise OcrEngineUnavailable('Tesseract language data unavailable') from e
        raise

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
    # Positioned text per page for the caller's layout reconstruction:
    # {page, width, height, source, spans:[{x0,y0,x1,y1,text}], links:[{url,x0,y0,x1,y1}]}
    layout: list[dict] = field(default_factory=list)

HEADINGS = {
 'summary': [
     'summary', 'professional summary', 'career objective', 'objective', 'about me',
     'profile', 'professional profile', 'bio', 'biography'
 ],
 'education': [
     'education', 'academic background', 'academics', 'academic qualifications',
     'educational qualifications', 'qualifications', 'education & qualifications',
     'education and qualifications'
 ],
 'experience': [
     'experience', 'work experience', 'professional experience', 'employment history',
     'work history', 'experience & leadership', 'experience and leadership',
     'professional background', 'employment'
 ],
 'internships': [
     'internships', 'internship', 'industrial training', 'training', 'professional training',
     'vocational training'
 ],
 'skills': [
     'skills', 'technical skills', 'technical expertise', 'technologies', 'competencies',
     'technical proficiencies', 'tools and technologies', 'skills summary',
     'computer/data analytics skills', 'computer and data analytics skills', 'computer skills',
     'data analytics skills', 'relevant languages', 'core competencies', 'technical background'
 ],
 'projects': [
     'projects', 'personal projects', 'academic projects', 'technical projects',
     'project experience', 'selected projects', 'selected projects & client work',
     'selected projects and client work', 'client work', 'key projects'
 ],
 'awards': [
     'awards', 'achievements', 'honours and awards', 'honors and awards',
     'accomplishments', 'scholarships', 'honors', 'key achievements', 'leadership achievements'
 ],
 'certifications': [
     'certifications', 'certificates', 'courses and certifications',
     'licenses and certifications', 'professional certifications', 'online courses',
     'courses'
 ],
 'research': [
     'research', 'publications', 'research publications', 'research experience',
     'papers', 'research & projects', 'research, patents & books', 'research, patents and books'
 ],
 'books_patents': [
     'patents', 'books', 'books and patents', 'intellectual property'
 ],
 'leadership': [
     'leadership', 'volunteering', 'volunteer experience', 'community engagement',
     'extracurricular activities', 'activities and leadership', 'extracurriculars'
 ],
 'contact': [
     'contact', 'contact details', 'personal details', 'get in touch'
 ]
}
def _heading(text):
    s = re.sub(r'^[\W_\d]+|[\W_\d]+$', '', text.lower()).strip()
    s = re.sub(r'\s+', ' ', s)
    h = next((k for k, v in HEADINGS.items() if s == v or s in v), None)
    if h: return h
    s_stripped = re.sub(r'^[a-z0-9\W_]{1,3}\s+', '', s).strip()
    return next((k for k, v in HEADINGS.items() if s_stripped == v or s_stripped in v), None)

def tag_sections(lines):
    section = 'header'
    for l in lines:
        h = _heading(l.text)
        if h:
            section = h
            l.section = 'heading:' + h
        else:
            clean = l.text.strip()
            # If an uppercase heading-like line appears that matches no known heading,
            # switch to unknown to prevent polluting critical prior sections.
            if re.match(r'^[A-Z\s&,/]{3,40}$', clean) and not re.search(r'\d', clean) and len(clean.split()) <= 4:
                if section in ('education', 'certifications', 'summary'):
                    section = 'unknown'
            l.section = section

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

import os
os.environ.setdefault('OMP_THREAD_LIMIT', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
os.environ.setdefault('MKL_NUM_THREADS', '1')

def _words(im, config, seconds):
    """Tesseract word boxes, in its own block/paragraph/line order."""
    lang = os.environ.get('TESSERACT_LANG', 'eng')
    d = _tesseract(
        pytesseract.image_to_data,
        im,
        lang=lang,
        config=config,
        timeout=max(1, int(seconds)),
        output_type=pytesseract.Output.DICT
    )
    out = []
    for i, t in enumerate(d['text']):
        t = (t or '').strip()
        try:
            conf = float(d['conf'][i])
        except (TypeError, ValueError):
            conf = -1
        if not t or conf < 0:
            continue
        x, y, w, h = d['left'][i], d['top'][i], d['width'][i], d['height'][i]
        out.append({'x0': x, 'y0': y, 'x1': x + w, 'y1': y + h, 'text': t, 'key': (d['block_num'][i], d['par_num'][i], d['line_num'][i])})
    return out

def _ocr(im, page, seconds, warnings):
    """Returns (lines, layout_page). Lines feed the local profile extractor; the
    word boxes in layout_page let the caller rebuild multi-column reading order."""
    start_t = time.monotonic()
    deadline = start_t + seconds

    im_gray = ImageOps.exif_transpose(im).convert('L')
    if min(im_gray.size) < 500:
        warnings.append(f'Page {page}: low resolution, OCR may be unreliable.')

    # Resize overly large scans to speed up OCR and prevent timeouts on low-CPU containers
    max_dim = max(im_gray.width, im_gray.height)
    if max_dim > 1500:
        ratio = 1500.0 / max_dim
        im_gray = im_gray.resize((int(im_gray.width * ratio), int(im_gray.height * ratio)), Image.Resampling.LANCZOS)

    # Only detect orientation if image is landscape (unusual for portrait resumes)
    if im_gray.width > im_gray.height * 1.2 and (deadline - time.monotonic()) > 4:
        try:
            orientation = _tesseract(pytesseract.image_to_osd, im_gray, timeout=min(3, max(1, int(deadline - time.monotonic()))))
            match = re.search(r'Rotate: (\d+)', orientation)
            if match and int(match.group(1)) in (90, 180, 270):
                im_gray = im_gray.rotate(-int(match.group(1)), expand=True)
        except OcrEngineUnavailable:
            raise
        except Exception:
            pass

    im_enhanced = ImageOps.autocontrast(im_gray)
    words = []
    ocr_timed_out = False
    base_opt = '--oem 1 --dpi 150 -c omp_thread_limit=1'

    # Attempt word-level extraction with bounded per-attempt timeouts
    for img, psm in ((im_enhanced, '--psm 3'), (im_gray, '--psm 6')):
        remaining = deadline - time.monotonic()
        if remaining <= 2:
            ocr_timed_out = True
            break
        step_timeout = max(2, min(remaining * 0.65 if psm == '--psm 3' else remaining, 25))
        config = f'{psm} {base_opt}'
        try:
            words = _words(img, config, step_timeout)
        except OcrEngineUnavailable:
            raise
        except TimeoutError:
            ocr_timed_out = True
            print(f'[_ocr] Tesseract timeout page {page} ({psm})', flush=True)
            words = []
        except Exception as e:
            if 'timeout' in str(e).lower():
                ocr_timed_out = True
            print(f'[_ocr] Tesseract image_to_data error page {page} ({psm}): {type(e).__name__}: {e}', flush=True)
            words = []
        if sum(len(w['text']) for w in words) >= 30:
            break

    # Fallback to direct string extraction if word boxes produced insufficient text
    if sum(len(w['text']) for w in words) < 30 and (deadline - time.monotonic()) > 2:
        rem = deadline - time.monotonic()
        try:
            lang = os.environ.get('TESSERACT_LANG', 'eng')
            raw_str = _tesseract(pytesseract.image_to_string, im_enhanced, lang=lang, config=f'--psm 6 {base_opt}', timeout=max(2, int(rem)))
            if raw_str and len(raw_str.strip()) >= 30:
                raw_lines = [l.strip() for l in raw_str.splitlines() if l.strip()]
                words = []
                for i, text in enumerate(raw_lines):
                    words.append({'x0': 0.0, 'y0': float(i * 18), 'x1': 100.0, 'y1': float(i * 18 + 14), 'text': text, 'key': (1, 1, i)})
        except OcrEngineUnavailable:
            raise
        except TimeoutError:
            ocr_timed_out = True
            print(f'[_ocr] Tesseract image_to_string fallback timeout page {page}', flush=True)
        except Exception as e:
            if 'timeout' in str(e).lower():
                ocr_timed_out = True
            print(f'[_ocr] Tesseract image_to_string fallback error page {page}: {type(e).__name__}: {e}', flush=True)

    width = float(im_gray.width)
    raw_lines = {}
    for w in words:
        raw_lines.setdefault(w['key'], []).append(w)

    line_objs = []
    for k, ws in raw_lines.items():
        ws_sorted = sorted(ws, key=lambda x: x['x0'])
        x0 = min(w['x0'] for w in ws)
        x1 = max(w['x1'] for w in ws)
        y0 = min(w['y0'] for w in ws)
        y1 = max(w['y1'] for w in ws)
        text = ' '.join(w['text'] for w in ws_sorted).strip()
        if text:
            line_objs.append({'key': k, 'words': ws_sorted, 'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'text': text})

    left_lines = [l for l in line_objs if l['x1'] < width * 0.52 and l['x0'] < width * 0.45]
    right_lines = [l for l in line_objs if l['x0'] > width * 0.46 and l['x1'] > width * 0.55]

    if len(left_lines) >= 8 and len(right_lines) >= 8:
        heading_ys = [l['y0'] for l in line_objs if _heading(l['text']) is not None]
        first_heading_y = min(heading_ys) if heading_ys else width * 0.25
        top_banner = []
        left_col = []
        right_col = []
        for l in line_objs:
            if l['y1'] <= first_heading_y or (l['x0'] < width * 0.40 and l['x1'] > width * 0.60):
                top_banner.append(l)
            elif (l['x0'] + l['x1']) / 2 < width * 0.48:
                left_col.append(l)
            else:
                right_col.append(l)
        ordered = sorted(top_banner, key=lambda l: (round(l['y0'] / 10), l['x0'])) + sorted(left_col, key=lambda l: l['y0']) + sorted(right_col, key=lambda l: l['y0'])
    else:
        ordered = sorted(line_objs, key=lambda l: (round(l['y0'] / 8), l['x0']))

    lines = []
    for i, l in enumerate(ordered):
        lines.append(Line(l['text'], page, 'ocr', f'ocr-{page}-{i}', x=float(l['x0']), y=float(l['y0'])))
    if not lines:
        if ocr_timed_out:
            warnings.append(f'Page {page}: OCR processing timed out.')
        else:
            warnings.append(f'Page {page}: OCR returned no legible text.')
    layout = {
        'page': page,
        'width': im_gray.width,
        'height': im_gray.height,
        'source': 'ocr',
        'spans': [{k: w[k] for k in ('x0', 'y0', 'x1', 'y1', 'text')} for w in words],
        'links': []
    }
    return lines, layout

def _rtf(data):
    s=data.decode('latin1',errors='replace')
    s=re.sub(r"\\'([0-9a-fA-F]{2})",lambda m:bytes.fromhex(m.group(1)).decode('cp1252',errors='replace'),s)
    s=re.sub(r'\\(par|line)\b\s*','\n',s)
    s=re.sub(r'\\tab\b\s*','\t',s)
    s=re.sub(r'\\u(-?\d+)\??',lambda m:chr(int(m.group(1))%65536),s)
    s=re.sub(r'\\[a-zA-Z]+-?\d*\s?','',s)
    s=re.sub(r'\\[^a-zA-Z]','',s)
    return s.replace('{','').replace('}','')

def read_document(data, fmt, settings, force_ocr=False):
    lines = []; warnings = []; methods = []; links = []; attempted = False; used = False; pages = 1; layout = []
    deadline = time.monotonic() + settings.max_processing_seconds
    if fmt == 'pdf':
        with fitz.open(stream=data, filetype='pdf') as doc:
            pages = doc.page_count
            ocr_pages_processed = 0
            ocr_pages_limit = min(settings.max_pages, 10)
            for pageno, page in enumerate(doc, 1):
                if time.monotonic() >= deadline - 3.0:
                    warnings.append(f'Processing timeout after page {pageno-1}; extraction is partial.')
                    break
                native = []
                for bi, b in enumerate(_order(page.get_text('blocks'), page.rect.width)):
                    for t in b[4].splitlines():
                        if t.strip():
                            native.append(Line(t.strip(), pageno, 'native_pdf', f'pdf-{pageno}-{bi}', x=float(b[0]), y=float(b[1])))
                page_links = []
                for link in page.get_links():
                    if url := link.get('uri'):
                        if url.startswith(('https://', 'http://', 'mailto:')):
                            links.append((url, pageno))
                            r = link.get('from')
                            if r is not None:
                                page_links.append({'url': url, 'x0': r.x0, 'y0': r.y0, 'x1': r.x1, 'y1': r.y1})
                needs_ocr = force_ocr or sum(len(x.text) for x in native) < 40
                if native and not force_ocr:
                    lines.extend(native)
                    methods.append('native_pdf')
                    layout.append({
                        'page': pageno,
                        'width': page.rect.width,
                        'height': page.rect.height,
                        'source': 'native_pdf',
                        'spans': [{'x0': w[0], 'y0': w[1], 'x1': w[2], 'y1': w[3], 'text': w[4]} for w in page.get_text('words') if w[4].strip()],
                        'links': page_links
                    })
                if needs_ocr and ocr_pages_processed < ocr_pages_limit:
                    attempted = True
                    ocr_pages_processed += 1
                    try:
                        if page.rect.width * page.rect.height * 4 > 30_000_000:
                            warnings.append(f'Page {pageno}: rendered OCR image exceeds safe pixel limit.')
                            continue
                        scale = 2.0 if force_ocr else 1.5
                        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                        page_budget = max(2, min(settings.max_ocr_seconds, int(deadline - time.monotonic())))
                        ocr, ocr_layout = _ocr(Image.open(BytesIO(pix.tobytes('png'))), pageno, page_budget, warnings)
                        # Only skip OCR lines that are substantial exact duplicates of native lines
                        existing = set() if force_ocr else {l.text.lower().strip() for l in native if len(l.text.strip()) > 10}
                        fresh = [l for l in ocr if l.text.lower().strip() not in existing]
                        if fresh:
                            lines.extend(fresh)
                            used = True
                            methods.append('ocr')
                        if ocr_layout['spans']:
                            # Link rects are in PDF points; the OCR image is scaled.
                            ocr_layout['links'] = [{**l, **{k: l[k] * scale for k in ('x0', 'y0', 'x1', 'y1')}} for l in page_links]
                            layout = [p for p in layout if p['page'] != pageno] + [ocr_layout]
                    except OcrEngineUnavailable:
                        raise
                    except Exception as e:
                        warnings.append(f'Page {pageno}: OCR setup error ({type(e).__name__}).')
    elif fmt == 'docx':
        doc = Document(BytesIO(data))
        for i, item in enumerate(doc.iter_inner_content()):
            if hasattr(item, 'rows'):
                for j, row in enumerate(item.rows):
                    t = ' | '.join(c.text.strip() for c in row.cells if c.text.strip())
                    if t:
                        lines.append(Line(t, 1, 'docx', f'table-{i}-{j}'))
            elif item.text.strip():
                lines.append(Line(item.text.strip(), 1, 'docx', f'para-{i}'))
        links = [(r.target_ref, 1) for r in doc.part.rels.values() if r.reltype.endswith('/hyperlink') and str(r.target_ref).startswith(('http:', 'https:'))]
        methods = ['docx']
        if len(lines) > 180:
            pages = (len(lines) + 59) // 60
            warnings.append('DOCX page numbers are estimates.')
    elif fmt in ('txt', 'rtf'):
        t = (data.decode('utf-8-sig', errors='replace') if fmt == 'txt' else _rtf(data))
        lines = [Line(s.strip(), 1, fmt, f'{fmt}-{i}') for i, s in enumerate(t.splitlines()) if s.strip()]
        methods = [fmt]
    elif fmt in ('png', 'jpg', 'jpeg'):
        attempted = True
        img_budget = max(2, min(settings.max_ocr_seconds, int(deadline - time.monotonic())))
        lines, ocr_layout = _ocr(Image.open(BytesIO(data)), 1, img_budget, warnings)
        layout = [ocr_layout] if ocr_layout['spans'] else []
        used = bool(lines)
        if used:
            methods = ['ocr']
    if used:
        warnings.append('OCR text must be checked against the source document.')
    if not lines:
        warnings.append('No reliable text extracted; missing values remain empty.')
    tag_sections(lines)
    return Content(lines, pages, fmt, attempted, used, list(dict.fromkeys(methods)), warnings, links, layout)
