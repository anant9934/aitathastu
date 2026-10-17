"""One local, deterministic processing pipeline; untrusted document text is always data."""
from datetime import datetime, timezone
import time
from ..schema import ResumeProfile,ExtractionMetadata,GROUP_FIELDS
from .common import add,lines_of
from .identity_contact import extract_identity_contact
from .education import extract_education
from .skills import extract_skills
from .history import extract_experience,extract_internships,extract_projects,extract_awards,extract_certifications
from .research import extract_research,extract_books_patents,extract_leadership
from .digital import extract_digital

def extract_profile(content,document_id,started=None):
    started=started or time.perf_counter()
    groups={g:[] for g in GROUP_FIELDS}
    extract_identity_contact(content,groups)
    s=lines_of(content,'summary')
    if s:
        summary=' '.join(l.text for l in s[:12])[:2000]
        add(groups,'summary',{'professional_summary':(summary,s[0],.72)})
    extract_education(content,groups)
    extract_experience(content,groups)
    extract_internships(content,groups)
    extract_skills(content,groups)
    extract_projects(content,groups)
    extract_awards(content,groups)
    extract_certifications(content,groups)
    extract_research(content,groups)
    extract_books_patents(content,groups)
    extract_leadership(content,groups)
    extract_digital(content,groups)
    chars=sum(len(l.text) for l in content.lines)
    quality='empty' if not chars else 'poor' if chars<65 else 'limited' if chars<250 else 'good'
    warnings=list(content.warnings)
    if quality in ('poor','empty'): warnings.append('Limited extracted text: fields may be missing.')
    total=sum(len(v) for k,v in groups.items() if k!='extraction_metadata')
    if not chars:
        status='failed'
    elif quality=='poor' or any('timeout' in w.lower() or 'failed' in w.lower() for w in warnings):
        status='partial'
    else:
        status='completed'
    meta=ExtractionMetadata(document_id=document_id,file_format=content.format,page_count=content.pages,ocr_attempted=content.ocr_attempted,ocr_used=content.ocr_used,text_quality=quality,processing_seconds=round(time.perf_counter()-started,3),extraction_methods=content.methods,warnings=warnings,status=status)
    # Technical metadata is derived by our software, NOT represented as a resume claim.
    from ..document import Line
    source=Line('Derived from document processing',1,'derived','system','system')
    items={'document_id':(document_id,source,1),'format':(content.format,source,1),'page_count':(str(content.pages),source,1),'ocr_attempted':(str(content.ocr_attempted),source,1),'ocr_used':(str(content.ocr_used),source,1),'text_quality':(quality,source,1),'processing_seconds':(str(meta.processing_seconds),source,1),'extraction_methods':(', '.join(content.methods),source,1),'parser_version':(meta.parser_version,source,1),'model_version':(meta.model_version,source,1),'processing_status':(status,source,1)}
    add(groups,'extraction_metadata',items)
    from .validate import semantic_warnings
    profile=ResumeProfile(document_id=document_id,groups=groups,metadata=meta)
    profile.metadata.warnings.extend(semantic_warnings(profile))
    return profile
