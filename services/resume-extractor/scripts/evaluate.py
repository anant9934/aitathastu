"""Reproducible exact-match evaluation on 15 explicitly labelled synthetic resumes."""
import sys,json,time,re
from collections import defaultdict
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root));sys.path.insert(0,str(root/'tests'))
from test_fixtures import NAMES,two_column_pdf,scan_png,fresher_txt
from app.document import read_document
from app.extraction.pipeline import extract_profile
from app.config import settings

# Ground truth authored separately from predictions (known synthetic source content).
def truth(i,mode):
    base={'identity.full_name':{NAMES[i]},'education.qualification':{'B.Tech'},'skills.canonical_name':{'Python','SQL','PyTorch'}}
    if mode in ('two_column','fresher'):base['education.qualification']|={'Class 12','Class 10'}
    if mode=='two_column':base['contact.email']={'candidate@example.com'};base['projects.title']={f'Project {i+1}'}
    if mode=='fresher':base['contact.email']={f'fresher{i}@example.com'}
    return base

def levenshtein(a,b):
    dp=list(range(len(b)+1))
    for i,ac in enumerate(a,1):
        new=[i]
        for j,bc in enumerate(b,1):new.append(min(new[-1]+1,dp[j]+1,dp[j-1]+int(ac!=bc)))
        dp=new
    return dp[-1]

def expected_ocr(i):
    return f'{NAMES[i]} EDUCATION B.Tech Computer Science 2022 - 2026 TECHNICAL SKILLS Python, SQL, PyTorch'

scores=defaultdict(lambda:{'tp':0,'fp':0,'fn':0})
seconds=[];wer=[];cer=[];tested=[];valid=0
for mode in ('two_column','scanned','fresher'):
    for i in range(5):
        data,fmt=(two_column_pdf(i),'pdf') if mode=='two_column' else ((scan_png(i),'png') if mode=='scanned' else (fresher_txt(i),'txt'))
        start=time.perf_counter()
        content=read_document(data,fmt,settings)
        profile=extract_profile(content,f'eval-{mode}-{i}',start)
        seconds.append(time.perf_counter()-start)
        from app.schema import ResumeProfile
        ResumeProfile.model_validate(profile.model_dump(mode='json'))
        valid+=1
        for key,correct in truth(i,mode).items():
            group,field=key.split('.')
            values={f.value.strip() for row in profile.groups[group] for k,f in row.fields.items() if k==field}
            scores[key]['tp']+=len(values & correct)
            scores[key]['fp']+=len(values - correct)
            scores[key]['fn']+=len(correct - values)
        if mode=='scanned':
            predicted=' '.join(l.text for l in content.lines)
            normal=lambda s:re.sub(r'\s+',' ',s.lower()).strip()
            a=normal(expected_ocr(i));b=normal(predicted)
            wer.append(levenshtein(a.split(),b.split())/max(1,len(a.split())))
            cer.append(levenshtein(a,b)/max(1,len(a)))
        tested.append({'case':f'{mode}-{i}','status':profile.metadata.status,'ocr_used':profile.metadata.ocr_used,'processing_seconds':round(seconds[-1],3)})

def calc(m):
    p=m['tp']/max(1,m['tp']+m['fp']);r=m['tp']/max(1,m['tp']+m['fn']);return {'precision':round(p,3),'recall':round(r,3),'f1':round(2*p*r/(p+r) if p+r else 0,3),'tp':m['tp'],'fp':m['fp'],'fn':m['fn']}
report={'dataset':'15 authored synthetic test documents: 5 two-column PDF, 5 image OCR, 5 fresher TXT','scope':'Only explicitly labeled and listed field groups; not a universal extraction benchmark','evaluated_field_groups':{k:calc(v) for k,v in scores.items()},'ocr_word_error_rate_avg':round(sum(wer)/len(wer),3),'ocr_character_error_rate_avg':round(sum(cer)/len(cer),3),'valid_schema_profiles':valid,'processing_seconds_mean':round(sum(seconds)/len(seconds),3),'processing_seconds_max':round(max(seconds),3),'cost_usd_external_api':0,'cases':tested}
out=Path(__file__).resolve().parents[2]/'docs/fixture-evaluation.json'
out.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='cases'},indent=2))
