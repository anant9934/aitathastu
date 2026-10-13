"""One authoritative schema. JSON Schema and TypeScript contracts are generated from this file."""
from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator

SCHEMA_VERSION = '2.0'
GROUP_FIELDS: dict[str, tuple[str, ...]] = {
    'identity': ('full_name','professional_headline','professional_identity'),
    'contact': ('email','phone','country_code','location','website','other_contact'),
    'summary': ('professional_summary','career_objective','professional_interest','career_goal'),
    'education': ('qualification','degree_title','institution','board','university','department','specialization','start_date','end_date','expected_graduation','grade','grading_scale','coursework','academic_rank'),
    'experience': ('organization','job_title','employment_type','work_location','work_arrangement','start_date','end_date','current_position','responsibility','contribution','outcome','technologies','evidence_url'),
    'internships': ('provider','role','program','start_date','end_date','duration','responsibility','technologies','skills','completion_status'),
    'skills': ('canonical_name','original_wording','category','sections_found','applied_in','student_confirmation','assessment_status','proficiency'),
    'projects': ('title','description','problem','category','technical_domain','role','contribution','technologies','outcome','start_date','end_date','status','github_url','demo_url','documentation_url','evidence_url'),
    'awards': ('name','type','issuer','event','date','rank','result','participation_status'),
    'certifications': ('title','issuer','credential_id','verification_url','issue_date','expiry_date','skills','training_program','duration','completion_status'),
    'research': ('title','type','research_experience','research_project','authors','authorship_role','venue','year','doi','url','contribution','grant','orcid','scholar_url','publication_status'),
    'books_patents': ('type','title','authors','publisher','isbn','year','inventors','application_number','jurisdiction','filing_date','status'),
    'leadership': ('organization','role','type','start_date','end_date','responsibility','outcome','evidence_url'),
    'digital_footprint': ('platform','original_url','normalized_url','discovery_source','review_status'),
    'extraction_metadata': ('document_id','format','page_count','ocr_attempted','ocr_used','text_quality','processing_seconds','extraction_methods','parser_version','model_version','warnings','processing_status'),
}
GROUP_NAMES = tuple(GROUP_FIELDS)

class ReviewState(str, Enum):
    extracted = 'extracted'
    reviewed = 'reviewed'
    student_confirmed = 'student_confirmed'
    independently_verified = 'independently_verified'
    rejected = 'rejected'
    uncertain = 'uncertain'

class Evidence(BaseModel):
    page: int | None = Field(default=None, ge=1)
    section: str | None = None
    snippet: str = Field(max_length=320)
    method: Literal['native_pdf','ocr','docx','txt','rtf','image','hyperlink','derived']
    block_id: str | None = None

class ReviewEvent(BaseModel):
    action: Literal['accept','correct','reject','uncertain','confirm','verify']
    actor: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    previous_value: str | None = None
    new_value: str | None = None
    previous_state: ReviewState

class ExtractedField(BaseModel):
    value: str = Field(max_length=6000)
    original_value: str = Field(max_length=6000)
    evidence: list[Evidence] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    confidence_kind: Literal['heuristic'] = 'heuristic'
    review_state: ReviewState = ReviewState.extracted
    history: list[ReviewEvent] = Field(default_factory=list)

    @model_validator(mode='after')
    def no_false_verification(self):
        if self.review_state == ReviewState.independently_verified and not any(h.action == 'verify' for h in self.history):
            raise ValueError('Independent verification requires recorded verification event')
        return self

class Record(BaseModel):
    record_id: str
    fields: dict[str, ExtractedField] = Field(default_factory=dict)
    record_state: ReviewState = ReviewState.extracted

class ExtractionMetadata(BaseModel):
    document_id: str
    file_format: str
    page_count: int = Field(ge=0)
    ocr_attempted: bool = False
    ocr_used: bool = False
    text_quality: Literal['good','limited','poor','empty'] = 'empty'
    processing_seconds: float = Field(default=0, ge=0)
    extraction_methods: list[str] = Field(default_factory=list)
    parser_version: str = '1.0.0'
    model_version: str = 'deterministic-1'
    warnings: list[str] = Field(default_factory=list)
    status: Literal['uploaded','queued','processing','completed','partial','failed'] = 'uploaded'
    reviewed_at: datetime | None = None

class ResumeProfile(BaseModel):
    schema_version: Literal['2.0'] = SCHEMA_VERSION
    document_id: str
    groups: dict[str, list[Record]]
    metadata: ExtractionMetadata

    @model_validator(mode='after')
    def validate_groups(self):
        if set(self.groups) != set(GROUP_FIELDS):
            raise ValueError('All 15 canonical groups must be present')
        for name, records in self.groups.items():
            allowed = set(GROUP_FIELDS[name])
            for r in records:
                if unknown := set(r.fields) - allowed:
                    raise ValueError(f'Unexpected fields in {name}: {unknown}')
                for key, field in r.fields.items():
                    if name != 'extraction_metadata' and not field.evidence:
                        raise ValueError(f'Missing source evidence: {name}/{key}')
        return self

class UploadResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    max_pages: int

class ExtractionRequest(BaseModel):
    document_id: str

class ReviewRequest(BaseModel):
    group: str
    record_id: str
    field: str | None = None
    action: Literal['accept','correct','reject','uncertain','confirm','verify']
    corrected_value: str | None = Field(default=None, max_length=6000)
    reviewer_role: Literal['student','reviewer','verifier'] = 'student'

class StatusResponse(BaseModel):
    document_id: str
    status: Literal['uploaded','queued','processing','completed','partial','failed']
    warnings: list[str] = Field(default_factory=list)
    # Machine-readable failure reason, set only when status == 'failed'.
    # OCR_ENGINE_UNAVAILABLE is an infrastructure fault; EXTRACTION_ERROR is anything else.
    error_code: str | None = None

class SectionPreview(BaseModel):
    section: str
    page: int
    text: str

class DocumentView(BaseModel):
    profile: ResumeProfile | None = None
    status: StatusResponse

class ErrorResponse(BaseModel):
    detail: str
