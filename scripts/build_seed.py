"""
Converts the old Flask project's JSON / JS data into CSV files for Supabase.

Usage (from the btech-hub folder):
    python3 scripts/build_seed.py ../Old_Code

Output goes to supabase/seed/*.csv. Import them in this order:
branches -> subjects -> resources -> syllabus_links -> university_info
"""

import csv
import json
import re
import sys
from pathlib import Path

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8}
YEAR = {"First Year": 1, "Second Year": 2, "Third Year": 3, "Fourth Year": 4}
PLACEHOLDER = "sciencecitychennai.in"
CODE_RE = re.compile(r"^[A-Z]{3,5}[0-9A-Z]?[0-9*]{1,3}$")

BRANCHES = [
    ("CSE", "Computer Science & Engineering", 1),
    ("CSEAIML", "CSE (AI & ML)", 2),
    ("CSEDS", "CSE (Data Science)", 3),
    ("IT", "Information Technology", 4),
    ("ECE", "Electronics & Communication Engineering", 5),
    ("EE", "Electrical Engineering", 6),
    ("EEE", "Electrical & Electronics Engineering", 7),
    ("ME", "Mechanical Engineering", 8),
    ("CE", "Civil Engineering", 9),
]
SYLLABUS_KEY_TO_BRANCH = {
    "cse": "CSE", "cseds": "CSEDS", "aiml": "CSEAIML", "it": "IT", "ece": "ECE",
    "ee": "EE", "eee": "EEE", "me": "ME", "ce": "CE",
}


def semester_number(label: str) -> int:
    token = label.replace("Semester", "").strip()
    return int(token) if token.isdigit() else ROMAN[token]


def extract_codes(title: str) -> list[str]:
    codes = []
    for group in re.findall(r"\(([^()]*)\)", title):
        for piece in group.split("/"):
            piece = piece.strip()
            if CODE_RE.match(piece):
                codes.append(piece)
    return codes


def split_top_level(title: str) -> list[str]:
    """Split 'A (X) / B (Y)' on slashes that are outside parentheses."""
    parts, depth, current = [], 0, ""
    for ch in title:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "/" and depth == 0:
            parts.append(current.strip())
            current = ""
        else:
            current += ch
    parts.append(current.strip())
    return [p for p in parts if p]


def subject_kind(title: str) -> str:
    lower = title.lower()
    if "project" in lower or "internship" in lower or "startup" in lower:
        return "project"
    if "lab" in lower or "workshop" in lower:
        return "lab"
    return "theory"


def build_subjects(old: Path) -> list[dict]:
    data = json.loads((old / "static/files/subjects.json").read_text())
    rows = []

    def add(year_label, branch, sem_label, title, credits):
        options = split_top_level(title)
        codes = extract_codes(title)
        # "Cyber Security/Python programming (BCC301 / BCC302)" -> attach codes to names
        if len(options) > 1 and len(options) == len(codes) and not extract_codes(options[0]):
            options = [f"{re.sub(r'\s*\(.*$', '', o).strip()} ({c})" for o, c in zip(options, codes)]
        rows.append({
            "id": len(rows) + 1,
            "title": title,
            "primary_code": codes[0] if codes else "",
            "codes": json.dumps(codes),
            "options": json.dumps(options if len(options) > 1 else []),
            "credits": credits,
            "kind": subject_kind(title),
            "year": YEAR[year_label],
            "semester": semester_number(sem_label),
            "branch_code": branch or "",
            "sort_order": len(rows) + 1,
        })

    for year_label, year_data in data.items():
        if year_label == "First Year":
            for sem_label, subjects in year_data.items():
                for title, credits in subjects.items():
                    add(year_label, None, sem_label, title, credits)
        else:
            for branch, semesters in year_data.items():
                for sem_label, subjects in semesters.items():
                    for title, credits in subjects.items():
                        add(year_label, branch, sem_label, title, credits)
    return rows


def build_resources(old: Path) -> tuple[list[dict], int]:
    data = json.loads((old / "static/files/resource.json").read_text())
    rows, coming_soon = [], 0
    type_map = {"notes": "notes", "pyq": "pyq", "lectures": "lecture", "imp_questions": "imp_question"}

    def add(year_label, branch, sem_label, subject_title, kinds):
        nonlocal coming_soon
        codes = extract_codes(subject_title)
        for kind, links in kinds.items():
            for label, url in links.items():
                # Placeholder links are kept as empty url so the UI can show "Coming soon"
                if not url or PLACEHOLDER in url:
                    url = ""
                    coming_soon += 1
                rows.append({
                    "id": len(rows) + 1,
                    "subject_code": codes[0] if codes else "",
                    "subject_title": subject_title,
                    "year": YEAR[year_label],
                    "semester": semester_number(sem_label),
                    "branch_code": branch or "",
                    "type": type_map.get(kind, kind),
                    "label": label.replace("_", " ").title(),
                    "url": url,
                })

    for year_label, year_data in data.items():
        if year_label == "First Year":
            for sem_label, subjects in year_data.items():
                for title, kinds in subjects.items():
                    add(year_label, None, sem_label, title, kinds)
        else:
            for branch, semesters in year_data.items():
                for sem_label, subjects in semesters.items():
                    for title, kinds in subjects.items():
                        add(year_label, branch, sem_label, title, kinds)
    return rows, coming_soon


def build_syllabus(old: Path) -> list[dict]:
    js = (old / "static/js/syllabus.js").read_text()
    rows = []
    for key, body in re.findall(r"(\w+):\s*\{([^{}]*)\}", js):
        if key not in SYLLABUS_KEY_TO_BRANCH:
            continue
        for year, url in re.findall(r"(\d):\s*'([^']+)'", body):
            rows.append({
                "id": len(rows) + 1,
                "branch_code": SYLLABUS_KEY_TO_BRANCH[key],
                "year": int(year),
                "url": url,
            })
    return rows


def build_university_info(old: Path) -> list[dict]:
    js = (old / "static/js/links.js").read_text()
    start = js.index("const universityData = ") + len("const universityData = ")
    depth, end = 0, start
    for i, ch in enumerate(js[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    raw = js[start:end]
    raw = re.sub(r",\s*([}\]])", r"\1", raw)  # trailing commas
    raw = re.sub(r"<a href='([^']+)'[^>]*>([^<]+)</a>", r"[\2](\1)", raw)  # html link -> markdown
    data = json.loads(raw)
    return [
        {"id": key, "title": value.get("title", key), "sort_order": i + 1, "data": json.dumps(value, ensure_ascii=False)}
        for i, (key, value) in enumerate(data.items())
    ]


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{path.name}: {len(rows)} rows")


def main() -> None:
    old = Path(sys.argv[1] if len(sys.argv) > 1 else "../Old_Code").resolve()
    out = Path(__file__).resolve().parent.parent / "supabase" / "seed"

    write_csv(out / "branches.csv", [{"code": c, "name": n, "sort_order": s} for c, n, s in BRANCHES])
    write_csv(out / "subjects.csv", build_subjects(old))
    resources, coming_soon = build_resources(old)
    write_csv(out / "resources.csv", resources)
    print(f"  {coming_soon} of them have no link yet (coming soon)")
    write_csv(out / "syllabus_links.csv", build_syllabus(old))
    write_csv(out / "university_info.csv", build_university_info(old))


if __name__ == "__main__":
    main()
