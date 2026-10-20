"""Prints the payload the Render extractor returns for one file, as JSON.

Runs the service's own read_document + extract_profile (the code Render runs),
so the evaluation exercises the production OCR path rather than a re-implementation:
    {"raw_text", "pages", "ocr_used", "profile", "warnings", "seconds"}

    services/resume-extractor/.venv/bin/python -I eval/cv/ocr_payload.py FILE [--force-ocr]
"""
import json
import sys
import time
from dataclasses import asdict
from pathlib import Path

SERVICE = Path(__file__).resolve().parents[2] / 'services' / 'resume-extractor'
sys.path.insert(0, str(SERVICE))

from app.config import Settings  # noqa: E402
from app.document import read_document  # noqa: E402
from app.extraction.pipeline import extract_profile  # noqa: E402

FORMATS = {'.pdf': 'pdf', '.docx': 'docx', '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpeg'}


def main():
    path = Path(sys.argv[1])
    force = '--force-ocr' in sys.argv
    started = time.perf_counter()
    content = read_document(path.read_bytes(), FORMATS[path.suffix.lower()], Settings(), force_ocr=force)
    profile = extract_profile(content, 'eval-doc', started)
    lines = [asdict(l) for l in content.lines]
    print(json.dumps({
        'raw_text': '\n'.join(l['text'] for l in lines if (l.get('text') or '').strip()),
        'pages': content.layout,
        'ocr_used': content.ocr_used,
        'profile': profile.model_dump(mode='json'),
        'warnings': content.warnings,
        'seconds': round(time.perf_counter() - started, 3),
    }))


if __name__ == '__main__':
    main()
