"""Conservative semantic warnings; never silently alter candidate facts."""
import re
from ..schema import ResumeProfile

def semantic_warnings(profile: ResumeProfile)->list[str]:
    notes=[]
    for group,records in profile.groups.items():
        if group=='extraction_metadata':continue
        identity_keys={'title','full_name','email','canonical_name','normalized_url','qualification','name'}
        seen=set()
        for record in records:
            for key,field in record.fields.items():
                if key in ('start_date','end_date') and re.search(r'\b(?:19|20)\d{2}\b',field.value) is None:
                    notes.append(f'{group}: unusual date format for {key}; review recommended.')
            start=record.fields.get('start_date');end=record.fields.get('end_date')
            if start and end and start.value.isdigit() and end.value.isdigit() and int(start.value)>int(end.value):
                notes.append(f'{group}: start year later than end year; review recommended.')
            for key,field in record.fields.items():
                if key in identity_keys:
                    marker=(key,field.value.strip().lower())
                    if marker in seen:notes.append(f'{group}: possible duplicate {key}; review recommended.')
                    seen.add(marker)
    return list(dict.fromkeys(notes))
