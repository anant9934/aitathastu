import re
from .common import EDU,GRADE,years,add,lines_of

def extract_education(content,groups):
    seq=lines_of(content,'education')
    chunks=[]; current=[]
    for line in seq:
        hasdegree=bool(EDU.search(line.text))
        if hasdegree and current:
            chunks.append(current); current=[]
        current.append(line)
    if current: chunks.append(current)
    for chunk in chunks:
        primary=next((l for l in chunk if EDU.search(l.text)),None)
        if primary is None: continue
        text=' | '.join(l.text for l in chunk[:7]); attr={}
        degree=EDU.search(primary.text)
        attr['qualification']=(degree.group(0),primary,.86)
        if len(primary.text)<180: attr['degree_title']=(primary.text,primary,.75)
        for l in chunk[:6]:
            t=l.text
            if re.search(r'\b(?:university|college|institute|school|academy|polytechnic|vidyalaya|board)\b',t,re.I):
                key='institution'
                attr.setdefault(key,(t,l,.79))
                if 'university' in t.lower(): attr['university']=(t,l,.78)
                elif 'board' in t.lower(): attr['board']=(t,l,.77)
            if g:=GRADE.search(t): attr['grade']=(g.group(0),l,.93)
            if re.search(r'(?:AI|artificial intelligence|computer science|electrical|mechanical|information technology)',t,re.I) and l==primary:
                attr['specialization']=(t,l,.68)
            y1,y2=years(t)
            if y1 and 'start_date' not in attr: attr['start_date']=(y1,l,.8)
            if y2: attr['end_date']=(y2,l,.8)
            if re.search(r'expected|pursuing|present|ongoing',t,re.I) and y2: attr['expected_graduation']=(y2,l,.82)
        add(groups,'education',attr)
