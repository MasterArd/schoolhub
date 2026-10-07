"""Generate the SchoolHub demo data.

Usage:
    python3 db/seed.py

Writes three files, all from the same data:
    db/seed.sql      schema + INSERT statements, readable SQL
    db/seed.js       the same SQL wrapped for the browser (index.html loads it)
    schoolhub.db     a ready-made SQLite database

The data is generated deterministically, so every reset gives the same school.
"""

import math
import sqlite3
import unicodedata
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
ROOT = DB_DIR.parent
SCHEMA = DB_DIR / "schema.sql"

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
SLOTS = [
    ("08:30", "09:20"),
    ("09:20", "10:10"),
    ("10:30", "11:20"),
    ("11:20", "12:10"),
    ("12:40", "13:30"),
    ("13:30", "14:20"),
]
# Default classroom per subject id.
ROOMS = {1: "B1.04", 2: "A2.11", 3: "A2.07", 4: "C0.02", 5: "A1.15",
         6: "A1.18", 7: "C0.05", 8: "C0.03", 9: "D0.01"}

TEACHERS = [
    (1, "Marieke", "de Vries"),
    (2, "Daniel", "Okafor"),
    (3, "Sanne", "Bakker"),
    (4, "Tomás", "Reyes"),
    (5, "Hannah", "Lindqvist"),
    (6, "Yusuf", "Demir"),
    (7, "Lotte", "Janssen"),
]

# (id, name, default teacher id)
SUBJECTS = [
    (1, "Mathematics", 1),
    (2, "English", 2),
    (3, "Dutch", 3),
    (4, "Biology", 4),
    (5, "History", 5),
    (6, "Geography", 6),
    (7, "Physics", 1),
    (8, "Chemistry", 4),
    (9, "Art", 7),
]

CLASSES = [(1, "4V1", 4), (2, "4V2", 4), (3, "5H1", 5), (4, "3A2", 3)]

STUDENT_NAMES = [
    "Emma Visser", "Noah Smit", "Julia Mulder", "Liam de Boer", "Mila Bos",
    "Finn Vos", "Sara Peters", "Daan Hendriks", "Zoë van Dijk", "Sem Dekker",
    "Nora Kok", "Luuk Meijer", "Eva de Wit", "Jesse Brouwer", "Lina Dijkstra",
    "Milan Koster", "Yara el Amrani", "Thijs Prins", "Fleur Huisman",
    "Bram Kuipers", "Isa Postma", "Ruben Willems", "Amira Haddad", "Lucas Verbeek",
]

GRADE_DATES = ["2026-09-11", "2026-09-18", "2026-09-25", "2026-10-01", "2026-10-05"]

# (class id, subject id, title, date)
TESTS = [
    (1, 1, "Algebra & functions", "2026-10-09"),
    (3, 2, "Reading comprehension", "2026-10-12"),
    (2, 4, "Cell biology", "2026-10-13"),
    (1, 5, "The Dutch Golden Age", "2026-10-15"),
    (4, 3, "Spelling & grammar", "2026-10-16"),
    (3, 7, "Mechanics", "2026-10-20"),
]


def make_email(first, last):
    """'Zoë', 'van Dijk' -> 'zoe.vandijk@schoolhub.nl'"""
    raw = f"{first}.{last}".lower()
    ascii_only = unicodedata.normalize("NFD", raw).encode("ascii", "ignore").decode()
    return "".join(ch for ch in ascii_only if ch.isalpha() or ch == ".") + "@schoolhub.nl"


class SeededRandom:
    """Park–Miller PRNG, so the demo grades are identical on every reset."""

    def __init__(self, seed):
        self.state = seed

    def next(self):
        self.state = (self.state * 16807) % 2147483647
        return self.state / 2147483647


def round1(value):
    """Round half up to one decimal."""
    return math.floor(value * 10 + 0.5) / 10


def build_students():
    students = []
    for i, full_name in enumerate(STUDENT_NAMES):
        first, *rest = full_name.split(" ")
        last = " ".join(rest)
        class_id = (i % len(CLASSES)) + 1
        students.append((i + 1, first, last, make_email(first, last), class_id))
    return students


def build_grades(students):
    rnd = SeededRandom(11)
    grades = []
    for student in students:
        base = 5.4 + rnd.next() * 3  # each student has their own level
        for subject_id in (1, 2, 3, 4, 5, 7):
            count = 1 + math.floor(rnd.next() * 3)
            for _ in range(count):
                value = base + (rnd.next() - 0.5) * 3.2
                value = round1(min(10, max(3, value)))
                date = GRADE_DATES[math.floor(rnd.next() * len(GRADE_DATES))]
                grades.append((len(grades) + 1, student[0], subject_id, value, date))
    return grades


def build_lessons():
    lessons = []
    for ci, (class_id, _, _) in enumerate(CLASSES):
        for di, day in enumerate(DAYS):
            for si, (start, end) in enumerate(SLOTS):
                # Leave a few free periods so timetables aren't all identical.
                if si == 5 and (di + ci) % 2:
                    continue
                if si == 0 and (ci + di) % 3 == 0:
                    continue
                subject_id, _, teacher_id = SUBJECTS[(ci * 2 + di * 3 + si) % len(SUBJECTS)]
                lessons.append((len(lessons) + 1, class_id, subject_id, teacher_id,
                                ROOMS[subject_id], day, start, end))
    return lessons


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return str(value)


def inserts(table, records):
    lines = [f"INSERT INTO {table} VALUES"]
    values = ["  (" + ", ".join(sql_value(v) for v in record) + ")" for record in records]
    return "\n".join(lines) + "\n" + ",\n".join(values) + ";\n"


def build_sql():
    teachers = [(id_, f, l, make_email(f, l)) for id_, f, l in TEACHERS]
    students = build_students()
    tests = [(i + 1, *test) for i, test in enumerate(TESTS)]
    parts = [
        SCHEMA.read_text(),
        "-- Demo data, generated by db/seed.py\n",
        inserts("teachers", teachers),
        inserts("subjects", SUBJECTS),
        inserts("classes", CLASSES),
        inserts("students", students),
        inserts("grades", build_grades(students)),
        inserts("lessons", build_lessons()),
        inserts("tests", tests),
    ]
    return "\n".join(parts)


def js_template(text):
    """Escape text for a JavaScript `template literal`."""
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def main():
    sql = build_sql()
    (DB_DIR / "seed.sql").write_text(sql)
    (DB_DIR / "seed.js").write_text(
        "// GENERATED by db/seed.py from schema.sql + the demo data. Run `python3 db/seed.py` to rebuild.\n"
        f"window.SCHOOLHUB_SEED_SQL = `\n{js_template(sql)}`;\n")

    db_path = ROOT / "schoolhub.db"
    for leftover in (db_path, Path(f"{db_path}-wal"), Path(f"{db_path}-shm")):
        leftover.unlink(missing_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(sql)
    # A single self-contained file (no -wal/-shm), so the browser can open it.
    conn.execute("PRAGMA journal_mode = DELETE")
    conn.close()
    print("Wrote db/seed.sql, db/seed.js and schoolhub.db")


if __name__ == "__main__":
    main()
