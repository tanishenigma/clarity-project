"""
PYQ Dataset Builder
====================
Crawls a root folder of scanned exam PDFs, OCRs each one, parses
exam metadata + individual questions, and writes a clean JSONL dataset.

Usage:
    python build_pyq_dataset.py --root "./Minor Project" --out pyq_dataset.jsonl

    # If tesseract is not on PATH, point to it directly:
    python build_pyq_dataset.py --root "./Minor Project" --out pyq_dataset.jsonl \
        --tesseract "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

Requirements:
    pip install pytesseract Pillow pymupdf pypdf
    Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki
"""

import re
import sys
import json
import argparse
import hashlib
import subprocess
import tempfile
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict

# PyMuPDF - primary rasteriser, handles Windows long paths natively
try:
    import fitz
    FITZ_AVAILABLE = True
except ImportError:
    FITZ_AVAILABLE = False

# pytesseract + Pillow
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("[WARN] pytesseract/Pillow not found. Run: pip install pytesseract Pillow")

# pypdf - fast native text extraction for non-scanned PDFs
try:
    from pypdf import PdfReader
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False


# ---------------------------------------------------------------------------
# Tesseract path setup
# ---------------------------------------------------------------------------

# All plausible Windows install locations to try
_TESS_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Tesseract-OCR\tesseract.exe",
    r"C:\tools\Tesseract-OCR\tesseract.exe",
    r"C:\tools\tesseract\tesseract.exe",
    r"C:\ProgramData\chocolatey\bin\tesseract.exe",
    r"C:\msys64\mingw64\bin\tesseract.exe",
    r"C:\msys64\usr\bin\tesseract.exe",
]
# Also check all user-profile sub-paths
for _drive in ["C:", "D:"]:
    for _sub in [r"\Users", r"\Users\admin", r"\Users\Public"]:
        for _app in [r"\AppData\Local\Programs\Tesseract-OCR",
                     r"\AppData\Local\Tesseract-OCR",
                     r"\AppData\Roaming\Tesseract-OCR"]:
            _TESS_CANDIDATES.append(_drive + _sub + _app + r"\tesseract.exe")


def setup_tesseract(explicit_path: str = "") -> bool:
    """
    Locate and configure the Tesseract binary.
    Returns True if found, False otherwise.
    Priority: explicit CLI arg > TESSERACT_PATH env var > PATH > common locations.
    """
    if not OCR_AVAILABLE:
        return False

    candidates = []

    if explicit_path:
        candidates.append(explicit_path)

    if os.environ.get("TESSERACT_PATH"):
        candidates.append(os.environ["TESSERACT_PATH"])

    # Try calling 'tesseract' directly (i.e. it IS on PATH)
    try:
        result = subprocess.run(
            ["tesseract", "--version"],
            capture_output=True, timeout=5
        )
        if result.returncode == 0:
            print("[INFO] Tesseract found on system PATH")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Scan common Windows locations
    candidates.extend(_TESS_CANDIDATES)

    # Also search all user profile directories dynamically
    if sys.platform == "win32":
        users_dir = Path(r"C:\Users")
        if users_dir.exists():
            for user_dir in users_dir.iterdir():
                for sub in [
                    r"AppData\Local\Programs\Tesseract-OCR",
                    r"AppData\Local\Tesseract-OCR",
                ]:
                    candidates.append(str(user_dir / sub / "tesseract.exe"))

    for path in candidates:
        if path and os.path.isfile(path):
            pytesseract.pytesseract.tesseract_cmd = path
            print(f"[INFO] Tesseract found at: {path}")
            return True

    return False


# ---------------------------------------------------------------------------
# Windows long-path helper
# ---------------------------------------------------------------------------

def win_long_path(path: Path) -> str:
    r"""Prepend \\?\ on Windows to bypass the 260-char MAX_PATH limit."""
    if sys.platform == "win32":
        abs_str = str(path.resolve())
        if not abs_str.startswith("\\\\?\\"):
            abs_str = "\\\\?\\" + abs_str
        return abs_str
    return str(path)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ExamMeta:
    university:  str           = ""
    exam_year:   str           = ""
    semester:    str           = ""
    exam_type:   str           = ""
    exam_month:  str           = ""
    program:     str           = ""
    course_code: str           = ""
    course_name: str           = ""
    departments: List[str]     = field(default_factory=list)
    max_marks:   Optional[int] = None
    max_time:    str           = ""
    source_pdf:  str           = ""
    raw_text:    str           = ""


@dataclass
class Question:
    question_no:   int           = 0
    question_text: str           = ""
    marks:         Optional[int] = None
    co:            str           = ""


# ---------------------------------------------------------------------------
# Path-based metadata inference
# ---------------------------------------------------------------------------

SEMESTER_PATTERNS = {"even": "EVEN SEMESTER", "odd": "ODD SEMESTER"}
EXAM_TYPE_PATTERNS = {r"t-?1": "T-1", r"t-?2": "T-2", r"t-?3": "T-3"}
MONTH_PATTERNS = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
]
PROGRAM_PATTERNS = {
    "b.tech":"B.Tech","b tech":"B.Tech","btech":"B.Tech",
    "m.tech":"M.Tech","m tech":"M.Tech",
    "m.sc":"M.Sc","msc":"M.Sc",
    "ph.d":"Ph.D","phd":"Ph.D",
    "bca":"BCA","bba":"BBA",
}
DEPT_ALIASES = {
    "cse":"CSE","it":"IT","ece":"ECE",
    "civil":"Civil","ce":"Civil",
    "bt":"BT","bi":"BI",
    "hss":"HSS","math":"Math",
    "phy":"Physics","physics":"Physics",
    "vlsi":"VLSI","ecs":"ECS","ee":"EE",
}


def infer_meta_from_path(pdf_path: Path) -> ExamMeta:
    meta = ExamMeta(source_pdf=str(pdf_path))
    full_lower = "/".join(p.lower() for p in pdf_path.parts)

    yr = re.search(r"\b(20\d{2})\b", full_lower)
    if yr:
        meta.exam_year = yr.group(1)

    for key, val in SEMESTER_PATTERNS.items():
        if key in full_lower:
            meta.semester = val
            break

    for pat, val in EXAM_TYPE_PATTERNS.items():
        if re.search(pat, full_lower):
            meta.exam_type = val
            break

    for m in MONTH_PATTERNS:
        if m in full_lower:
            meta.exam_month = m.capitalize()
            break

    for pat, val in PROGRAM_PATTERNS.items():
        if pat in full_lower:
            meta.program = val
            break

    fname_clean = re.sub(r"[,\-_\(\)\.]", " ", pdf_path.stem.lower())
    depts = []
    for alias, canonical in DEPT_ALIASES.items():
        if re.search(r"\b" + re.escape(alias) + r"\b", fname_clean):
            if canonical not in depts:
                depts.append(canonical)
    meta.departments = depts

    cc = re.search(r"\b(\d{2}[A-Z]\w{2,4}\d{3})\b", pdf_path.stem, re.I)
    if cc:
        meta.course_code = cc.group(1).upper()

    return meta


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def _rasterise_fitz(pdf_path: Path, dpi: int) -> List:
    doc = fitz.open(win_long_path(pdf_path))
    mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        images.append(img)
    doc.close()
    return images


def _rasterise_pdftoppm(pdf_path: Path, dpi: int) -> List:
    with tempfile.TemporaryDirectory() as tmpdir:
        prefix = os.path.join(tmpdir, "page")
        result = subprocess.run(
            ["pdftoppm", "-jpeg", "-r", str(dpi), str(pdf_path), prefix],
            capture_output=True
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode(errors="replace")[:300])
        images = [Image.open(f).copy()
                  for f in sorted(Path(tmpdir).glob("page-*.jpg"))]
    return images


def ocr_pdf(pdf_path: Path, dpi: int = 300) -> str:
    if not OCR_AVAILABLE:
        return ""
    images = _rasterise_fitz(pdf_path, dpi) if FITZ_AVAILABLE \
             else _rasterise_pdftoppm(pdf_path, dpi)
    pages_text = [pytesseract.image_to_string(img, lang="eng") for img in images]
    return "\n\n--- PAGE BREAK ---\n\n".join(pages_text)


def try_native_text(pdf_path: Path) -> str:
    if not PYPDF_AVAILABLE:
        return ""
    try:
        reader = PdfReader(win_long_path(pdf_path))
        parts = [page.extract_text() or "" for page in reader.pages]
        combined = "\n".join(parts).strip()
        return combined if len(combined) > 50 else ""
    except Exception:
        return ""


def extract_text(pdf_path: Path, dpi: int = 300) -> str:
    text = try_native_text(pdf_path)
    if text:
        return text
    print("  -> OCR-ing {} ...".format(pdf_path.name))
    return ocr_pdf(pdf_path, dpi=dpi)


# ---------------------------------------------------------------------------
# Text-level metadata refinement
# ---------------------------------------------------------------------------

UNIVERSITY_PATTERNS = [
    r"(?i)(jaypee university[^\n]+)",
    r"(?i)(jawaharlal nehru[^\n]+university[^\n]*)",
    r"(?i)([A-Z][A-Z\s]{5,}university[^\n]{0,60})",
]
COURSE_CODE_RE = re.compile(r"(?i)course\s+code[^:]*:\s*([A-Z0-9]{6,15})")
COURSE_NAME_RE = re.compile(r"(?i)course\s+name[^:]*:\s*(.+?)(?:\n|$)")
MAX_MARKS_RE   = re.compile(r"(?i)max[\.\s]*marks\s*[:\-]?\s*(\d+)")
MAX_TIME_RE    = re.compile(r"(?i)max[\.\s]*time\s*[:\-]?\s*([^\n]{3,30})")
DEPT_HEADER_RE = re.compile(r"\(([A-Z][A-Z/,\s\-]{2,60})\)", re.I)


def refine_meta_from_text(meta: ExamMeta, text: str) -> ExamMeta:
    if not text:
        return meta

    if not meta.university:
        for pat in UNIVERSITY_PATTERNS:
            m = re.search(pat, text)
            if m:
                meta.university = m.group(1).strip()
                break

    if not meta.course_code:
        m = COURSE_CODE_RE.search(text)
        if m:
            meta.course_code = m.group(1).strip().upper()

    if not meta.course_name:
        m = COURSE_NAME_RE.search(text)
        if m:
            meta.course_name = m.group(1).strip().title()

    if meta.max_marks is None:
        m = MAX_MARKS_RE.search(text)
        if m:
            try:
                meta.max_marks = int(m.group(1))
            except ValueError:
                pass

    if not meta.max_time:
        m = MAX_TIME_RE.search(text)
        if m:
            meta.max_time = m.group(1).strip()

    if not meta.departments:
        m = DEPT_HEADER_RE.search(text[:600])
        if m:
            raw = re.split(r"[/,]", m.group(1))
            meta.departments = [
                DEPT_ALIASES.get(d.strip().lower(), d.strip())
                for d in raw if d.strip()
            ]

    if not meta.exam_type:
        for pat, val in EXAM_TYPE_PATTERNS.items():
            if re.search(pat, text, re.I):
                meta.exam_type = val
                break

    if not meta.exam_year:
        yr = re.search(r"\b(20\d{2})\b", text[:400])
        if yr:
            meta.exam_year = yr.group(1)

    return meta


# ---------------------------------------------------------------------------
# Question parsing
# ---------------------------------------------------------------------------

Q_START_RE = re.compile(
    r"(?im)^\s*(?:Q\.?\s*)?(\d{1,2})[.)]\s+(.+?)"
    r"(?=\n\s*(?:Q\.?\s*)?\d{1,2}[.)]\s|\Z)",
    re.DOTALL
)
MARKS_RE = re.compile(r"\[(\d+)\]")
CO_RE    = re.compile(r"\[CO[-\s]?(\d+)\]", re.I)


def parse_questions(text: str) -> List[Question]:
    questions = []
    for match in Q_START_RE.finditer(text):
        qno  = int(match.group(1))
        body = match.group(2)
        marks_m = MARKS_RE.findall(body)
        marks   = int(marks_m[0]) if marks_m else None
        co_m = CO_RE.search(body)
        co   = "CO-{}".format(co_m.group(1)) if co_m else ""
        q_text = re.sub(r"\[\d+\]", "", body)
        q_text = re.sub(r"\[CO[-\s]?\d+\]", "", q_text, flags=re.I)
        q_text = re.sub(r"\s{2,}", " ", q_text).strip()
        questions.append(Question(question_no=qno, question_text=q_text,
                                  marks=marks, co=co))
    return questions


# ---------------------------------------------------------------------------
# Record building
# ---------------------------------------------------------------------------

def make_id(meta: ExamMeta, q: Question) -> str:
    parts = [
        meta.exam_year,
        meta.semester.replace(" ", "_") if meta.semester else "",
        meta.exam_type.replace("-", "") if meta.exam_type else "",
        meta.course_code or "UNKNOWN",
        "Q{}".format(q.question_no),
    ]
    return "_".join(p for p in parts if p)


def build_records(meta: ExamMeta, questions: List[Question]) -> List[Dict]:
    records = []
    for q in questions:
        rec = asdict(meta)
        rec.update({
            "id":            make_id(meta, q),
            "question_no":   q.question_no,
            "question_text": q.question_text,
            "marks":         q.marks,
            "co":            q.co,
        })
        records.append(rec)
    return records


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_pdf(pdf_path: Path, dpi: int = 300) -> List[Dict]:
    meta  = infer_meta_from_path(pdf_path)
    text  = extract_text(pdf_path, dpi=dpi)
    meta  = refine_meta_from_text(meta, text)
    meta.raw_text = text.strip()
    questions = parse_questions(text)
    print("  -> {} question(s) found".format(len(questions)))
    if not questions:
        rec = asdict(meta)
        rec.update({"id": make_id(meta, Question(0)),
                    "question_no": None, "question_text": "",
                    "marks": None, "co": ""})
        return [rec]
    return build_records(meta, questions)


def find_pdfs(root: Path) -> List[Path]:
    return sorted(root.rglob("*.pdf"))


def build_dataset(root: Path, out_path: Path,
                  deduplicate: bool = True, dpi: int = 300) -> None:
    pdfs = find_pdfs(root)
    print("Found {} PDF(s) under {}\n".format(len(pdfs), root))

    seen_hashes: set = set()
    total_records = 0
    errors = 0

    with out_path.open("w", encoding="utf-8") as fout:
        for i, pdf in enumerate(pdfs, 1):
            print("[{}/{}] {}".format(i, len(pdfs), pdf))
            try:
                records = process_pdf(pdf, dpi=dpi)
                for rec in records:
                    if deduplicate:
                        h = hashlib.md5(rec["question_text"].encode()).hexdigest()
                        if h in seen_hashes:
                            continue
                        seen_hashes.add(h)
                    fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    total_records += 1
            except Exception as e:
                errors += 1
                print("  [ERROR] {}".format(e))

    print("\n" + "="*60)
    print("Dataset written to : {}".format(out_path))
    print("Records            : {}".format(total_records))
    print("PDFs processed     : {}".format(len(pdfs)))
    print("Errors             : {}".format(errors))
    print("="*60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Build a question-level JSONL dataset from PYQ PDFs."
    )
    parser.add_argument("--root", required=True,
        help='Root folder containing PYQ PDFs. Quote paths with spaces.')
    parser.add_argument("--out", default="pyq_dataset.jsonl",
        help="Output JSONL file (default: pyq_dataset.jsonl)")
    parser.add_argument("--no-dedup", action="store_true",
        help="Disable deduplication of identical question texts")
    parser.add_argument("--dpi", type=int, default=300,
        help="OCR rasterisation DPI (default: 300; use 150 for speed)")
    parser.add_argument("--tesseract", default="",
        help=r'Full path to tesseract.exe, e.g. "C:\Program Files\Tesseract-OCR\tesseract.exe"')
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        print("[ERROR] Root path does not exist: {}".format(root))
        sys.exit(1)

    if not OCR_AVAILABLE:
        print("[ERROR] pytesseract/Pillow required. Run: pip install pytesseract Pillow")
        sys.exit(1)

    # Configure Tesseract — must happen before any OCR calls
    tess_found = setup_tesseract(args.tesseract)
    if not tess_found:
        print("\n[ERROR] Could not locate tesseract.exe automatically.")
        print("  Find it with:  where tesseract  (or search in File Explorer)")
        print("  Then pass it:  --tesseract \"C:\\path\\to\\tesseract.exe\"")
        sys.exit(1)

    if not FITZ_AVAILABLE:
        print("[WARN] PyMuPDF not installed. On Windows with long paths this will fail.")
        print("       Fix: pip install pymupdf\n")

    build_dataset(root, Path(args.out),
                  deduplicate=not args.no_dedup, dpi=args.dpi)


if __name__ == "__main__":
    main()