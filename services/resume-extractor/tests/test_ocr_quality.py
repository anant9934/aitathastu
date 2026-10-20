"""OCR pages report Tesseract word confidence so callers can hold weak pages for review."""
import random

import pytest
from PIL import Image, ImageDraw

from app.document import _ocr


def _tesseract_available():
    import pytesseract
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _tesseract_available(), reason='Tesseract is not installed in this environment')


def _page(text_lines, noise=0.0):
    im = Image.new('RGB', (1240, 900), 'white')
    d = ImageDraw.Draw(im)
    for i, line in enumerate(text_lines):
        d.text((60, 60 + i * 40), line, fill='black', font_size=26)
    if noise:
        rnd = random.Random(7)
        px = im.load()
        for _ in range(int(im.width * im.height * noise)):
            x, y = rnd.randrange(im.width), rnd.randrange(im.height)
            px[x, y] = (0, 0, 0)
    return im


def test_clean_page_reports_high_mean_confidence_and_per_word_scores():
    warnings = []
    lines, layout = _ocr(_page(['Priya Raghavan', 'Senior Backend Engineer', 'EXPERIENCE', 'Cobalt Logistics 2018 - 2021']), 1, 20, warnings)
    assert lines
    q = layout['quality']
    assert q['words'] >= 8
    assert 0.75 <= q['mean_confidence'] <= 1.0
    assert all(0.0 <= s['conf'] <= 1.0 for s in layout['spans'])
    assert not any('confidence is low' in w for w in warnings)


def test_noisy_page_is_flagged_low_confidence():
    warnings = []
    _, layout = _ocr(_page(['Priya Raghavan', 'Senior Backend Engineer'], noise=0.08), 1, 20, warnings)
    q = layout['quality']
    assert q['words'] == 0 or q['mean_confidence'] < 0.8
    if q['words'] and q['mean_confidence'] < 0.65:
        assert any('confidence is low' in w for w in warnings)
