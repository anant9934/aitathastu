import re
from .common import detect_skills,category,add,SKILLS

def extract_skills(content,groups):
    found = {} # canonical_name -> (original_wording, line, cat)
    
    # Pass 1: Parse explicit skills section lines
    for line in content.lines:
        if line.section == 'skills':
            clean_text = re.sub(r'^[^\w\s]*\s*', '', line.text).strip()
            cat_hint = None
            list_text = clean_text
            
            # Check for pattern like "Programming: Python, C, Javascript..."
            m = re.match(r'^([A-Za-z\s&/]+)\s*:\s*(.+)$', clean_text)
            if m:
                cat_hint = m.group(1).strip()
                list_text = m.group(2).strip()
            
            tokens = [t.strip(' •*-«+»‘.,;()') for t in re.split(r'[,;/|]', list_text) if t.strip(' •*-«+»‘.,;()')]
            for token in tokens:
                if len(token) < 1 or len(token) > 40:
                    continue
                lower = token.lower()
                canonical = SKILLS.get(lower, token)
                cat = category(canonical)
                if cat == 'Tools & Fundamentals' and cat_hint:
                    cat = cat_hint
                found[canonical] = (token, line, cat)
                
    # Pass 2: In prose sections or other sections, detect skills via taxonomy
    for line in content.lines:
        if line.section not in ('skills','projects','experience','internships','research'):
            if not any(k in line.text.lower() for k in ('software:', 'languages:', 'tools:', 'cms:', 'technologies:', 'skills:')):
                continue
        for skill in detect_skills(line.text):
            if skill not in found:
                found[skill] = (skill, line, category(skill))
            elif line.section == 'skills':
                # Prefer explicit skills section provenance
                orig, _, cat = found[skill]
                found[skill] = (orig, line, cat)

    for skill, (orig, line, cat) in found.items():
        add(groups, 'skills', {
            'canonical_name': (skill, line, .88 if line.section == 'skills' else .82),
            'original_wording': (orig, line, .85 if line.section == 'skills' else .80),
            'category': (cat, line, .80),
            'sections_found': (line.section, line, .95)
        })
