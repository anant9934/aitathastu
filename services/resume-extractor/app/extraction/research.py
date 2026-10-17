"""Research/publications, patents, books and civic contributions: conservative parsing."""
import re
from .common import add,lines_of,years,DOI,URL

def extract_research(content,groups):
    for l in lines_of(content,'research'):
        t=l.text.lstrip(' -•*»')
        if len(t)<6:continue
        # Check if this research line is explicitly a patent or book
        if re.search(r'^\s*patent\s*[:\-]', t, re.I):
            clean_t = re.sub(r'^\s*patent\s*[:\-]\s*', '', t, flags=re.I)
            add(groups, 'books_patents', {'type': ('patent', l, .88), 'title': (clean_t, l, .80), 'status': ('patent application / filing', l, .82)})
            continue
        elif re.search(r'^\s*book\s*[:\-]', t, re.I):
            clean_t = re.sub(r'^\s*book\s*[:\-]\s*', '', t, flags=re.I)
            add(groups, 'books_patents', {'type': ('book', l, .88), 'title': (clean_t, l, .80)})
            continue

        fields={'title':(t,l,.70)}
        if 'doi' in t.lower() or DOI.search(t):
            d=DOI.search(t)
            if d: fields['doi']=(d.group(0),l,.95)
        if u:=URL.search(t):fields['url']=(u.group(0),l,.85)
        if re.search(r'under review|submitted|preprint|accepted|published|in preparation',t,re.I):fields['publication_status']=(t,l,.79)
        if re.search(r'poster|conference|journal|paper|manuscript',t,re.I): fields['type']=(t,l,.70)
        a,_=years(t)
        if a:fields['year']=(a,l,.75)
        add(groups,'research',fields)

def extract_books_patents(content,groups):
    seq = lines_of(content, 'books_patents')
    if not seq: return
    chunks = []; current = []
    for l in seq:
        text = l.text.strip()
        is_bullet = bool(re.match(r'^\s*[-•*»©°«+·◦–—]\s*', text))
        has_tag = bool(re.match(r'^\s*(?:patent|book|publication)\s*[:\-]', text, re.I))
        if current and (is_bullet or has_tag):
            chunks.append(current)
            current = []
        current.append(l)
    if current: chunks.append(current)

    for chunk in chunks:
        full_text = ' '.join(l.text.strip(' -•*»') for l in chunk)
        if len(full_text) < 6: continue
        primary = chunk[0]
        is_patent = bool(re.search(r'patent|invent|application|filing', full_text, re.I))
        typ = 'patent' if is_patent else 'book'
        clean_title = re.sub(r'^(?:patent|book)\s*[:\-]\s*', '', full_text, flags=re.I).strip()
        fields = {'type': (typ, primary, .88), 'title': (clean_title or full_text, primary, .80)}
        if is_patent:
            fields['status'] = (full_text, primary, .85)
        if m := re.search(r'\b(?:97[89][-\s]?)?\d{9}[\dX]\b', full_text, re.I):
            fields['isbn'] = (m.group(0), primary, .82)
        a, _ = years(full_text)
        if a: fields['year'] = (a, primary, .72)
        add(groups, 'books_patents', fields)

def extract_leadership(content,groups):
    seq = lines_of(content, 'leadership')
    if not seq: return
    chunks = []; current = []
    for l in seq:
        text = l.text.strip()
        is_bullet = bool(re.match(r'^\s*[-•*»©°«+·◦–—]\s*', text))
        has_date = bool(re.search(r'\b(?:19|20)\d{2}\b', text) and ('-' in text or '/' in text))
        curr_has_content = len(current) >= 2
        if current and ((is_bullet and len(current) >= 1) or (has_date and curr_has_content)):
            chunks.append(current)
            current = []
        current.append(l)
    if current: chunks.append(current)

    for chunk in chunks:
        role_l = None
        org_l = None
        loc_l = None
        for l in chunk:
            t = l.text.strip(' -•*«»[]§()')
            if re.search(r'\b(?:suva|fiji|london|uk|usa|india|remote|hybrid|chichester|bihar|punjab)\b', t, re.I):
                loc_l = l
            if re.search(r'\b(?:tutor|volunteer|mentor|president|coordinator|leader|secretary|head|advisor|officer|co-founder)\b', t, re.I) and not role_l:
                role_l = l
            elif not org_l and len(t) >= 3 and not re.search(r'\b(?:19|20)\d{2}\b', t) and not re.search(r'\b(?:suva|fiji|london)\b', t, re.I):
                org_l = l

        role_text = role_l.text.strip(' -•*«»[]§()') if role_l else (chunk[0].text.strip(' -•*«»[]§()'))
        fields = {'role': (role_text, role_l or chunk[0], .80)}
        if org_l and org_l != role_l:
            clean_org = org_l.text.strip(' -•*«»[]§()')
            clean_org = re.sub(r'\b(?:19|20)\d{2}\b.*$', '', clean_org).strip(' ,;-')
            if clean_org:
                fields['organization'] = (clean_org, org_l, .80)
        if loc_l and 'responsibility' not in fields:
            m_loc = re.search(r'\b(?:suva[,\s]+fiji|london[,\s]+united kingdom|remote|hybrid)\b', loc_l.text, re.I)
            loc_val = m_loc.group(0) if m_loc else loc_l.text.strip(' -•*«»[]§()')
            fields['responsibility'] = (loc_val, loc_l, .75)
        for l in chunk:
            a, b = years(l.text)
            if a and 'start_date' not in fields: fields['start_date'] = (a, l, .75)
            if b: fields['end_date'] = (b, l, .75)
        fields['type'] = ('volunteering' if re.search(r'volunteer|tutor|mentor', role_text, re.I) else 'leadership', role_l or chunk[0], .80)
        add(groups, 'leadership', fields)
