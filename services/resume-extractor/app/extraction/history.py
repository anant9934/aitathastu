"""Experience, internship, projects and recognition extractors."""
import re
from .common import add,lines_of,years,METRIC,detect_skills,URL

def _entries(content,section):
    seq=lines_of(content,section)
    if not seq: return []
    entries=[]; chunk=[]
    for i,line in enumerate(seq):
        text=line.text
        is_bullet=bool(re.match(r'^\s*[-•*]\s+',text))
        # New records generally have a short, non-bullet title following a paragraph or another record.
        if chunk and not is_bullet and (len(text)<110) and (i>0 and (re.search(r'\b(?:20|19)\d{2}\b',text) or ' | ' in text or (len(chunk)>1 and text.istitle()))):
            entries.append(chunk);chunk=[]
        chunk.append(line)
    if chunk: entries.append(chunk)
    return entries

def extract_experience(content,groups):
    for chunk in _entries(content,'experience'):
        head=chunk[0]; t=head.text; fields={'job_title':(t,head,.69)}
        if ' | ' in t:
            bits=t.split(' | ')
            fields['job_title']=(bits[0],head,.77)
            if len(bits)>1: fields['organization']=(bits[1],head,.72)
        for l in chunk:
            if match:=re.search(r'(?:at|@)\s+([\w &.\-]+)',l.text,re.I): fields.setdefault('organization',(match.group(1).strip(),l,.72))
            a,b=years(l.text)
            if a: fields.setdefault('start_date',(a,l,.80))
            if b: fields['end_date']=(b,l,.80)
            if re.search(r'\bpresent|current\b',l.text,re.I): fields['current_position']=('stated current',l,.80)
            if l!=head and len(l.text)>30: fields.setdefault('responsibility',(l.text,l,.66))
            if METRIC.search(l.text): fields['outcome']=(l.text,l,.75)
            s=detect_skills(l.text)
            if s: fields['technologies']=(', '.join(s),l,.77)
        add(groups,'experience',fields)

def extract_internships(content,groups):
    for chunk in _entries(content,'internships'):
        head=chunk[0]; fields={'program':(head.text,head,.75)}
        if ' | ' in head.text:
            split=head.text.split(' | ')
            fields['role']=(split[0],head,.76)
            fields['provider']=(split[1],head,.70)
        for l in chunk:
            a,b=years(l.text)
            if a: fields.setdefault('start_date',(a,l,.78))
            if b: fields['end_date']=(b,l,.78)
            if m:=re.search(r'\b\d+\s*(?:weeks?|months?)\b',l.text,re.I): fields['duration']=(m.group(0),l,.89)
            if re.search(r'completed|in progress|ongoing',l.text,re.I):fields['completion_status']=(l.text,l,.68)
            if l!=head and len(l.text)>22: fields.setdefault('responsibility',(l.text,l,.66))
            if skills:=detect_skills(l.text): fields['technologies']=(', '.join(skills),l,.78)
        add(groups,'internships',fields)

def extract_projects(content,groups):
    for chunk in _entries(content,'projects'):
        head=chunk[0];title=re.sub(r'^\s*[-•*]\s*','',head.text).strip()
        if not title or title.lower() in ('projects','selected projects'):continue
        fields={'title':(title.split(' | ')[0],head,.83)}
        desc=next((l for l in chunk[1:] if len(l.text)>=22),None)
        if desc: fields['description']=(desc.text,desc,.67)
        skills=[]
        for l in chunk:
            skills.extend(s for s in detect_skills(l.text) if s not in skills)
            if METRIC.search(l.text): fields['outcome']=(l.text,l,.76)
            if re.search(r'\b(?:lead|built|developed|designed|implemented)\b',l.text,re.I):fields.setdefault('contribution',(l.text,l,.67))
            a,b=years(l.text)
            if a:fields.setdefault('start_date',(a,l,.71))
            if b:fields['end_date']=(b,l,.71)
            for url in URL.findall(l.text):
                if 'github.com' in url: fields['github_url']=(url,l,.92)
                elif 'demo' in l.text.lower(): fields['demo_url']=(url,l,.84)
                else: fields.setdefault('evidence_url',(url,l,.81))
        if skills:fields['technologies']=(', '.join(skills),head,.70)
        add(groups,'projects',fields)

def extract_awards(content,groups):
    for line in lines_of(content,'awards'):
        t=line.text.lstrip(' -•*')
        if len(t)<4:continue
        fields={'name':(t,line,.78)}
        if re.search(r'participated|participant',t,re.I):fields['participation_status']=('participant',line,.85)
        elif re.search(r'won|winner|first place|1st|champion',t,re.I):fields['result']=(t,line,.82)
        if re.search(r'rank\s*#?\d+|\b\d+(?:st|nd|rd|th)\s+place',t,re.I):fields['rank']=(t,line,.75)
        a,_=years(t)
        if a: fields['date']=(a,line,.77)
        add(groups,'awards',fields)

def extract_certifications(content,groups):
    for line in lines_of(content,'certifications'):
        t=line.text.lstrip(' -•*')
        if len(t)<4: continue
        fields={'title':(t,line,.79)}
        if re.search(r'completed|earned|issued',t,re.I):fields['completion_status']=(t,line,.74)
        a,b=years(t)
        if a:fields['issue_date']=(a,line,.72)
        if b:fields['expiry_date']=(b,line,.69)
        if skills:=detect_skills(t): fields['skills']=(', '.join(skills),line,.72)
        add(groups,'certifications',fields)
