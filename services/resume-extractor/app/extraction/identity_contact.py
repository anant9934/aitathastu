import re
from .common import EMAIL,PHONE,URL,add,url_pairs,normalize_url,PLATFORMS

def extract_identity_contact(content,groups):
    header=[l for l in content.lines if l.section=='header'][:12]
    for l in header[:6]:
        t=l.text.strip(' |•-')
        if '@' in t or 'http' in t or any(ch.isdigit() for ch in t): continue
        if 2<=len(t.split())<=5 and len(t)<70 and re.fullmatch(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.' -]+",t):
            add(groups,'identity',{'full_name':(t,l,.72 if l!=header[0] else .88)})
            break
    if len(header)>1:
        for l in header[1:5]:
            if any(x in l.text.lower() for x in ['engineer','developer','student','scientist','researcher','analyst']) and len(l.text)<120:
                add(groups,'identity',{'professional_headline':(l.text,l,.71)})
                break
    email_seen=set();phone_seen=set()
    for l in content.lines:
        for m in EMAIL.finditer(l.text):
            email=m.group(1)
            if email.lower() not in email_seen:
                add(groups,'contact',{'email':(email,l,.98)})
                email_seen.add(email.lower())
        if l.section in ('header','contact'):
            for m in PHONE.finditer(l.text):
                value=m.group(0).strip()
                digits=re.sub(r'\D','',value)
                if 10<=len(digits)<=15 and digits not in phone_seen and not re.search(r'\b(?:19|20)\d{2}\b',value):
                    fields={'phone':(value,l,.84)}
                    if value.startswith('+'):
                        prefix=re.match(r'^\+\d{1,3}',value)
                        if prefix: fields['country_code']=(prefix.group(0),l,.75)
                    add(groups,'contact',fields)
                    phone_seen.add(digits)
        if l.section=='contact' or l.section=='header':
            if re.search(r'(?:location|address|based in)\s*:',l.text,re.I):
                location=re.split(':',l.text,maxsplit=1)[-1].strip()
                if location and len(location)<160: add(groups,'contact',{'location':(location,l,.77)})
    for raw,l,discovery in url_pairs(content):
        norm=normalize_url(raw)
        if not norm: continue
        host=__import__('urllib.parse',fromlist=['urlsplit']).urlsplit(norm).hostname or ''
        platform=next((p for domain,p in PLATFORMS.items() if host==domain or host.endswith('.'+domain)), 'Personal / Other Website')
        if platform=='Personal / Other Website':
            if l.section in ('header','contact'): add(groups,'contact',{'website':(norm,l,.88)})
