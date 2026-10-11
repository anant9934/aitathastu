from .common import detect_skills,category,add

def extract_skills(content,groups):
    found={}
    for line in content.lines:
        if line.section not in ('skills','projects','experience','internships','research'): continue
        # In prose, only count exact dictionary matches and label where observed.
        for skill in detect_skills(line.text):
            prev=found.get(skill)
            if not prev or line.section=='skills': found[skill]=line
    for skill,line in found.items():
        add(groups,'skills',{'canonical_name':(skill,line,.82),'original_wording':(skill,line,.80),'category':(category(skill),line,.80),'sections_found':(line.section,line,.95)})
