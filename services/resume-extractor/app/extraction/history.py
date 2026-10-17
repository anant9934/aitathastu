"""Experience, internship, projects and recognition extractors."""
import re
from .common import add,lines_of,years,METRIC,detect_skills,URL

BULLET_PREFIX_RE = re.compile(r'^\s*[-•*»©°«+·◦–—]\s*')
LOCATION_LINE_RE = re.compile(r'^\W*(?:©|Q|§)?\s*(?:united kingdom|london|seattle|rochester|bristol|suva|fiji|punjab|bihar|india|remote|hybrid|onsite|wa|ny|ri|uk|usa)\b', re.I)
DATE_LINE_RE = re.compile(r'^\W*(?:[£E\d]{1,3}\s*)?(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*[-–—to]+\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current|Ongoing)\W*$', re.I)

ROLE_KEYWORDS = re.compile(r'\b(?:engineer|developer|president|founder|ceo|cto|lead|associate|manager|intern|analyst|consultant|scientist|specialist|architect|co-founder|head|director|coordinator|officer|contributor|trainee|tutor|editor|designer|assistant)\b', re.I)
ORG_KEYWORDS = re.compile(r'\b(?:inc|llc|ltd|corp|corporation|solutions|technologies|systems|university|college|school|magazine|associates|lab|labs|verbinden|kit|asha|agency)\b|\bzipcar', re.I)
DATE_PATTERN = re.compile(r'\b(?:19|20)\d{2}\b')

def _is_noise_or_contact(text):
    clean = re.sub(r'^\W+', '', text).strip()
    if not clean: return True
    if clean.endswith(('—', '–', '-')) or clean.lower() in ('pre—', 'pre-'): return True
    if '@' in clean or re.search(r'\|\s*\d{8,}', clean) or clean.lower().startswith(('wee:', 'web:', 'mail:', 'email:')): return True
    if DATE_PATTERN.search(clean): return False
    if len(re.sub(r'[^a-zA-Z]', '', clean)) < 2: return True
    return False

def _entries(content,section):
    seq=lines_of(content,section)
    if not seq: return []
    entries=[]; chunk=[]
    for line in seq:
        text=line.text.strip()
        if _is_noise_or_contact(text): continue
        is_bullet=bool(BULLET_PREFIX_RE.match(text))
        is_loc = bool(LOCATION_LINE_RE.search(text)) and not (ORG_KEYWORDS.search(text) or ROLE_KEYWORDS.search(text))
        is_date = bool(DATE_LINE_RE.match(text)) or bool(DATE_PATTERN.search(text) and ('-' in text or '–' in text or '—' in text))

        is_sentence = bool(re.match(r'^(?:and|for|with|while|the|in|at|by|to|from|of|ted|using|developed|designed|managed|created|utilized|assisted|collaborated)\s+', text, re.I)) or (text.endswith('.') and not text.lower().endswith(('inc.', 'ltd.', 'co.', 'corp.', 'dept.')))
        has_pipe = ' | ' in text and not is_bullet
        has_org = (bool(ORG_KEYWORDS.search(text)) or bool(re.match(r'^[A-Z0-9\s&,\.\-]{4,60}$', text))) and not is_bullet and not is_loc and not is_sentence and (len(text.split()) >= 2 or bool(ORG_KEYWORDS.search(text))) and len(text.split()) <= 6
        has_role = bool(ROLE_KEYWORDS.search(text)) and not is_bullet and not is_sentence and len(text.split()) <= 6

        current_has_org = any(ORG_KEYWORDS.search(l.text) or (re.match(r'^[A-Z0-9\s&,\.\-]{4,60}$', l.text) and len(l.text.split()) <= 6 and not LOCATION_LINE_RE.search(l.text)) for l in chunk)

        # A new position begins when a fresh date range appears, or a company appears when current chunk already has one
        is_new_entry = chunk and not is_bullet and not is_loc and (
            is_date or
            has_pipe or
            (has_org and current_has_org) or
            (section == 'projects' and has_role and chunk)
        )
        if is_new_entry:
            entries.append(chunk);chunk=[]
        chunk.append(line)
    if chunk: entries.append(chunk)
    return entries

def _is_plausible_org(org_name: str) -> bool:
    if not org_name or len(org_name) < 3: return False
    if org_name[0].islower(): return False
    if re.search(r'\b(?:multimedia|designed|managed|created|utilized|assisted|worked|developed|troubleshooting|reporting|scripting|copyedited)\b', org_name, re.I):
        return False
    return True

def extract_experience(content,groups):
    for chunk in _entries(content,'experience'):
        if not chunk: continue
        head = chunk[0]
        fields = {}

        # Look for explicit role line
        role_line = next((l for l in chunk if ROLE_KEYWORDS.search(l.text) and not bool(BULLET_PREFIX_RE.match(l.text))), None)
        # Look for organization line
        org_line = None
        for l in chunk:
            if l == role_line or bool(BULLET_PREFIX_RE.match(l.text)): continue
            if re.search(r'\b(?:at|@)\s+([\w &.\-]+)', l.text, re.I):
                org_line = l
                break
            clean_l = l.text.strip(' •*-')
            if (ORG_KEYWORDS.search(clean_l) or re.match(r'^[A-Z0-9\s&,\.\-]{4,60}$', clean_l)) and not LOCATION_LINE_RE.search(clean_l):
                org_line = l
                break
            if not years(l.text)[0] and len(clean_l) < 80 and not org_line and not LOCATION_LINE_RE.search(clean_l) and clean_l[0].isupper() and _is_plausible_org(clean_l):
                org_line = l

        job_title = None
        organization = None

        if ' | ' in head.text:
            bits = head.text.split(' | ')
            if ROLE_KEYWORDS.search(bits[0]):
                job_title = (bits[0].strip(), head, .85)
                organization = (bits[1].strip(), head, .80)
            else:
                organization = (bits[0].strip(), head, .85)
                job_title = (bits[1].strip(), head, .80)
        else:
            if role_line:
                job_title = (role_line.text.strip(' •*-'), role_line, .82)
            if org_line:
                clean_org = org_line.text.strip(' •*-')
                if match := re.search(r'(?:at|@)\s+([\w &.\-]+)', clean_org, re.I):
                    clean_org = match.group(1).strip()
                if not LOCATION_LINE_RE.search(clean_org) and _is_plausible_org(clean_org):
                    organization = (clean_org, org_line, .80)
            elif not job_title and not LOCATION_LINE_RE.search(head.text):
                clean_head = head.text.strip(' •*-')
                if len(clean_head) >= 3 and not BULLET_PREFIX_RE.match(head.text):
                    if ROLE_KEYWORDS.search(clean_head):
                        job_title = (clean_head, head, .70)
                    elif ORG_KEYWORDS.search(clean_head) and _is_plausible_org(clean_head):
                        organization = (clean_head, head, .70)

        # Skip noise chunks that lack both a plausible organization and a valid role
        if organization and not _is_plausible_org(organization[0]):
            organization = None
        if not organization and not job_title:
            continue
        if organization and len(organization[0]) < 3: organization = None
        if job_title and len(job_title[0]) < 3: job_title = None
        if not organization and not job_title:
            continue

        # Merge orphan single-word suffixes into preceding organization
        if organization and organization[0].upper() in ('SOLUTIONS', 'SUPPORT', 'SERVICES') and groups['experience']:
            prev_org = groups['experience'][-1].fields.get('organization')
            if prev_org:
                prev_org.value = f"{prev_org.value} {organization[0]}"
                continue

        if job_title: fields['job_title'] = job_title
        if organization: fields['organization'] = organization

        for l in chunk:
            clean_text = l.text.strip(' •*-«+»')
            if match := re.search(r'(?:at|@)\s+([\w &.\-]+)', l.text, re.I):
                fields.setdefault('organization', (match.group(1).strip(), l, .78))
            a, b = years(l.text)
            if a: fields.setdefault('start_date', (a, l, .80))
            if b: fields['end_date'] = (b, l, .80)
            if re.search(r'\bpresent|current\b', l.text, re.I): fields['current_position'] = ('stated current', l, .80)
            if l != head and l != role_line and l != org_line and len(clean_text) > 20:
                fields.setdefault('responsibility', (clean_text, l, .66))
            if METRIC.search(l.text): fields['outcome'] = (clean_text, l, .75)
            s = detect_skills(l.text)
            if s: fields['technologies'] = (', '.join(s), l, .77)
        add(groups, 'experience', fields)

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
        parts = [p.strip() for p in t.split('|')]
        title = parts[0]
        issuer = parts[1] if len(parts) > 1 else None
        if not issuer:
            known = re.search(r'(?:Coursera|Udemy|AWS|Google|Microsoft|NPTEL|edX|HackerRank|Oracle|Infosys|Simplilearn|Forage|Reliance Foundation)', t, re.I)
            if known: issuer = known.group(0)

        fields={'title':(title,line,.82)}
        if issuer:
            issuer_clean = re.sub(r'\b(?:19|20)\d{2}\b', '', issuer).strip(' -•*,')
            if issuer_clean: fields['issuer'] = (issuer_clean, line, .78)
        if re.search(r'completed|earned|issued',t,re.I):fields['completion_status']=(t,line,.74)
        a,b=years(t)
        if a:fields['issue_date']=(a,line,.75)
        if b:fields['expiry_date']=(b,line,.69)
        if skills:=detect_skills(t): fields['skills']=(', '.join(skills),line,.72)
        add(groups,'certifications',fields)
