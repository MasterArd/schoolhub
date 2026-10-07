-- SchoolHub database schema (SQLite)
--
-- Relationships:
--   subjects.teacher_id  -> teachers   (default teacher for a subject)
--   students.class_id    -> classes
--   lessons              -> classes, subjects, teachers   (the weekly timetable)
--   grades               -> students, subjects
--   tests                -> classes, subjects             (upcoming tests)

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS tests;
DROP TABLE IF EXISTS grades;
DROP TABLE IF EXISTS lessons;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS teachers;

CREATE TABLE teachers (
    id          INTEGER PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE
);

CREATE TABLE subjects (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    teacher_id  INTEGER REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE TABLE classes (
    id    INTEGER PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,              -- e.g. '4V1'
    year  INTEGER NOT NULL CHECK (year BETWEEN 1 AND 6)
);

CREATE TABLE students (
    id          INTEGER PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    class_id    INTEGER REFERENCES classes(id) ON DELETE SET NULL
);

CREATE TABLE lessons (
    id          INTEGER PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id  INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    room        TEXT NOT NULL DEFAULT '',
    day         TEXT NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
    start_time  TEXT NOT NULL,               -- 'HH:MM'
    end_time    TEXT NOT NULL,
    UNIQUE (class_id, day, start_time)       -- a class can't have two lessons at once
);

CREATE TABLE grades (
    id          INTEGER PRIMARY KEY,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade       REAL NOT NULL CHECK (grade BETWEEN 1 AND 10),
    date        TEXT NOT NULL                -- 'YYYY-MM-DD'
);

CREATE TABLE tests (
    id          INTEGER PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL
);

CREATE INDEX idx_students_class  ON students(class_id);
CREATE INDEX idx_grades_student  ON grades(student_id);
CREATE INDEX idx_lessons_teacher ON lessons(teacher_id);
CREATE INDEX idx_tests_class     ON tests(class_id);
