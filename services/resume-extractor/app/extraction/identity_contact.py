import re
from .common import EMAIL,URL,add,url_pairs,normalize_url,PLATFORMS

PHONE_REDACTION_RE = re.compile(r'(?<!\w)(?:\+\d{1,3}[\s.\-]?)?(?:\(?\d{2,5}\)?[\s.\-]?)?\d{3,5}[\s.\-]?\d{3,5}(?!\w)')

def sanitize_privacy_text(text: str) -> str:
    """Removes phone numbers from intermediate text/snippets to guarantee zero phone propagation."""
    return PHONE_REDACTION_RE.sub('[PHONE_EXCLUDED]', text)

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
    email_seen=set()
    for l in content.lines:
        # Standard email match
        for m in EMAIL.finditer(l.text):
            email=m.group(1)
            if email.lower() not in email_seen:
                conf = .70 if re.search(r'[iIl1]{3,}\d+|[a-z]+[A-Z]{2,}', email) else .98
                add(groups,'contact',{'email':(email,l,conf)})
                email_seen.add(email.lower())
        # Handle OCR-damaged emails with internal spaces before @ or domain
        if not email_seen and (l.section in ('header', 'contact') or re.search(r'\b(?:email|mail)\s*:', l.text, re.I)):
            ocr_email_m = re.search(r'(?:email|mail)\s*:\s*([a-zA-Z0-9_.+-]+(?:\s+[a-zA-Z0-9_.+-]+)*\s*@\s*[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', l.text, re.I)
            if ocr_email_m:
                repaired = re.sub(r'\s+', '', ocr_email_m.group(1))
                if repaired.lower() not in email_seen and '@' in repaired and '.' in repaired.split('@')[-1]:
                    add(groups, 'contact', {'email': (repaired, l, .65)})
                    email_seen.add(repaired.lower())
            else:
                m_label = re.search(r'\b(?:email|mail)\s*:\s*(\S+)', l.text, re.I)
                if m_label:
                    raw_cand = m_label.group(1).strip()
                    if '@' not in raw_cand and len(raw_cand) >= 5 and raw_cand.lower() not in email_seen:
                        add(groups, 'contact', {'other_contact': (f'Unverified Email: {raw_cand}', l, .50)})
        # NON-NEGOTIABLE PRIVACY REQUIREMENT:
        # NEVER extract phone or mobile numbers into profile data or contact groups!
        # Mobile extraction logic completely removed.
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

