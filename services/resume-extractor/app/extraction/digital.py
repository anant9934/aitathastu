import re
from urllib.parse import urlsplit
from .common import add,url_pairs,normalize_url,PLATFORMS

def extract_digital(content,groups):
    found=set()
    
    # 1. OCR-resilient handle and URL pattern matching across document lines
    for line in content.lines:
        t = line.text.strip()
        
        # LinkedIn pattern (including OCR typo .comy or spaces)
        li_m = re.search(r'linkedin[\s.]*com[y]?[\s/]+(?:in|pub)[\s/]+([a-zA-Z0-9_\-\.]+)', t, re.I)
        if not li_m and re.search(r'\blinkedin\b', t, re.I):
            li_label_m = re.search(r'(?:linkedin|linked\s*in)\s*:\s*(?:https?:\/\/)?(?:www\.)?(?:linkedin[\s.]*com[y]?\/in\/)?([a-zA-Z0-9_\-\.]+)', t, re.I)
            if li_label_m and not re.search(r'\b(?:email|mobile|phone|gittub|github)\b', li_label_m.group(1), re.I):
                li_m = li_label_m
        if li_m:
            handle = li_m.group(1).strip().split()[0].rstrip('.,);]>')
            norm = f"https://linkedin.com/in/{handle}"
            if norm not in found:
                add(groups,'digital_footprint',{'platform':('LinkedIn',line,.95),'original_url':(li_m.group(0),line,.90),'normalized_url':(norm,line,.95),'discovery_source':('visible',line,.98),'review_status':('unreviewed',line,.99)})
                found.add(norm)

        # GitHub pattern (including OCR typo Gittubs, github com, or spaces)
        gh_m = re.search(r'(?:github|gittub|gittubs)[\s.:/]+(?:github[\s.]*com[\s/]*)?([a-zA-Z0-9_\-\.]+)', t, re.I)
        if gh_m:
            raw_handle = gh_m.group(1).strip()
            # If OCR split the handle across spaces, e.g. shiviii5 165
            after_text = t[gh_m.end():].strip()
            if after_text and re.match(r'^[a-zA-Z0-9_\-]+', after_text) and not any(kw in after_text.lower() for kw in ['email', 'mobile', 'phone', 'linkedin']):
                extra_token = after_text.split()[0]
                handle = (raw_handle + extra_token).strip()
            else:
                handle = raw_handle.split()[0].strip()
            handle = re.sub(r'[^\w\-]', '', handle)
            if handle and len(handle) >= 3 and not handle.lower() in ('com', 'www', 'http', 'https'):
                norm = f"https://github.com/{handle}"
                if norm not in found:
                    add(groups,'digital_footprint',{'platform':('GitHub',line,.95),'original_url':(gh_m.group(0),line,.90),'normalized_url':(norm,line,.95),'discovery_source':('visible',line,.98),'review_status':('unreviewed',line,.99)})
                    found.add(norm)

    # 2. Standard URL pairs
    for raw,line,source in url_pairs(content):
        # Quick clean for OCR domain typos
        cleaned_raw = re.sub(r'linkedin\.comy', 'linkedin.com', raw, flags=re.I)
        cleaned_raw = re.sub(r'github\s+com', 'github.com', cleaned_raw, flags=re.I)
        norm=normalize_url(cleaned_raw)
        if not norm or norm in found: continue
        host=urlsplit(norm).hostname or ''
        platform=next((p for domain,p in PLATFORMS.items() if host==domain or host.endswith('.'+domain)), None)
        if not platform:
            if 'linkedin' in host or 'linkedin.com' in norm: platform = 'LinkedIn'
            elif 'github' in host or 'github.com' in norm: platform = 'GitHub'
            else: platform = 'Portfolio / Other'
        add(groups,'digital_footprint',{'platform':(platform,line,.98),'original_url':(raw,line,.96),'normalized_url':(norm,line,.94),'discovery_source':(source,line,.98),'review_status':('unreviewed',line,.99)})
        found.add(norm)
