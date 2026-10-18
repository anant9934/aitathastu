import re
from .common import EDU,GRADE,years,add,lines_of

INST_RE = re.compile(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board|complex)\b', re.I)
DEG_FIELD_RE = re.compile(r'\b(?:matriculation|intermediate|mathematics(?:\s+and\s+statistics)?|statistics|computer\s+science|data\s+science|biological\s+science|artificial\s+intelligence|engineering|information\s+technology|biochemistry|IB\s+Diploma)\b', re.I)

def extract_education(content,groups):
    seq=lines_of(content,'education')
    chunks=[]; current=[]
    for line in seq:
        text=line.text.strip()
        is_bullet=bool(re.match(r'^(?:[•·*◦\-–—]|\d+\.)\s*',text))
        has_degree=bool(EDU.search(text) or DEG_FIELD_RE.search(text))
        has_inst=bool(INST_RE.search(text))
        has_dates=bool(re.search(r'\b(?:19|20)\d{2}\b',text) and ('-' in text or '–' in text or '—' in text or '/' in text))

        is_minor=bool(re.match(r'^(?:minors?)\b',text,re.I))
        curr_has_inst=any(INST_RE.search(l.text) for l in current)
        curr_has_deg=any(EDU.search(l.text) or DEG_FIELD_RE.search(l.text) for l in current)
        curr_has_dates=any(re.search(r'\b(?:19|20)\d{2}\b',l.text) and ('-' in l.text or '–' in l.text or '—' in l.text or '/' in l.text) for l in current)

        is_new_record = not is_minor and current and (
            (is_bullet and (curr_has_inst or curr_has_deg or curr_has_dates)) or
            (has_dates and curr_has_dates) or
            (has_inst and curr_has_inst and (curr_has_deg or curr_has_dates)) or
            (has_degree and curr_has_deg and curr_has_inst)
        )

        if is_new_record:
            chunks.append(current)
            current=[]
        current.append(line)
    if current: chunks.append(current)

    for chunk in chunks:
        primary=next((l for l in chunk if EDU.search(l.text)),None)
        if primary is None:
            primary=next((l for l in chunk if DEG_FIELD_RE.search(l.text)),None)
        inst_line=next((l for l in chunk if INST_RE.search(l.text)),None)
        if primary is None and inst_line is None: continue

        attr={}
        if primary:
            degree=EDU.search(primary.text)
            if degree:
                attr['qualification']=(degree.group(0),primary,.86)
            elif m:=DEG_FIELD_RE.search(primary.text):
                attr['qualification']=(m.group(0),primary,.82)
            if len(primary.text)<180:
                attr['degree_title']=(primary.text.strip(' •*-'),primary,.80)

        for l in chunk[:8]:
            t=l.text.strip(' •*-')
            if INST_RE.search(t):
                # Clean up trailing location or date info attached to institution
                inst_clean = re.sub(r'\s+(?:Jun|Jul|Apr|May|Jan|Feb|Mar|Aug|Sep|Oct|Nov|Dec|\d{4})\b.*$', '', t, flags=re.I).strip(' ,;-')
                inst_clean = re.sub(r'\bTechn\s+ology\b', 'Technology', inst_clean, flags=re.I)
                inst_clean = re.sub(r'\bRajkiva\s+fila\b', 'Rajkiya Jila', inst_clean, flags=re.I)
                attr.setdefault('institution',(inst_clean or t,l,.85))
                if 'university' in t.lower(): attr['university']=(inst_clean or t,l,.85)
                elif 'board' in t.lower() or 'bseb' in t.lower() or 'bses' in t.lower(): attr['board']=(inst_clean or t,l,.80)
            if re.match(r'^minors?\s+in\s+(.+)$', t, re.I):
                attr['specialization'] = (t, l, .80)
            if g:=GRADE.search(t):
                attr['grade']=(g.group(0),l,.93)
            elif re.search(r'\b(?:honou?rs|distinction|first class)\b',t,re.I):
                honors_m = re.search(r'\b(?:first class honours|with honours|with honors|distinction|honours|honors)\b',t,re.I)
                if honors_m and 'grade' not in attr: attr['grade']=(honors_m.group(0),l,.88)
            
            # Clean specialization extraction instead of capturing entire line
            if 'specialization' not in attr and re.search(r'(?:AI|artificial intelligence|computer science|electrical|mechanical|information technology|electronics|data science|biochemistry|mathematics|biological science)',t,re.I):
                spec_m = re.search(r'\b(?:in|of|,)\s*([A-Za-z\s&()]{3,60}(?:AI\s*&\s*ML|Al\s*&\s*ML|Artificial\s*Intelligence|Computer\s*Science|Information\s*Technology|Data\s*Science|Engineering|Mathematics)[A-Za-z\s&()]*)', t, re.I)
                if not spec_m:
                    spec_m = re.search(r'\b(Computer\s+Science(?:\s+&\s+Engineering)?(?:\s*\([A-Za-z\s&]+\))?|Artificial\s+Intelligence(?:\s+&\s+Machine\s+Learning)?|Data\s+Science|Information\s+Technology)\b', t, re.I)
                if spec_m:
                    cleaned_spec = spec_m.group(1 if spec_m.lastindex else 0).strip(' ,;-')
                    cleaned_spec = re.sub(r'\bAl\b', 'AI', cleaned_spec)
                    attr['specialization'] = (cleaned_spec, l, .80)
                else:
                    attr.setdefault('specialization',(t,l,.75))

            if 'degree_title' in attr and ';' in attr['degree_title'][0]:
                clean_dt = attr['degree_title'][0].split(';')[0].strip(' •*-')
                clean_dt = re.sub(r'\bAl\b', 'AI', clean_dt)
                clean_dt = re.sub(r'\bBSES\b', 'BSEB', clean_dt)
                attr['degree_title'] = (clean_dt, primary or l, .82)

            y1,y2=years(t)
            is_present = bool(re.search(r'\b(?:present|current|ongoing|pursuing)\b', t, re.I))
            if y1 and 'start_date' not in attr: attr['start_date']=(y1,l,.80)
            if y2 and not is_present: attr['end_date']=(y2,l,.80)
            if re.search(r'expected\b',t,re.I) and y2: attr['expected_graduation']=(y2,l,.85)

        if attr.get('institution') or attr.get('degree_title') or attr.get('qualification'):
            add(groups,'education',attr)
