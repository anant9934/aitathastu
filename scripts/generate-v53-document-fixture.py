"""Generate a synthetic PDF whose visible glyphs are vector paths, with no text layer."""
from io import BytesIO
from pathlib import Path
import sys
import pymupdf
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont

if len(sys.argv) > 2 and sys.argv[2] == "docx":
    from docx import Document
    document = Document()
    for line in ("ASHA MEHTA", "EDUCATION", "B.Tech Computer Science, Example University", "EXPERIENCE", "Intern at Example Labs", "PROJECTS", "Solar Energy Forecasting", "SKILLS", "Python, SQL, PyTorch"):
        document.add_paragraph(line)
    document.save(sys.argv[1])
    raise SystemExit(0)

if len(sys.argv) > 2 and sys.argv[2] == "mixed":
    source = BytesIO()
    page = canvas.Canvas(source, pagesize=(750, 300))
    page.setFont("Helvetica-Bold", 28)
    page.drawString(30, 250, "ASHA MEHTA EDUCATION BTECH COMPUTER SCIENCE")
    page.drawString(30, 190, "NATIVE TEXT LAYER FIRST PAGE")
    page.showPage()
    image = Image.new("RGB", (1500, 600), "white")
    painter = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=70)
    painter.text((70, 80), "PROJECTS", fill="black", font=font)
    painter.text((70, 200), "SOLAR ENERGY FORECASTING", fill="black", font=font)
    encoded = BytesIO()
    image.save(encoded, format="PNG")
    encoded.seek(0)
    page.drawImage(ImageReader(encoded), 0, 0, width=750, height=300)
    page.showPage()
    page.save()
    Path(sys.argv[1]).write_bytes(source.getvalue())
    raise SystemExit(0)

source = BytesIO()
page = canvas.Canvas(source, pagesize=(750, 300))
page.setFont("Helvetica-Bold", 35)
for index, line in enumerate(("ASHA MEHTA", "EDUCATION BTECH COMPUTER SCIENCE", "SKILLS PYTHON SQL")):
    page.drawString(30, 250 - index * 75, line)
page.showPage()
page.save()
with pymupdf.open(stream=source.getvalue(), filetype="pdf") as text_pdf:
    vector_svg = text_pdf[0].get_svg_image(text_as_path=True).encode()
with pymupdf.open(stream=vector_svg, filetype="svg") as vector_document:
    outlined_pdf = vector_document.convert_to_pdf()
with pymupdf.open(stream=outlined_pdf, filetype="pdf") as verification:
    assert not verification[0].get_text().strip(), "fixture unexpectedly has a text layer"
Path(sys.argv[1]).write_bytes(outlined_pdf)
