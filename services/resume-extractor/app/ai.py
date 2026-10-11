"""Future optional, explicitly enabled AI extraction contract; no external calls in baseline."""
from typing import Protocol
from .schema import Record,ResumeProfile

class OptionalExtractionProvider(Protocol):
    name: str
    def suggest_records(self, group: str, source_text: str) -> list[Record]:
        """Return untrusted suggestions, to be schema validated and human reviewed."""

class DisabledProvider:
    name='disabled'
    def suggest_records(self, group: str, source_text: str) -> list[Record]:
        return []

def validate_provider_profile(profile: dict) -> ResumeProfile:
    """Reject schema-incompatible provider output; never mark it factually verified."""
    return ResumeProfile.model_validate(profile)
