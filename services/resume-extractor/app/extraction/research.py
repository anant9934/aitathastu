"""Research/publications, patents, books and civic contributions: conservative parsing."""
import re
from .common import add,lines_of,years,DOI,URL

def extract_research(content,groups):
    for l in lines_of(content,'research'):
        t=l.text.lstrip(' -•*')
        if len(t)<6:continue
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
    for l in lines_of(content,'books_patents'):
        t=l.text.lstrip(' -•*');
        if len(t)<6:continue
        typ='patent' if re.search(r'patent|invent|application|filing',t,re.I) else 'book'
        fields={'type':(typ,l,.77),'title':(t,l,.67)}
        if m:=re.search(r'\b(?:97[89][-\s]?)?\d{9}[\dX]\b',t,re.I): fields['isbn']=(m.group(0),l,.82)
        if re.search(r'filed|pending|granted|published|application',t,re.I):fields['status']=(t,l,.79)
        a,_=years(t)
        if a:fields['year']=(a,l,.72)
        add(groups,'books_patents',fields)

def extract_leadership(content,groups):
    for l in lines_of(content,'leadership'):
        t=l.text.lstrip(' -•*')
        if len(t)<5:continue
        fields={'role':(t,l,.74)}
        if re.search(r'volunteer|mentor|teach',t,re.I):fields['type']=('volunteering / mentoring',l,.77)
        if re.search(r'president|leader|coordinator|secretary',t,re.I): fields['type']=('leadership',l,.80)
        a,b=years(t)
        if a:fields['start_date']=(a,l,.72)
        if b:fields['end_date']=(b,l,.72)
        add(groups,'leadership',fields)
