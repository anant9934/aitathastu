from urllib.parse import urlsplit
from .common import add,url_pairs,normalize_url,PLATFORMS

def extract_digital(content,groups):
    found=set()
    for raw,line,source in url_pairs(content):
        norm=normalize_url(raw)
        if not norm or norm in found: continue
        host=urlsplit(norm).hostname or ''
        platform=next((p for domain,p in PLATFORMS.items() if host==domain or host.endswith('.'+domain)), 'Portfolio / Other')
        add(groups,'digital_footprint',{'platform':(platform,line,.98),'original_url':(raw,line,.96),'normalized_url':(norm,line,.94),'discovery_source':(source,line,.98),'review_status':('unreviewed',line,.99)})
        found.add(norm)
