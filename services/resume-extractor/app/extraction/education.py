import re
from .common import EDU,GRADE,years,add,lines_of

def extract_education(content,groups):
    seq=lines_of(content,'education')
    chunks=[]; current=[]
    for line in seq:
        text=line.text.strip()
        is_bullet=bool(re.match(r'^(?:[•·*◦\-–—]|\d+\.)\s*',text))
        has_degree=bool(EDU.search(text))
        has_inst=bool(re.search(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board)\b',text,re.I))

        curr_has_inst=any(re.search(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board)\b',l.text,re.I) for l in current)
        curr_has_deg=any(EDU.search(l.text) for l in current)

        if current and ((is_bullet and (curr_has_inst or curr_has_deg)) or (has_inst and curr_has_inst) or (has_degree and curr_has_deg)):
            chunks.append(current)
            current=[]
        current.append(line)
    if current: chunks.append(current)

    for chunk in chunks:
        primary=next((l for l in chunk if EDU.search(l.text)),None)
        inst_line=next((l for l in chunk if re.search(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board)\b',l.text,re.I)),None)
        if primary is None and inst_line is None: continue

        attr={}
        if primary:
            degree=EDU.search(primary.text)
            if degree:
                attr['qualification']=(degree.group(0),primary,.86)
            if len(primary.text)<180:
                attr['degree_title']=(primary.text.strip(' •*-'),primary,.80)

        for l in chunk[:7]:
            t=l.text.strip(' •*-')
            if re.search(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board)\b',t,re.I):
                attr.setdefault('institution',(t,l,.85))
                if 'university' in t.lower(): attr['university']=(t,l,.85)
                elif 'board' in t.lower(): attr['board']=(t,l,.80)
            if g:=GRADE.search(t):
                attr['grade']=(g.group(0),l,.93)
            if re.search(r'(?:AI|artificial intelligence|computer science|electrical|mechanical|information technology|electronics|data science|biochemistry)',t,re.I):
                attr.setdefault('specialization',(t,l,.75))
            y1,y2=years(t)
            if y1 and 'start_date' not in attr: attr['start_date']=(y1,l,.80)
            if y2: attr['end_date']=(y2,l,.80)
            if re.search(r'expected|pursuing|present|ongoing',t,re.I) and y2: attr['expected_graduation']=(y2,l,.85)

        if attr.get('institution') or attr.get('degree_title') or attr.get('qualification'):
            add(groups,'education',attr)
