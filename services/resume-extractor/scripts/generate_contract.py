"""Generate JSON Schema and TypeScript types from the sole Pydantic v2 contract."""
import sys, types,typing
from pathlib import Path
from datetime import datetime
from enum import Enum
from pydantic import BaseModel
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.schema import ResumeProfile,ReviewEvent,Evidence,ExtractedField,Record,ExtractionMetadata,UploadResponse,ExtractionRequest,ReviewRequest,StatusResponse,SectionPreview,DocumentView,ReviewState,GROUP_FIELDS

root=Path(__file__).resolve().parents[2]
(root/'contracts').mkdir(exist_ok=True)
import json
(root/'contracts/resume-profile-v2.schema.json').write_text(json.dumps(ResumeProfile.model_json_schema(),indent=2),encoding='utf8')
models=[Evidence,ReviewEvent,ExtractedField,Record,ExtractionMetadata,ResumeProfile,UploadResponse,ExtractionRequest,ReviewRequest,StatusResponse,SectionPreview,DocumentView]

def ts(t):
    origin=typing.get_origin(t)
    args=typing.get_args(t)
    if origin in (typing.Union,types.UnionType): return ' | '.join(ts(x) for x in args)
    if origin==typing.Literal:return ' | '.join(json.dumps(x) for x in args)
    if origin in (list,tuple):return f'Array<{ts(args[0])}>'
    if origin==dict:return f'Record<{ts(args[0])}, {ts(args[1])}>'
    if t is str:return 'string'
    if t in (int,float):return 'number'
    if t is bool:return 'boolean'
    if t is datetime:return 'string'
    if t is type(None):return 'null'
    if isinstance(t,type) and issubclass(t,Enum):return t.__name__
    if isinstance(t,type) and issubclass(t,BaseModel):return 'ExtractedRecord' if t.__name__=='Record' else t.__name__
    return 'unknown'

s=['// AUTO-GENERATED from backend/app/schema.py. Do not edit by hand.','/* Run: python backend/scripts/generate_contract.py */',"export type ReviewState = " + ' | '.join(json.dumps(e.value) for e in ReviewState) + ';']
for model in models:
    name='ExtractedRecord' if model.__name__=='Record' else model.__name__
    s.append(f'export interface {name} '+'{')
    for key,f in model.model_fields.items():
        is_required=f.is_required()
        s.append(f'  {key}: {ts(f.annotation)};')
    s.append('}')
s += ['export type Profile = ResumeProfile;', 'export type Metadata = ExtractionMetadata;', 'export type RecordData = ExtractedRecord;']
(root/'frontend/lib/types.ts').write_text('\n'.join(s)+'\n',encoding='utf8')
print('Generated JSON Schema and TypeScript contract')
