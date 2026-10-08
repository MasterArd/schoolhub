/* ==========================================================================
   SchoolHub — app
   --------------------------------------------------------------------------
   Data lives in a real SQLite database that runs in the browser (sql.js).
   It is saved to localStorage after every change, and can be downloaded as
   a .db file or replaced by opening one (see the dev panel).

   Rendering is plain template strings: every state change calls render(),
   which rebuilds the page from `state` + the database. Clicks, inputs and
   selects are handled by delegation through data-action / data-input /
   data-change attributes.
   ========================================================================== */

"use strict";

/* ---- Constants ---------------------------------------------------------- */

const STORAGE_KEY = "schoolhub-db";
const AUTH_SESSION_KEY = "schoolhub-auth-session";
const SQL_JS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/";

const DEFAULT_LOGIN_ACCOUNTS = [
    { email: "admin@schoolhub.nl", password: "Admin123!", role: "admin" },
    { email: "teacher@schoolhub.nl", password: "Teacher123!", role: "teacher", teacherId: 1 },
    { email: "student@schoolhub.nl", password: "Student123!", role: "student", studentId: 1 },
];

const SLOTS = [
    ["08:30", "09:20"],
    ["09:20", "10:10"],
    ["10:30", "11:20"],
    ["11:20", "12:10"],
    ["12:40", "13:30"],
    ["13:30", "14:20"],
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// The demo is pinned to one school day so the seeded tests and grades line up.
const TODAY = "Wednesday";
const TODAY_DATE = "2026-10-07";

// Default classroom per subject id, used to pre-fill the lesson form.
const ROOMS = { 1: "B1.04", 2: "A2.11", 3: "A2.07", 4: "C0.02", 5: "A1.15", 6: "A1.18", 7: "C0.05", 8: "C0.03", 9: "D0.01" };

// Which pages each role can open.
const NAV = {
    admin: ["dashboard", "students", "teachers", "classes", "grades", "schedule"],
    teacher: ["dashboard", "classes", "grades", "schedule"],
    student: ["dashboard", "grades", "schedule"],
};

// Shown in the "SQL" panel: the query behind each view.
const VIEW_SQL = {
    dashboard: `SELECT
  (SELECT COUNT(*) FROM students) AS students,
  (SELECT COUNT(*) FROM teachers) AS teachers,
  (SELECT COUNT(*) FROM classes)  AS classes;

SELECT s.first_name, s.last_name, sub.name, g.grade, g.date
FROM grades g
JOIN students s   ON s.id = g.student_id
JOIN subjects sub ON sub.id = g.subject_id
ORDER BY g.date DESC LIMIT 6;`,
    students: `SELECT s.id, s.first_name, s.last_name, s.email,
       c.name AS class, ROUND(AVG(g.grade), 1) AS average
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
LEFT JOIN grades g  ON g.student_id = s.id
GROUP BY s.id
ORDER BY s.last_name;`,
    teachers: `SELECT t.id, t.first_name, t.last_name, t.email,
       GROUP_CONCAT(DISTINCT sub.name) AS subjects,
       GROUP_CONCAT(DISTINCT c.name)   AS classes
FROM teachers t
LEFT JOIN subjects sub ON sub.teacher_id = t.id
LEFT JOIN lessons l    ON l.teacher_id = t.id
LEFT JOIN classes c    ON c.id = l.class_id
GROUP BY t.id;`,
    classes: `SELECT c.id, c.name, c.year, COUNT(DISTINCT s.id) AS students,
       COUNT(DISTINCT l.teacher_id) AS teachers
FROM classes c
LEFT JOIN students s ON s.class_id = c.id
LEFT JOIN lessons l  ON l.class_id = c.id
GROUP BY c.id;`,
    grades: `SELECT sub.name AS subject, g.grade, g.date,
       ROUND(AVG(g.grade) OVER (PARTITION BY sub.id), 1) AS subject_avg
FROM grades g
JOIN subjects sub ON sub.id = g.subject_id
WHERE g.student_id = :student_id
ORDER BY sub.name, g.date;`,
    schedule: `SELECT l.day, l.start_time, l.end_time, sub.name AS subject,
       t.first_name || ' ' || t.last_name AS teacher, l.room, c.name AS class
FROM lessons l
JOIN subjects sub    ON sub.id = l.subject_id
JOIN classes c       ON c.id = l.class_id
LEFT JOIN teachers t ON t.id = l.teacher_id
WHERE l.class_id = :class_id
ORDER BY l.day, l.start_time;`,
};

/* ---- Small helpers ------------------------------------------------------ */

const $ = (selector) => document.querySelector(selector);

/** Escape text for safe use inside HTML. */
function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const average = (nums) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null);
const oneDecimal = (n) => (n == null ? "—" : formatNumber(n, 1));
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const unique = (list) => [...new Set(list)];
const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : t("common.unassigned"));
const initials = (p) => (p ? (p.first_name[0] + p.last_name.split(" ").pop()[0]).toUpperCase() : "—");
const toDate = (iso) => new Date(iso + "T12:00:00");
const shortDate = (iso) => formatDate(iso, { day: "numeric", month: "short" });
const byLastName = (a, b) => a.last_name.localeCompare(b.last_name, locale());
const byName = (a, b) => a.name.localeCompare(b.name, locale());

// Grades below this are insufficient (Dutch 1–10 scale).
const PASS_MARK = 5.5;

/** 'Zoë', 'van Dijk' -> 'zoe.vandijk@schoolhub.nl' (same rule as db/seed.py). */
function makeEmail(first, last) {
    const ascii = `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return ascii.replace(/[^a-z.]/g, "") + "@schoolhub.nl";
}

/** Grade chip: insufficient grades (below PASS_MARK) are drawn filled. */
function gradeChip(value, { small = false, id = null, title = "" } = {}) {
    const classes = ["chip", small && "chip-sm", value == null ? "is-none" : value < PASS_MARK && "is-low"];
    return `<span class="${classes.filter(Boolean).join(" ")}"${id ? ` data-gid="${id}"` : ""}${
        title ? ` title="${esc(title)}"` : ""
    }>${oneDecimal(value)}</span>`;
}

const option = (value, label, selected) =>
    `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`;

/* ==========================================================================
   Database
   ========================================================================== */

let SQL; // the sql.js module
let db; // the open SQL.Database

/** Run a SELECT and return its rows as plain objects. */
function query(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

/** Run an INSERT/UPDATE/DELETE. Returns the new row id for inserts. */
function run(sql, params = []) {
    db.run(sql, params);
    return query("SELECT last_insert_rowid() AS id")[0].id;
}

/** Run several statements as one transaction: all of them succeed, or none do. */
function transaction(fn) {
    db.run("BEGIN");
    try {
        const result = fn();
        db.run("COMMIT");
        return result;
    } catch (error) {
        db.run("ROLLBACK");
        throw error;
    }
}

function useDatabase(newDb) {
    if (db) db.close();
    db = newDb;
    db.run("PRAGMA foreign_keys = ON"); // enables the ON DELETE rules in schema.sql
}

function freshDatabase() {
    const fresh = new SQL.Database();
    fresh.exec(window.SCHOOLHUB_SEED_SQL);
    return fresh;
}

function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(text) {
    return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
}

/** Save the database to localStorage. */
function persist() {
    const bytes = db.export();
    db.run("PRAGMA foreign_keys = ON"); // export() resets connection settings
    try {
        localStorage.setItem(STORAGE_KEY, bytesToBase64(bytes));
    } catch (error) {
        console.warn("Could not save the database to localStorage", error);
    }
}

function loadSavedDatabase() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? new SQL.Database(base64ToBytes(saved)) : null;
    } catch (error) {
        console.warn("Saved database is unreadable, starting fresh", error);
        return null;
    }
}

function toHex(bytes) {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function fromHex(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

async function hashPassword(password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const keyBytes = await window.crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, keyMaterial, 256);
    return { salt: toHex(salt), hash: toHex(new Uint8Array(keyBytes)) };
}

async function verifyPassword(password, saltHex, hashHex) {
    if (!saltHex || !hashHex) return false;
    const salt = fromHex(saltHex);
    const keyMaterial = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const keyBytes = await window.crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, keyMaterial, 256);
    const actual = new Uint8Array(keyBytes);
    const expected = fromHex(hashHex);
    if (actual.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < actual.length; i += 1) mismatch |= actual[i] ^ expected[i];
    return mismatch === 0;
}

function loadSession() {
    try {
        const raw = window.sessionStorage.getItem(AUTH_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveSession(user) {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ email: user.email, role: user.role, teacherId: user.teacher_id ?? null, studentId: user.student_id ?? null }));
}

function clearSession() {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
}

async function ensureAuthTableAndUsers() {
    if (!db) return;
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
            teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
            student_id INTEGER REFERENCES students(id) ON DELETE SET NULL
        );
    `);

    const users = query("SELECT COUNT(*) AS count FROM users");
    if (users[0].count > 0) return;

    for (const account of DEFAULT_LOGIN_ACCOUNTS) {
        const payload = await hashPassword(account.password);
        const teacherId = account.teacherId ?? null;
        const studentId = account.studentId ?? null;
        run("INSERT INTO users (email, password_hash, password_salt, role, teacher_id, student_id) VALUES (?, ?, ?, ?, ?, ?)", [
            account.email,
            payload.hash,
            payload.salt,
            account.role,
            teacherId,
            studentId,
        ]);
    }

    persist();
}

async function loginWithEmail(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) return { ok: false, message: t("auth.invalid") };

    const rows = query("SELECT * FROM users WHERE email = ?", [normalizedEmail]);
    const user = rows[0];
    if (!user) return { ok: false, message: t("auth.invalid") };

    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) return { ok: false, message: t("auth.invalid") };

    const sessionUser = {
        email: user.email,
        role: user.role,
        teacher_id: user.teacher_id,
        student_id: user.student_id,
    };
    saveSession(sessionUser);
    return { ok: true, user: sessionUser };
}

/** Read every table into state.data, which the views render from. */
function loadData() {
    state.data = {
        teachers: query("SELECT * FROM teachers ORDER BY id"),
        // Subject names are stored in English; show them in the current language.
        subjects: query("SELECT * FROM subjects ORDER BY id").map((s) => ({ ...s, name: subjectName(s.name) })),
        classes: query("SELECT * FROM classes ORDER BY id"),
        students: query("SELECT * FROM students ORDER BY id"),
        grades: query("SELECT * FROM grades ORDER BY id"),
        lessons: query("SELECT * FROM lessons ORDER BY id"),
        tests: query("SELECT * FROM tests ORDER BY id"),
    };
}

/** Change the database, save it, and redraw. Throws (and rolls back) on errors. */
function mutate(fn, toastMessage) {
    const result = transaction(fn);
    persist();
    loadData();
    render();
    if (toastMessage) toast(toastMessage);
    return result;
}

function downloadDatabase() {
    const blob = new Blob([db.export()], { type: "application/vnd.sqlite3" });
    db.run("PRAGMA foreign_keys = ON");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "schoolhub.db";
    link.click();
    URL.revokeObjectURL(link.href);
}

async function openDatabaseFile(file) {
    try {
        const opened = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
        const tables = opened.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values.flat() ?? [];
        const missing = ["teachers", "subjects", "classes", "students", "grades", "lessons", "tests"].filter(
            (table) => !tables.includes(table)
        );
        if (missing.length) {
            opened.close();
            toast(t("toast.notSchoolhub", { tables: missing.join(", ") }));
            return;
        }
        useDatabase(opened);
        persist();
        loadData();
        await ensureAuthTableAndUsers();
        loadData();
        Object.assign(state, { selClass: null, detailId: null });
        render();
        toast(t("toast.opened", { file: file.name }));
    } catch (error) {
        toast(t("toast.openFailed"));
    }
}

/* ==========================================================================
   State
   ========================================================================== */

const state = {
    data: null,
    role: "admin", // dev switch: admin | teacher | student
    teacherId: 1, // who you are when viewing as a teacher
    studentId: 1, // who you are when viewing as a student
    page: "dashboard",
    theme: "light",
    sqlOpen: false,
    authenticated: false,
    authUser: null,
    loginError: "",

    // Students page
    search: "",
    classFilter: "all",
    detailId: null, // student shown in the side drawer

    // Classes page
    selClass: null, // class shown in detail
    addSel: "", // student picked in "Add a student…"

    // Grades page
    gradeStudent: 1,
    gradeForm: { subject_id: 1, grade: "", date: TODAY_DATE },
    gradeError: null,
    lastGradeId: null, // the chip to "pop" after saving

    // Schedule page
    schedClass: 1,

    // Modal: { type: 'student'|'teacher'|'klass'|'lesson'|'confirm', edit, title, cta, onConfirm }
    modal: null,
    form: {},
};

/* ==========================================================================
   Derived data
   ========================================================================== */

/** Everything the views need that depends on who is looking. */
function buildContext() {
    const d = state.data;
    const role = state.role;
    const isAdmin = role === "admin";
    const isTeacher = role === "teacher";
    const isStudent = role === "student";

    const teachers = byId(d.teachers);
    const subjects = byId(d.subjects);
    const classes = byId(d.classes);

    const meTeacher = isTeacher ? teachers[state.teacherId] || d.teachers[0] || null : null;
    const meStudent = isStudent ? d.students.find((s) => s.id === state.studentId) || d.students[0] || null : null;

    const mySubjectIds = isTeacher ? d.subjects.filter((s) => s.teacher_id === meTeacher?.id).map((s) => s.id) : [];
    const myLessons = isTeacher
        ? d.lessons.filter((l) => l.teacher_id === meTeacher?.id)
        : isStudent
          ? d.lessons.filter((l) => meStudent && l.class_id === meStudent.class_id)
          : d.lessons;
    const myClassIds = isAdmin
        ? d.classes.map((c) => c.id)
        : isTeacher
          ? unique(myLessons.map((l) => l.class_id))
          : meStudent?.class_id
            ? [meStudent.class_id]
            : [];
    const myStudents = d.students.filter((s) => myClassIds.includes(s.class_id));

    const gradesByStudent = {};
    for (const g of d.grades) (gradesByStudent[g.student_id] ||= []).push(g);
    const gradesOf = (studentId) => gradesByStudent[studentId] || [];
    const averageOf = (studentId) => average(gradesOf(studentId).map((g) => g.grade));

    const page = NAV[role].includes(state.page) ? state.page : "dashboard";
    const selectedClass = page === "classes" && state.selClass ? classes[state.selClass] || null : null;

    return {
        d, role, isAdmin, isTeacher, isStudent, teachers, subjects, classes,
        meTeacher, meStudent, mySubjectIds, myLessons, myClassIds, myStudents,
        gradesOf, averageOf, page, selectedClass,
    };
}

/** Per-subject grades for one student: every subject they have lessons or grades in. */
function subjectBreakdown(ctx, student) {
    if (!student) return [];
    const { d, subjects, teachers } = ctx;
    const grades = ctx.gradesOf(student.id);
    const subjectIds = unique([
        ...d.lessons.filter((l) => l.class_id === student.class_id).map((l) => l.subject_id),
        ...grades.map((g) => g.subject_id),
    ]);
    return subjectIds
        .map((id) => subjects[id])
        .filter(Boolean)
        .sort(byName)
        .map((subject) => {
            const list = grades
                .filter((g) => g.subject_id === subject.id)
                .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
            // The class's own teacher for this subject, else the subject's default teacher.
            const lesson = d.lessons.find((l) => l.class_id === student.class_id && l.subject_id === subject.id);
            return {
                name: subject.name,
                teacher: fullName(teachers[lesson ? lesson.teacher_id : subject.teacher_id]),
                grades: list,
                average: average(list.map((g) => g.grade)),
            };
        });
}

/** The student and subject the "Enter a grade" form currently points at. */
function gradeTargets(ctx) {
    const { d, isAdmin, isTeacher, isStudent, classes } = ctx;
    const allowed = isAdmin ? d.students : isTeacher ? ctx.myStudents : [ctx.meStudent].filter(Boolean);
    const sorted = [...allowed].sort(
        (a, b) => (classes[a.class_id]?.name || "").localeCompare(classes[b.class_id]?.name || "") || byLastName(a, b)
    );
    const student = isStudent ? ctx.meStudent : allowed.find((s) => s.id === state.gradeStudent) || sorted[0];
    const subjectChoices = isAdmin ? d.subjects : d.subjects.filter((s) => ctx.mySubjectIds.includes(s.id));
    const subject = subjectChoices.find((s) => s.id === state.gradeForm.subject_id) || subjectChoices[0];
    return { students: sorted, student, subjects: subjectChoices, subject };
}

/* ==========================================================================
   Views
   ========================================================================== */

function renderLogin() {
    return `
        <div class="login-shell" data-anim>
            <div class="login-card">
                <div class="brand" style="justify-content:center; margin-bottom:18px;">
                    <div class="brand-mark"></div>
                    <span>SchoolHub</span>
                </div>
                <div class="login-copy">
                    <span class="eyebrow">${t("auth.secure")}</span>
                    <h1>${t("auth.title")}</h1>
                    <p>${t("auth.subtitle")}</p>
                </div>
                <form id="login-form" class="stack" style="gap:14px;">
                    <label class="field">${t("auth.email")}
                        <input id="login-email" class="input" type="email" autocomplete="email" value="${esc(state.authUser?.email || "")}" required />
                    </label>
                    <label class="field">${t("auth.password")}
                        <input id="login-password" class="input" type="password" autocomplete="current-password" required />
                    </label>
                    ${state.loginError ? `<span class="error">${esc(state.loginError)}</span>` : ""}
                    <button class="btn btn-primary" type="submit">${t("auth.signIn")}</button>
                </form>
                <div class="login-demo">
                    <span class="eyebrow">${t("auth.demo")}</span>
                    <ul>
                        <li>admin@schoolhub.nl / Admin123!</li>
                        <li>teacher@schoolhub.nl / Teacher123!</li>
                        <li>student@schoolhub.nl / Student123!</li>
                    </ul>
                </div>
            </div>
        </div>`;
}

function renderNav(ctx) {
    $("#nav-items").innerHTML = NAV[ctx.role]
        .map(
            (page) => `
        <button class="nav-item${page === ctx.page ? " is-active" : ""}" data-nav="${page}" data-action="go" data-page="${page}" data-side>
            <span class="nav-num">${String(NAV.admin.indexOf(page) + 1).padStart(2, "0")}</span>${t(`nav.${page}`)}
        </button>`
        )
        .join("");
}

function renderDevPanel(ctx) {
    const { d, classes } = ctx;
    const personSelect = ctx.isTeacher
        ? `<select class="select select-sm" data-change="teacherId">
               ${d.teachers.map((teacher) => option(teacher.id, fullName(teacher), ctx.meTeacher?.id)).join("")}
           </select>`
        : ctx.isStudent
          ? `<select class="select select-sm" data-change="studentId">
                 ${[...d.students]
                     .sort(byLastName)
                     .map((s) => option(s.id, `${fullName(s)} · ${classes[s.class_id]?.name || "—"}`, ctx.meStudent?.id))
                     .join("")}
             </select>`
          : "";

    $("#dev-panel").innerHTML = `
        <span class="eyebrow">${t("dev.viewAs")}</span>
        <select class="select select-sm" data-change="role">
            ${["admin", "teacher", "student"].map((role) => option(role, t(`role.${role}`), ctx.role)).join("")}
        </select>
        ${personSelect}
        <button class="link-btn underline" data-action="download-db">${t("dev.download")}</button>
        <button class="link-btn underline" data-action="open-db">${t("dev.open")}</button>
        <button class="link-btn underline" data-action="ask-reset">${t("dev.reset")}</button>`;
}

function renderMain(ctx) {
    const { d, page, selectedClass: selC, isAdmin, isTeacher, isStudent } = ctx;

    const me = isAdmin
        ? { initials: "AD", name: t("me.admin"), role: t("role.admin") }
        : isTeacher
          ? { initials: initials(ctx.meTeacher), name: fullName(ctx.meTeacher), role: t("role.teacher") }
          : {
                initials: initials(ctx.meStudent),
                name: fullName(ctx.meStudent),
                role: t("me.studentRole", { class: ctx.classes[ctx.meStudent?.class_id]?.name || "—" }),
            };

    const firstName = isAdmin ? t("me.admin") : (ctx.meTeacher || ctx.meStudent)?.first_name || t("common.unknown");

    const title = selC
        ? selC.name
        : page === "dashboard"
          ? firstName
              ? t("greeting.name", { name: firstName })
              : t("greeting")
          : t(`nav.${page}`);

    const subtitles = {
        dashboard: isAdmin
            ? t("subtitle.dashboard.admin", {
                  students: count("student", d.students.length),
                  teachers: count("teacher", d.teachers.length),
                  classes: count("class", d.classes.length),
              })
            : t(isTeacher ? "subtitle.dashboard.teacher" : "subtitle.dashboard.student"),
        students: t("subtitle.students", { students: count("student", d.students.length), classes: count("class", d.classes.length) }),
        teachers: t("subtitle.teachers", { teachers: count("teacher", d.teachers.length) }),
        classes: selC ? t("subtitle.classDetail", { year: selC.year }) : t(isAdmin ? "subtitle.classes.admin" : "subtitle.classes.teacher"),
        grades: t(isStudent ? "subtitle.grades.student" : "subtitle.grades.staff"),
        schedule: t("subtitle.schedule"),
    };

    const views = {
        dashboard: renderDashboard,
        students: renderStudents,
        teachers: renderTeachers,
        classes: selC ? renderClassDetail : renderClassList,
        grades: renderGrades,
        schedule: renderSchedule,
    };

    return `
        <div class="topbar" data-anim>
            <span class="crumb">schoolhub / ${ctx.role} / ${page}${selC ? " / " + esc(selC.name) : ""}</span>
            <button class="link-btn${state.sqlOpen ? " is-active" : ""}" data-action="toggle-sql">SQL</button>
            <button class="link-btn" data-action="toggle-theme">${t(state.theme === "light" ? "top.dark" : "top.light")}</button>
            <button class="link-btn" data-action="switch-language" title="${esc(LANGUAGES[nextLanguage()].name)}">${nextLanguage().toUpperCase()}</button>
            <button class="link-btn" data-action="logout">${t("auth.signOut")}</button>
            <div class="me">
                <div class="avatar">${esc(me.initials)}</div>
                <div class="me-text">
                    <span class="me-name">${esc(me.name)}</span>
                    <span class="me-role">${esc(me.role)}</span>
                </div>
            </div>
        </div>

        <header class="page-header" data-anim>
            <h1><span data-title>${esc(title)}</span></h1>
            <p>${esc(subtitles[page])}</p>
        </header>

        ${
            state.sqlOpen
                ? `<div class="sql-panel" data-anim>
                       <span class="eyebrow">${t("top.sqlLabel")}</span>
                       <pre>${esc(VIEW_SQL[page])}</pre>
                   </div>`
                : ""
        }

        ${views[page](ctx)}`;
}

/* ---- Dashboard ---------------------------------------------------------- */

function renderDashboard(ctx) {
    const { d, isAdmin, isTeacher, isStudent, teachers, subjects, classes, myClassIds, myLessons } = ctx;
    const me = ctx.meStudent;

    const stat = (label, value, note, decimals = 0) => ({ label, value, note, decimals });
    const stats = isAdmin
        ? [
              stat(t("stat.students"), d.students.length, t("note.enrolled")),
              stat(t("stat.teachers"), d.teachers.length, t("note.onStaff")),
              stat(t("stat.classes"), d.classes.length, t("note.thisYear")),
          ]
        : isTeacher
          ? [
                stat(t("stat.myClasses"), myClassIds.length, t("note.thisTerm")),
                stat(t("stat.myStudents"), ctx.myStudents.length, t("note.inTotal")),
                stat(t("stat.lessons"), myLessons.length, t("note.perWeek")),
            ]
          : [
                stat(t("stat.average"), ctx.averageOf(me?.id), t("note.allSubjects"), 1),
                stat(t("stat.grades"), ctx.gradesOf(me?.id).length, t("note.thisTerm")),
                stat(t("stat.lessons"), myLessons.length, t("note.perWeek")),
            ];

    const studentsById = byId(d.students);
    const recentGrades = d.grades
        .filter((g) => {
            if (isAdmin) return true;
            if (isStudent) return g.student_id === me?.id;
            const student = studentsById[g.student_id];
            return ctx.mySubjectIds.includes(g.subject_id) && myClassIds.includes(student?.class_id);
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .slice(0, 6);

    const upcomingTests = d.tests
        .filter((test) => myClassIds.includes(test.class_id) && test.date >= TODAY_DATE)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4);

    const todaysLessons = myLessons
        .filter((l) => l.day === TODAY)
        .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.class_id - b.class_id);

    const statHtml = stats
        .map(
            (s) => `
        <div class="stat" data-anim>
            <span class="eyebrow">${s.label}</span>
            <div class="stat-value-line">
                <span class="stat-value" data-count="${s.value ?? ""}" data-decimals="${s.decimals}">${
                    s.value == null ? "—" : formatNumber(s.value, s.decimals)
                }</span>
                <span class="stat-note">${s.note}</span>
            </div>
        </div>`
        )
        .join("");

    const gradeRows = recentGrades
        .map((g) => {
            const student = studentsById[g.student_id];
            const subject = subjects[g.subject_id];
            const title = isStudent ? subject?.name : fullName(student);
            const sub = isStudent
                ? fullName(teachers[subject?.teacher_id])
                : `${subject?.name} · ${classes[student?.class_id]?.name || "—"}`;
            return `
            <div class="row row-grade" data-row>
                <div class="row-text"><span class="row-title ellipsis">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></div>
                <span class="meta">${shortDate(g.date)}</span>
                ${gradeChip(g.grade)}
            </div>`;
        })
        .join("");

    const testRows = upcomingTests
        .map((test) => {
            const days = Math.round((toDate(test.date) - toDate(TODAY_DATE)) / 864e5);
            const when = relativeDays(days);
            return `
            <div class="row row-test" data-row>
                <div class="date-block">
                    <span class="date-day">${toDate(test.date).getDate()}</span>
                    <span class="date-month">${formatDate(test.date, { month: "short" })}</span>
                </div>
                <div class="row-text">
                    <span class="row-title">${esc(test.title)}</span>
                    <span class="row-sub">${esc(classes[test.class_id]?.name)} · ${esc(subjects[test.subject_id]?.name)}</span>
                </div>
                <span class="meta">${when}</span>
            </div>`;
        })
        .join("");

    const lessonRows = todaysLessons
        .slice(0, isAdmin ? 6 : 8)
        .map((l) => {
            const className = classes[l.class_id]?.name;
            const teacher = fullName(teachers[l.teacher_id]);
            const meta = isTeacher ? className : isStudent ? teacher : `${className} · ${teacher}`;
            return `
            <div class="row row-lesson" data-row>
                <span class="mono" style="font-size:12px">${l.start_time}</span>
                <div class="row-text"><span class="row-title">${esc(subjects[l.subject_id]?.name)}</span><span class="row-sub">${esc(meta)}</span></div>
                <span class="meta">${esc(l.room)}</span>
            </div>`;
        })
        .join("");

    return `
    <div class="dashboard">
        <div class="stats">${statHtml}</div>

        <div class="two-col">
            <div class="section" data-anim>
                <div class="section-head">
                    <h2>${t("dash.recentGrades")}</h2>
                    ${NAV[ctx.role].includes("grades") ? `<button class="link-btn" data-action="go" data-page="grades">${t("dash.viewAll")}</button>` : ""}
                </div>
                ${gradeRows || `<p class="empty">${t("dash.noGrades")}</p>`}
            </div>

            <div class="dashboard-side">
                <div class="section" data-anim>
                    <div class="section-head"><h2>${t("dash.upcomingTests")}</h2></div>
                    ${testRows || `<p class="empty">${t("dash.noTests")}</p>`}
                </div>

                <div class="section" data-anim>
                    <div class="section-head">
                        <h2>${t("dash.today")}</h2>
                        <span class="meta">${isAdmin ? t("dash.schoolWide", { lessons: count("lesson", todaysLessons.length) }) : count("lesson", todaysLessons.length)}</span>
                    </div>
                    ${lessonRows || `<p class="empty">${t("dash.noLessons")}</p>`}
                </div>
            </div>
        </div>
    </div>`;
}

/* ---- Students ----------------------------------------------------------- */

function renderStudents(ctx) {
    const { d, classes } = ctx;
    const search = state.search.trim().toLowerCase();

    const rows = d.students
        .filter((s) => state.classFilter === "all" || String(s.class_id) === state.classFilter)
        .filter((s) => !search || `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(search))
        .sort(byLastName);

    const rowHtml = rows
        .map(
            (s) => `
        <tr data-row data-action="open-student" data-id="${s.id}">
            <td><div class="person"><div class="avatar outline">${esc(initials(s))}</div>${esc(fullName(s))}</div></td>
            <td class="muted">${esc(s.email)}</td>
            <td class="mono" style="font-size:12.5px">${esc(classes[s.class_id]?.name || "—")}</td>
            <td>${gradeChip(ctx.averageOf(s.id))}</td>
            <td>
                <div class="row-actions">
                    <button class="link-btn" data-action="edit-student" data-id="${s.id}">${t("common.edit")}</button>
                    <button class="link-btn" data-action="delete-student" data-id="${s.id}">${t("common.delete")}</button>
                </div>
            </td>
        </tr>`
        )
        .join("");

    return `
    <div class="stack">
        <div class="toolbar" data-anim>
            <input id="student-search" class="input search" placeholder="${esc(t("students.search"))}" value="${esc(state.search)}" data-input="search" />
            <select class="select" data-change="classFilter">
                ${option("all", t("students.allClasses"), state.classFilter)}
                ${[...d.classes].sort(byName).map((c) => option(c.id, c.name, state.classFilter)).join("")}
            </select>
            <div class="spacer"></div>
            <button class="btn btn-primary" data-action="add-student">${t("students.add")}</button>
        </div>
        <div class="table-wrap" data-anim>
            <table class="table">
                <thead>
                    <tr><th>${t("col.student")}</th><th>${t("col.email")}</th><th>${t("col.class")}</th><th>${t("col.average")}</th><th></th></tr>
                </thead>
                <tbody>${rowHtml}</tbody>
            </table>
            ${rows.length ? "" : `<p class="empty">${t("students.noMatch")}</p>`}
        </div>
    </div>`;
}

/* ---- Teachers ----------------------------------------------------------- */

function renderTeachers(ctx) {
    const { d, classes } = ctx;

    const cards = d.teachers
        .map((teacher) => {
            const subjects = d.subjects.filter((s) => s.teacher_id === teacher.id);
            const lessons = d.lessons.filter((l) => l.teacher_id === teacher.id);
            const classNames = unique(lessons.map((l) => classes[l.class_id]?.name)).filter(Boolean);
            return `
            <div class="teacher-card" data-anim>
                <div class="teacher-head">
                    <div class="avatar lg">${esc(initials(teacher))}</div>
                    <div class="row-text">
                        <span class="teacher-name">${esc(fullName(teacher))}</span>
                        <span class="row-sub ellipsis">${esc(teacher.email)}</span>
                    </div>
                </div>
                <div class="teacher-tags">
                    ${subjects.map((s) => `<span class="tag">${esc(s.name)}</span>`).join("") || `<span class="row-sub">${t("teachers.noSubjects")}</span>`}
                </div>
                <div class="teacher-foot">
                    <div class="row-text spacer">
                        <span class="mono">${esc(classNames.join(" · ") || t("teachers.noClasses"))}</span>
                        <span class="muted">${t("common.perWeek", { lessons: count("lesson", lessons.length) })}</span>
                    </div>
                    <button class="link-btn" data-action="edit-teacher" data-id="${teacher.id}">${t("common.edit")}</button>
                    <button class="link-btn" data-action="delete-teacher" data-id="${teacher.id}">${t("common.delete")}</button>
                </div>
            </div>`;
        })
        .join("");

    return `
    <div class="stack">
        <div class="toolbar end" data-anim><button class="btn btn-primary" data-action="add-teacher">${t("teachers.add")}</button></div>
        <div class="card-grid">${cards}</div>
    </div>`;
}

/* ---- Classes ------------------------------------------------------------ */

function renderClassList(ctx) {
    const { d } = ctx;
    const studentsById = byId(d.students);

    const cards = d.classes
        .filter((c) => ctx.myClassIds.includes(c.id))
        .sort(byName)
        .map((c) => {
            const studentCount = d.students.filter((s) => s.class_id === c.id).length;
            const teacherCount = unique(d.lessons.filter((l) => l.class_id === c.id && l.teacher_id).map((l) => l.teacher_id)).length;
            const classAverage = average(d.grades.filter((g) => studentsById[g.student_id]?.class_id === c.id).map((g) => g.grade));
            return `
            <button class="class-card" data-anim data-action="open-class" data-id="${c.id}">
                <div class="class-card-top"><span>${t("common.year", { year: c.year })}</span><span>→</span></div>
                <span class="class-card-name">${esc(c.name)}</span>
                <div class="class-card-foot">
                    <span style="font-weight:500">${count("student", studentCount)}</span>
                    <span style="opacity:.65">${t("classes.cardMeta", { teachers: count("teacher", teacherCount), average: oneDecimal(classAverage) })}</span>
                </div>
            </button>`;
        })
        .join("");

    return `
    <div class="stack">
        ${ctx.isAdmin ? `<div class="toolbar end" data-anim><button class="btn btn-primary" data-action="add-class">${t("classes.create")}</button></div>` : ""}
        <div class="class-grid">${cards}</div>
    </div>`;
}

function renderClassDetail(ctx) {
    const { d, isAdmin, classes, teachers, subjects, selectedClass: cls } = ctx;
    const members = d.students.filter((s) => s.class_id === cls.id).sort(byLastName);
    const classLessons = d.lessons.filter((l) => l.class_id === cls.id);
    const others = d.students.filter((s) => s.class_id !== cls.id).sort(byLastName);

    const memberRows = members
        .map(
            (s) => `
        <div class="row row-member" data-row>
            <div class="avatar outline sm">${esc(initials(s))}</div>
            <span class="name">${esc(fullName(s))}</span>
            <span class="meta" style="font-size:12px">${oneDecimal(ctx.averageOf(s.id))}</span>
            ${isAdmin ? `<button class="link-btn remove-btn" title="${esc(t("classes.remove"))}" data-action="remove-from-class" data-id="${s.id}">×</button>` : ""}
        </div>`
        )
        .join("");

    const subjectRows = unique(classLessons.map((l) => l.subject_id))
        .map((id) => subjects[id])
        .filter(Boolean)
        .sort(byName)
        .map((subject) => {
            const lessons = classLessons.filter((l) => l.subject_id === subject.id);
            const teacherId = lessons[0].teacher_id;
            const control = isAdmin
                ? `<select class="select select-sm" data-change="class-subject-teacher" data-subject="${subject.id}">
                       ${option("", t("common.unassigned"), teacherId ?? "")}
                       ${d.teachers.map((teacher) => option(teacher.id, fullName(teacher), teacherId)).join("")}
                   </select>`
                : `<span style="font-size:13.5px">${esc(fullName(teachers[teacherId]))}</span>`;
            return `
            <div class="row row-subject" data-row>
                <div class="row-text spacer">
                    <span class="row-title" style="font-size:14px">${esc(subject.name)}</span>
                    <span class="meta" style="font-size:11px">${t("classes.lessonsPerWeek", { lessons: count("lesson", lessons.length) })}</span>
                </div>
                ${control}
            </div>`;
        })
        .join("");

    return `
    <div class="class-detail">
        <div class="toolbar" data-anim style="gap:20px">
            <button class="btn btn-outline btn-sm" data-action="back-to-classes">${t("classes.back")}</button>
            <span class="meta" style="font-size:12px">${t("common.year", { year: cls.year })} · ${count("student", members.length)}</span>
            <div class="spacer"></div>
            ${
                isAdmin
                    ? `<div class="row-actions" style="gap:18px">
                           <button class="link-btn" data-action="edit-class" data-id="${cls.id}">${t("classes.rename")}</button>
                           <button class="link-btn" data-action="delete-class" data-id="${cls.id}">${t("classes.delete")}</button>
                       </div>`
                    : ""
            }
        </div>

        <div class="two-col">
            <div class="section" data-anim>
                <div class="section-head"><h2>${t("classes.students")}</h2></div>
                ${memberRows || `<p class="empty">${t("classes.empty")}</p>`}
                ${
                    isAdmin
                        ? `<div class="add-member">
                               <select class="select" data-change="addSel">
                                   ${option("", t("classes.addStudent"), state.addSel)}
                                   ${others.map((s) => option(s.id, `${fullName(s)} · ${classes[s.class_id]?.name || t("common.noClass")}`, state.addSel)).join("")}
                               </select>
                               <button class="btn btn-primary" data-action="add-to-class">${t("common.add")}</button>
                           </div>`
                        : ""
                }
            </div>

            <div class="section" data-anim>
                <div class="section-head column">
                    <h2>${esc(t("classes.subjectsTeachers"))}</h2>
                    <span class="section-note">${esc(t("classes.assignNote", { class: cls.name }))}</span>
                </div>
                ${subjectRows}
            </div>
        </div>
    </div>`;
}

/* ---- Grades ------------------------------------------------------------- */

const RING_LENGTH = 364.42; // circumference of the r=58 circle

function renderGrades(ctx) {
    const { classes } = ctx;
    const target = gradeTargets(ctx);
    const student = target.student;
    const breakdown = subjectBreakdown(ctx, student);
    const studentAverage = student ? ctx.averageOf(student.id) : null;
    const gradeCount = student ? ctx.gradesOf(student.id).length : 0;
    const lowSubjects = breakdown.filter((r) => r.average != null && r.average < PASS_MARK).length;

    const form = ctx.isStudent
        ? ""
        : `
        <div class="grade-form" data-anim>
            <span class="eyebrow">${t("grades.newEntry")}</span>
            <h2>${t("grades.enter")}</h2>
            <label class="field">${t("grades.student")}
                <select class="select" data-change="gradeStudent">
                    ${target.students.map((s) => option(s.id, `${fullName(s)} · ${classes[s.class_id]?.name || "—"}`, student?.id)).join("")}
                </select>
            </label>
            <label class="field">${t("grades.subject")}
                <select class="select" data-change="gradeSubject">
                    ${target.subjects.map((s) => option(s.id, s.name, target.subject?.id)).join("")}
                </select>
            </label>
            <div class="form-grid">
                <label class="field">${t("grades.grade")}
                    <input id="grade-value" class="input" type="number" min="1" max="10" step="0.1" placeholder="7.5"
                           value="${esc(state.gradeForm.grade)}" data-input="grade" />
                </label>
                <label class="field">${t("grades.date")}
                    <input class="input" type="date" value="${esc(state.gradeForm.date)}" data-input="gradeDate" />
                </label>
            </div>
            ${state.gradeError ? `<span class="error">${esc(state.gradeError)}</span>` : ""}
            <button class="btn" data-action="save-grade">${t("grades.save")}</button>
        </div>`;

    const subjectRows = breakdown
        .map(
            (r) => `
        <div class="row row-subject-grades" data-row>
            <div class="row-text"><span class="row-title" style="font-size:14px">${esc(r.name)}</span><span class="row-sub" style="font-size:12px">${esc(r.teacher)}</span></div>
            <div class="chips">
                ${r.grades.map((g) => gradeChip(g.grade, { id: g.id, title: shortDate(g.date) })).join("") || `<span class="row-sub">${t("common.noGradesYet")}</span>`}
            </div>
            <div class="subject-avg">
                ${oneDecimal(r.average)}
                <div class="bar"><div data-bar style="width:${(r.average ?? 0) * 10}%"></div></div>
            </div>
        </div>`
        )
        .join("");

    return `
    <div class="grades-page">
        ${form}
        <div class="grade-overview" data-anim>
            <div class="overview-head" data-ov>
                <div class="ring">
                    <svg width="132" height="132" viewBox="0 0 132 132">
                        <circle class="ring-track" cx="66" cy="66" r="58" fill="none" stroke-width="3"></circle>
                        <circle class="ring-value" id="ring-value" cx="66" cy="66" r="58" fill="none" stroke-width="3" stroke-linecap="round"
                                stroke-dasharray="${RING_LENGTH}" stroke-dashoffset="${RING_LENGTH * (1 - (studentAverage || 0) / 10)}"></circle>
                    </svg>
                    <div class="ring-label"><strong>${oneDecimal(studentAverage)}</strong><span class="eyebrow">${t("grades.average")}</span></div>
                </div>
                <div class="overview-name">
                    <strong>${esc(fullName(student))}</strong>
                    <span class="meta" style="font-size:12px">${esc(classes[student?.class_id]?.name || t("common.noClass"))} · ${count("grade", gradeCount)} · ${
                        lowSubjects ? t("grades.below", { n: lowSubjects, limit: formatNumber(PASS_MARK, 1) }) : t("grades.allSufficient")
                    }</span>
                </div>
            </div>
            <div class="subject-rows">${subjectRows}</div>
            <span class="footnote">${t("grades.footnote", { limit: formatNumber(PASS_MARK, 1) })}</span>
        </div>
    </div>`;
}

/* ---- Schedule ----------------------------------------------------------- */

function renderSchedule(ctx) {
    const { d, isAdmin, isTeacher, teachers, subjects, classes } = ctx;
    const schedClass = classes[state.schedClass] ? state.schedClass : d.classes[0]?.id;
    const lessons = isAdmin ? d.lessons.filter((l) => l.class_id === schedClass) : ctx.myLessons;

    const note = isAdmin
        ? t("common.perWeek", { lessons: count("lesson", lessons.length) })
        : isTeacher
          ? t("schedule.yourWeek", { lessons: count("lesson", lessons.length) })
          : t("schedule.classNote", { class: classes[ctx.meStudent?.class_id]?.name || "—", lessons: count("lesson", lessons.length) });

    const tabs = isAdmin
        ? `<div class="tabs">
               ${[...d.classes]
                   .sort(byName)
                   .map((c) => `<button class="tab${c.id === schedClass ? " is-active" : ""}" data-action="pick-schedule-class" data-id="${c.id}">${esc(c.name)}</button>`)
                   .join("")}
           </div>`
        : "";

    const dayHeads = DAYS.map(
        (day) => `
        <div class="day-head${day === TODAY ? " is-today" : ""}">${dayName(day)}${day === TODAY ? `<span class="today-badge">${t("schedule.today")}</span>` : ""}</div>`
    ).join("");

    const cell = (day, slotIndex) => {
        const [start, end] = SLOTS[slotIndex];
        const lesson = lessons.find((l) => l.day === day && l.start_time === start);
        const clickable = isAdmin ? " is-clickable" : "";

        if (!lesson) {
            return isAdmin
                ? `<button class="slot-empty${clickable}" title="${esc(t("schedule.addHint"))}" data-action="add-lesson" data-day="${day}" data-slot="${slotIndex}">+</button>`
                : `<div class="slot-empty"></div>`;
        }
        const className = classes[lesson.class_id]?.name;
        const line = isTeacher ? `${className} · ${lesson.room || ""}` : fullName(teachers[lesson.teacher_id]);
        const bottom = isTeacher ? `${start}–${end}` : `${lesson.room || "—"}${isAdmin ? "" : " · " + className}`;
        return `
            <button class="lesson-block${day === TODAY ? " is-today" : ""}${clickable}" data-block
                    ${isAdmin ? `data-action="edit-lesson" data-id="${lesson.id}"` : ""}>
                <span class="lesson-subject">${esc(subjects[lesson.subject_id]?.name || "—")}</span>
                <span class="lesson-line ellipsis">${esc(line)}</span>
                <span class="lesson-room">${esc(bottom)}</span>
            </button>`;
    };

    const breakRow = (label, time) => `
        <div class="break-row">
            <span class="meta" style="font-size:10.5px">${time}</span>
            <div class="break-label eyebrow">${label}</div>
        </div>`;

    const slotRow = (slotIndex) => `
        <div class="sched-row">
            <div class="slot-time"><span>${SLOTS[slotIndex][0]}</span><span class="muted">${SLOTS[slotIndex][1]}</span></div>
            ${DAYS.map((day) => cell(day, slotIndex)).join("")}
        </div>`;

    return `
    <div class="stack">
        <div class="toolbar" data-anim style="gap:12px">
            ${tabs}
            <span class="meta" style="font-size:12px">${note}</span>
            <div class="spacer"></div>
            ${isAdmin ? `<button class="btn btn-primary" data-action="add-lesson">${t("schedule.add")}</button>` : ""}
        </div>
        <div class="table-wrap" data-anim>
            <div class="schedule">
                <div class="sched-row sched-head"><span></span>${dayHeads}</div>
                ${slotRow(0)}${slotRow(1)}
                ${breakRow(t("schedule.break"), "10:10")}
                ${slotRow(2)}${slotRow(3)}
                ${breakRow(t("schedule.lunch"), "12:10")}
                ${slotRow(4)}${slotRow(5)}
            </div>
        </div>
    </div>`;
}

/* ---- Student drawer ----------------------------------------------------- */

function renderDrawer(ctx) {
    const student = state.detailId && ctx.d.students.find((s) => s.id === state.detailId);
    if (!student) return "";

    const subjects = subjectBreakdown(ctx, student)
        .map(
            (r) => `
        <div class="drawer-subject">
            <div class="drawer-subject-head">
                <strong>${esc(r.name)}</strong>
                <span class="muted">${esc(r.teacher)}</span>
                <span class="mono">${oneDecimal(r.average)}</span>
            </div>
            <div class="chips" style="gap:5px">
                ${r.grades.map((g) => gradeChip(g.grade, { small: true, title: shortDate(g.date) })).join("") || `<span class="muted" style="font-size:12px">${t("common.noGradesYet")}</span>`}
            </div>
        </div>`
        )
        .join("");

    return `
    <div class="drawer-backdrop" data-action="close-drawer">
        <div class="drawer" data-action="noop">
            <div class="drawer-top">
                <span class="meta" style="font-size:11px">students / ${String(student.id).padStart(3, "0")}</span>
                <button class="link-btn" data-action="close-drawer">${t("common.close")}</button>
            </div>
            <div class="drawer-name">
                <strong>${esc(fullName(student))}</strong>
                <span>${esc(student.email)}</span>
            </div>
            <div class="drawer-stats">
                <div><span class="eyebrow">${t("drawer.class")}</span><strong>${esc(ctx.classes[student.class_id]?.name || "—")}</strong></div>
                <div><span class="eyebrow">${t("drawer.average")}</span><strong>${oneDecimal(ctx.averageOf(student.id))}</strong></div>
                <div><span class="eyebrow">${t("drawer.lessons")}</span><strong>${ctx.d.lessons.filter((l) => l.class_id === student.class_id).length}</strong></div>
            </div>
            <div class="section">
                <span class="drawer-heading">${esc(t("drawer.subjects"))}</span>
                ${subjects}
            </div>
            <div class="drawer-actions">
                <button class="btn btn-primary" data-action="edit-student" data-id="${student.id}">${t("drawer.edit")}</button>
                <button class="btn btn-outline" data-action="grade-student" data-id="${student.id}">${t("drawer.grade")}</button>
            </div>
        </div>
    </div>`;
}

/* ---- Modal -------------------------------------------------------------- */

function textField(label, field, { type = "text", placeholder = "", min, max } = {}) {
    return `
        <label class="field">${label}
            <input id="form-${field}" class="input" type="${type}" data-field="${field}" value="${esc(state.form[field])}"
                   placeholder="${esc(placeholder)}"${min != null ? ` min="${min}"` : ""}${max != null ? ` max="${max}"` : ""} />
        </label>`;
}

function selectField(label, field, options) {
    return `
        <label class="field">${label}
            <select class="select" data-field="${field}">${options}</select>
        </label>`;
}

function renderModal(ctx) {
    const modal = state.modal;
    if (!modal) return "";
    const { d } = ctx;
    const form = state.form;
    const classOptions = [...d.classes].sort(byName).map((c) => option(c.id, c.name, form.class_id)).join("");
    const teacherOptions = d.teachers.map((teacher) => option(teacher.id, fullName(teacher), form.teacher_id)).join("");

    const personFields = `
        <div class="form-grid">
            ${textField(t("form.firstName"), "first_name")}
            ${textField(t("form.lastName"), "last_name")}
        </div>
        ${textField(t("form.email"), "email", { placeholder: t("form.emailHint") })}`;

    const bodies = {
        student: () => personFields + selectField(t("form.class"), "class_id", option("", t("common.noClass"), form.class_id) + classOptions),

        teacher: () => `
            ${personFields}
            <div class="field">${t("form.subjects")}
                <div class="toggles">
                    ${d.subjects
                        .map((s) => {
                            const on = form.subject_ids.includes(s.id);
                            return `<button class="toggle${on ? " is-on" : ""}" data-action="toggle-subject" data-id="${s.id}">${esc(s.name)}</button>`;
                        })
                        .join("")}
                </div>
            </div>`,

        klass: () => `
            <div class="form-grid" style="grid-template-columns:2fr 1fr">
                ${textField(t("form.className"), "name", { placeholder: "4V1" })}
                ${textField(t("form.year"), "year", { type: "number", min: 1, max: 6 })}
            </div>`,

        lesson: () => `
            <div class="form-grid">
                ${selectField(t("form.class"), "class_id", classOptions)}
                ${selectField(t("form.subject"), "subject_id", option("", t("form.choose"), form.subject_id) + d.subjects.map((s) => option(s.id, s.name, form.subject_id)).join(""))}
                ${selectField(t("form.teacher"), "teacher_id", option("", t("common.unassigned"), form.teacher_id) + teacherOptions)}
                ${textField(t("form.room"), "room", { placeholder: "B1.04" })}
                ${selectField(t("form.day"), "day", DAYS.map((day) => option(day, dayName(day), form.day)).join(""))}
                ${selectField(t("form.time"), "slot", SLOTS.map((s, i) => option(i, `${s[0]} – ${s[1]}`, form.slot)).join(""))}
            </div>`,

        confirm: () => `<p class="modal-body">${esc(modal.body)}</p>`,
    };

    const title = modal.type === "confirm" ? modal.title : t(`modal.${modal.edit ? "edit" : "new"}.${modal.type}`);

    return `
    <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" data-action="noop">
            <span class="modal-title">${esc(title)}</span>
            ${bodies[modal.type]()}
            ${form.error ? `<span class="modal-error">${esc(form.error)}</span>` : ""}
            <div class="modal-actions">
                ${modal.type === "lesson" && modal.edit ? `<button class="link-btn underline" data-action="delete-lesson">${t("modal.deleteLesson")}</button>` : ""}
                <div class="spacer"></div>
                <button class="btn btn-outline" data-action="close-modal">${t("common.cancel")}</button>
                <button class="btn btn-primary" data-action="save-modal">${esc(modal.type === "confirm" ? modal.cta : t("common.save"))}</button>
            </div>
        </div>
    </div>`;
}

/* ==========================================================================
   Render loop
   ========================================================================== */

let previous = {}; // what was on screen last time, to decide which animations to play

function render() {
    if (!state.data) return;

    if (!state.authenticated) {
        $("#app").dataset.theme = state.theme;
        $("#main").innerHTML = renderLogin();
        $("#drawer-root").innerHTML = "";
        $("#modal-root").innerHTML = "";
        $("#nav-items").innerHTML = "";
        $("#dev-panel").innerHTML = "";
        return;
    }

    const ctx = buildContext();
    state.page = ctx.page;

    // Keep keyboard focus (and cursor position) in text inputs across re-renders.
    const active = document.activeElement;
    const focusId = active?.id;
    const caret = active?.selectionStart;

    $("#app").dataset.theme = state.theme;
    renderNav(ctx);
    renderDevPanel(ctx);
    $("#main").innerHTML = renderMain(ctx);
    $("#drawer-root").innerHTML = renderDrawer(ctx);
    $("#modal-root").innerHTML = renderModal(ctx);

    if (focusId && document.getElementById(focusId)) {
        const el = document.getElementById(focusId);
        el.focus();
        try {
            if (caret != null) el.setSelectionRange(caret, caret);
        } catch {
            /* number/date inputs don't support selection ranges */
        }
    }

    afterRender(ctx);
}

/* ==========================================================================
   Animation (only when GSAP loaded and the user hasn't asked for reduced motion)
   ========================================================================== */

function gsapOrNull() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !reduce && window.gsap ? window.gsap : null;
}

function afterRender(ctx) {
    const g = gsapOrNull();
    const pageKey = [ctx.page, state.role, state.teacherId, state.studentId, state.selClass, state.schedClass].join("|");
    const pageChanged = pageKey !== previous.pageKey;

    moveNavIndicator(!previous.pageKey);

    if (pageChanged) animatePage(g);
    if (pageChanged || state.gradeStudent !== previous.gradeStudent) animateGradeOverview(g, pageChanged);

    if (g && state.modal && !previous.modal) {
        g.fromTo(".modal-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.3 });
        g.fromTo(".modal", { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "expo.out", clearProps: "all" });
    }
    if (g && state.detailId && !previous.detailId) {
        g.fromTo(".drawer-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.3 });
        g.fromTo(".drawer", { xPercent: 100 }, { xPercent: 0, duration: 0.7, ease: "expo.out", clearProps: "transform" });
        g.fromTo(".drawer > *", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, delay: 0.15, ease: "power3.out", clearProps: "all" });
    }
    if (g && state.lastGradeId && state.lastGradeId !== previous.lastGradeId) {
        const chip = document.querySelector(`[data-gid="${state.lastGradeId}"]`);
        if (chip) g.fromTo(chip, { scale: 0 }, { scale: 1, duration: 0.6, ease: "back.out(2.2)", clearProps: "transform" });
    }
    if (g && previous.theme && state.theme !== previous.theme) {
        g.fromTo("#main", { opacity: 0.4 }, { opacity: 1, duration: 0.5, clearProps: "opacity" });
    }

    previous = {
        pageKey,
        gradeStudent: state.gradeStudent,
        modal: state.modal,
        detailId: state.detailId,
        lastGradeId: state.lastGradeId,
        theme: state.theme,
    };
}

function moveNavIndicator(instant) {
    const indicator = $("#nav-indicator");
    const active = document.querySelector(".nav-item.is-active");
    if (!active) {
        indicator.style.opacity = "0";
        return;
    }
    indicator.style.opacity = "1";
    const g = gsapOrNull();
    if (window.gsap) window.gsap.killTweensOf(indicator);
    if (g && !instant) g.to(indicator, { top: active.offsetTop, duration: 0.6, ease: "expo.out" });
    else indicator.style.top = active.offsetTop + "px";
}

function animatePage(g) {
    countUpStats(g);
    if (!g) return;
    const main = $("#main");
    const all = (selector) => main.querySelectorAll(selector);

    g.fromTo(all("[data-title]"), { yPercent: 105 }, { yPercent: 0, duration: 1, ease: "expo.out", clearProps: "transform" });
    g.fromTo(all("[data-anim]"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: "expo.out", clearProps: "opacity,transform" });

    const rows = all("[data-row]");
    if (rows.length) {
        g.fromTo(rows, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.022, delay: 0.18, ease: "power2.out", clearProps: "opacity,transform" });
    }
    const blocks = all("[data-block]");
    if (blocks.length) {
        g.fromTo(blocks, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.01, delay: 0.2, ease: "expo.out", clearProps: "opacity,transform" });
    }
}

/** Dashboard numbers count up from zero. */
function countUpStats(g) {
    if (!g) return;
    document.querySelectorAll("[data-count]").forEach((el) => {
        if (el.dataset.count === "") return;
        const target = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals);
        const counter = { value: 0 };
        g.to(counter, {
            value: target,
            duration: 1.6,
            ease: "expo.out",
            onUpdate: () => (el.textContent = formatNumber(counter.value, decimals)),
        });
    });
}

/** The grades ring fills and the subject bars grow when a student is shown. */
function animateGradeOverview(g, pageChanged) {
    const ring = $("#ring-value");
    if (!g || !ring) return;
    g.from(ring, { attr: { "stroke-dashoffset": RING_LENGTH }, duration: 1.2, ease: "power3.out" });
    g.from("[data-bar]", { width: 0, duration: 0.9, ease: "power2.out" });
    if (!pageChanged) {
        g.fromTo("#main [data-ov], #main [data-row]", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.03, ease: "power2.out", clearProps: "opacity,transform" });
    }
}

/** Fade an overlay out, then run `done` (which clears it from state). */
function closeOverlay(backdrop, panel, panelTo, done) {
    const g = gsapOrNull();
    const bg = document.querySelector(backdrop);
    if (!g || !bg) return done();
    g.to(panel, { ...panelTo, duration: 0.25, ease: "power2.in" });
    g.to(bg, { opacity: 0, duration: 0.28, onComplete: done });
}

function closeModal() {
    closeOverlay(".modal-backdrop", ".modal", { opacity: 0, y: 12, scale: 0.98 }, () => {
        state.modal = null;
        state.form = {};
        render();
    });
}

function closeDrawer(then) {
    closeOverlay(".drawer-backdrop", ".drawer", { xPercent: 100 }, () => {
        state.detailId = null;
        if (then) then();
        render();
    });
}

let toastTimer;

function toast(message) {
    const root = $("#toast-root");
    root.innerHTML = `<div class="toast">${esc(message)}</div>`;
    const el = root.firstElementChild;
    const g = gsapOrNull();
    if (g) g.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        if (g) g.to(el, { y: 30, opacity: 0, duration: 0.3, onComplete: () => el.remove() });
        else el.remove();
    }, 2400);
}

/* ==========================================================================
   Modals: open & save
   ========================================================================== */

function openModal(type, record = null, extra = {}) {
    const d = state.data;
    let form;
    if (type === "student") {
        form = record
            ? { ...record, class_id: record.class_id ?? "" }
            : { first_name: "", last_name: "", email: "", class_id: state.classFilter !== "all" ? Number(state.classFilter) : "" };
    }
    if (type === "teacher") {
        form = record
            ? { ...record, subject_ids: d.subjects.filter((s) => s.teacher_id === record.id).map((s) => s.id) }
            : { first_name: "", last_name: "", email: "", subject_ids: [] };
    }
    if (type === "klass") {
        form = record ? { ...record } : { name: "", year: 4 };
    }
    if (type === "lesson") {
        form = record
            ? { ...record, teacher_id: record.teacher_id ?? "", slot: Math.max(0, SLOTS.findIndex((s) => s[0] === record.start_time)) }
            : { class_id: state.schedClass, subject_id: "", teacher_id: "", room: "", day: "Monday", slot: 0, ...extra };
    }
    state.modal = { type, edit: !!record };
    state.form = form;
    render();
}

function confirmAction(title, body, cta, onConfirm) {
    state.modal = { type: "confirm", title, body, cta, onConfirm };
    state.form = {};
    render();
}

function showFormError(message) {
    state.form.error = message;
    render();
}

/** Turn SQLite constraint errors into something readable. */
function friendlyError(error) {
    const message = String(error.message || error);
    if (message.includes("UNIQUE constraint failed: teachers.email")) return t("error.teacherEmail");
    if (message.includes("UNIQUE constraint failed: lessons")) return t("error.lessonClash");
    return message;
}

function savePerson(table, f) {
    const first = (f.first_name || "").trim();
    const last = (f.last_name || "").trim();
    if (!first || !last) throw new Error(t("error.nameRequired"));
    const email = (f.email || "").trim() || makeEmail(first, last);

    if (table === "students") {
        const classId = f.class_id === "" ? null : f.class_id;
        if (f.id) {
            run("UPDATE students SET first_name = ?, last_name = ?, email = ?, class_id = ? WHERE id = ?", [first, last, email, classId, f.id]);
        } else {
            run("INSERT INTO students (first_name, last_name, email, class_id) VALUES (?, ?, ?, ?)", [first, last, email, classId]);
        }
        return;
    }

    let teacherId = f.id;
    if (teacherId) {
        run("UPDATE teachers SET first_name = ?, last_name = ?, email = ? WHERE id = ?", [first, last, email, teacherId]);
    } else {
        teacherId = run("INSERT INTO teachers (first_name, last_name, email) VALUES (?, ?, ?)", [first, last, email]);
    }
    // This teacher becomes the default teacher for exactly the selected subjects.
    run("UPDATE subjects SET teacher_id = NULL WHERE teacher_id = ?", [teacherId]);
    for (const subjectId of f.subject_ids) {
        run("UPDATE subjects SET teacher_id = ? WHERE id = ?", [teacherId, subjectId]);
    }
}

function saveClass(f) {
    const name = String(f.name || "").trim().toUpperCase();
    if (!name) throw new Error(t("error.className"));
    const clash = f.id
        ? query("SELECT 1 FROM classes WHERE name = ? AND id != ?", [name, f.id])
        : query("SELECT 1 FROM classes WHERE name = ?", [name]);
    if (clash.length) throw new Error(t("error.classExists", { name }));
    const year = Math.min(6, Math.max(1, Number(f.year) || 1));
    if (f.id) run("UPDATE classes SET name = ?, year = ? WHERE id = ?", [name, year, f.id]);
    else run("INSERT INTO classes (name, year) VALUES (?, ?)", [name, year]);
    return name;
}

function saveLesson(f) {
    if (!f.class_id || !f.subject_id) throw new Error(t("error.classAndSubject"));
    const [start, end] = SLOTS[f.slot || 0];
    const clash = f.id
        ? query("SELECT 1 FROM lessons WHERE class_id = ? AND day = ? AND start_time = ? AND id != ?", [
              f.class_id, f.day, start, f.id,
          ])
        : query("SELECT 1 FROM lessons WHERE class_id = ? AND day = ? AND start_time = ?", [
              f.class_id, f.day, start,
          ]);
    if (clash.length) throw new Error(t("error.lessonClash"));

    const values = [f.class_id, f.subject_id, f.teacher_id === "" ? null : f.teacher_id, f.room || "", f.day, start, end];
    if (f.id) {
        run("UPDATE lessons SET class_id = ?, subject_id = ?, teacher_id = ?, room = ?, day = ?, start_time = ?, end_time = ? WHERE id = ?", [...values, f.id]);
    } else {
        run("INSERT INTO lessons (class_id, subject_id, teacher_id, room, day, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)", values);
    }
}

function saveModal() {
    const { modal, form: f } = state;
    try {
        if (modal.type === "confirm") {
            modal.onConfirm();
        } else if (modal.type === "student") {
            mutate(() => savePerson("students", f), t(f.id ? "toast.studentUpdated" : "toast.studentAdded"));
        } else if (modal.type === "teacher") {
            mutate(() => savePerson("teachers", f), t(f.id ? "toast.teacherUpdated" : "toast.teacherAdded"));
        } else if (modal.type === "klass") {
            let name;
            mutate(() => (name = saveClass(f)));
            toast(f.id ? t("toast.classRenamed") : t("toast.classCreated", { name }));
        } else if (modal.type === "lesson") {
            mutate(() => saveLesson(f), t(f.id ? "toast.lessonUpdated" : "toast.lessonAdded"));
        }
        closeModal();
    } catch (error) {
        showFormError(friendlyError(error));
    }
}

function saveGrade() {
    const ctx = buildContext();
    const { student, subject } = gradeTargets(ctx);
    const value = parseFloat(String(state.gradeForm.grade).replace(",", "."));

    if (!student || !subject) {
        state.gradeError = t("error.pickStudent");
        return render();
    }
    if (isNaN(value) || value < 1 || value > 10) {
        state.gradeError = t("error.gradeRange", { min: formatNumber(1, 1), max: formatNumber(10, 1) });
        return render();
    }

    const grade = Math.round(value * 10) / 10;
    state.gradeError = null;
    state.gradeForm.grade = "";
    state.lastGradeId = mutate(
        () =>
            run("INSERT INTO grades (student_id, subject_id, grade, date) VALUES (?, ?, ?, ?)", [
                student.id, subject.id, grade, state.gradeForm.date || TODAY_DATE,
            ]),
        t("toast.gradeSaved", { grade: formatNumber(grade, 1), name: student.first_name, subject: subject.name })
    );
    render(); // pops the new chip now that lastGradeId is known
}

/* ==========================================================================
   Event handling
   ========================================================================== */

const findStudent = (id) => state.data.students.find((s) => s.id === id);
const findTeacher = (id) => state.data.teachers.find((teacher) => teacher.id === id);
const findClass = (id) => state.data.classes.find((c) => c.id === id);

function go(page) {
    Object.assign(state, { page, selClass: null, detailId: null });
    render();
}

/** Click handlers, keyed by data-action. `el` is the clicked element. */
const actions = {
    noop: () => {},
    go: (el) => go(el.dataset.page),
    "toggle-sql": () => {
        state.sqlOpen = !state.sqlOpen;
        render();
    },
    "toggle-theme": () => {
        state.theme = state.theme === "light" ? "dark" : "light";
        render();
    },
    "switch-language": () => {
        setLanguage(nextLanguage());
        loadData(); // re-reads subject names in the new language
        render();
    },
    "login-submit": async () => {
        const email = document.getElementById("login-email")?.value || "";
        const password = document.getElementById("login-password")?.value || "";
        const result = await loginWithEmail(email, password);
        if (!result.ok) {
            state.loginError = result.message;
            render();
            return;
        }
        state.authenticated = true;
        state.authUser = result.user;
        state.role = result.user.role;
        if (result.user.role === "teacher") state.teacherId = result.user.teacher_id || state.teacherId || 1;
        if (result.user.role === "student") state.studentId = result.user.student_id || state.studentId || 1;
        state.loginError = "";
        render();
    },
    logout: () => {
        clearSession();
        state.authenticated = false;
        state.authUser = null;
        state.loginError = "";
        state.role = "admin";
        render();
    },

    // Dev panel
    "download-db": downloadDatabase,
    "open-db": () => $("#db-file").click(),
    "ask-reset": () =>
        confirmAction(
            t("confirm.reset.title"),
            t("confirm.reset.body"),
            t("confirm.reset.cta"),
            async () => {
                useDatabase(freshDatabase());
                persist();
                loadData();
                await ensureAuthTableAndUsers();
                loadData();
                Object.assign(state, { selClass: null, detailId: null });
                render();
                toast(t("toast.demoRestored"));
            }
        ),

    // Students
    "open-student": (el) => {
        state.detailId = Number(el.dataset.id);
        render();
    },
    "close-drawer": () => closeDrawer(),
    "add-student": () => openModal("student"),
    "edit-student": (el) => {
        const student = findStudent(Number(el.dataset.id));
        if (state.detailId) {
            state.detailId = null;
        }
        openModal("student", student);
    },
    "delete-student": (el) => {
        const s = findStudent(Number(el.dataset.id));
        const gradeCount = state.data.grades.filter((g) => g.student_id === s.id).length;
        confirmAction(t("confirm.delete.title", { name: fullName(s) }), t("confirm.deleteStudent.body", { grades: count("grade", gradeCount) }), t("common.delete"), () =>
            // Their grades are removed by ON DELETE CASCADE.
            mutate(() => run("DELETE FROM students WHERE id = ?", [s.id]), t("toast.studentDeleted"))
        );
    },
    "grade-student": (el) => {
        Object.assign(state, { detailId: null, page: "grades", gradeStudent: Number(el.dataset.id) });
        render();
    },

    // Teachers
    "add-teacher": () => openModal("teacher"),
    "edit-teacher": (el) => openModal("teacher", findTeacher(Number(el.dataset.id))),
    "delete-teacher": (el) => {
        const teacher = findTeacher(Number(el.dataset.id));
        const lessonCount = state.data.lessons.filter((l) => l.teacher_id === teacher.id).length;
        confirmAction(t("confirm.delete.title", { name: fullName(teacher) }), t("confirm.deleteTeacher.body", { lessons: count("lesson", lessonCount) }), t("common.delete"), () =>
            // subjects.teacher_id and lessons.teacher_id become NULL via ON DELETE SET NULL.
            mutate(() => run("DELETE FROM teachers WHERE id = ?", [teacher.id]), t("toast.teacherDeleted"))
        );
    },
    "toggle-subject": (el) => {
        const id = Number(el.dataset.id);
        const ids = state.form.subject_ids;
        state.form.subject_ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
        render();
    },

    // Classes
    "add-class": () => openModal("klass"),
    "open-class": (el) => {
        Object.assign(state, { selClass: Number(el.dataset.id), addSel: "" });
        render();
    },
    "back-to-classes": () => {
        state.selClass = null;
        render();
    },
    "edit-class": (el) => openModal("klass", findClass(Number(el.dataset.id))),
    "delete-class": (el) => {
        const c = findClass(Number(el.dataset.id));
        confirmAction(t("confirm.delete.title", { name: c.name }), t("confirm.deleteClass.body"), t("common.delete"), () => {
            state.selClass = null;
            mutate(() => run("DELETE FROM classes WHERE id = ?", [c.id]), t("toast.classDeleted"));
        });
    },
    "add-to-class": () => {
        const id = Number(state.addSel);
        if (!id) return;
        const s = findStudent(id);
        const c = findClass(state.selClass);
        state.addSel = "";
        mutate(() => run("UPDATE students SET class_id = ? WHERE id = ?", [c.id, id]), t("toast.addedToClass", { name: s.first_name, class: c.name }));
    },
    "remove-from-class": (el) => {
        const s = findStudent(Number(el.dataset.id));
        const c = findClass(state.selClass);
        mutate(() => run("UPDATE students SET class_id = NULL WHERE id = ?", [s.id]), t("toast.removedFromClass", { name: s.first_name, class: c.name }));
    },

    // Grades
    "save-grade": saveGrade,

    // Schedule
    "pick-schedule-class": (el) => {
        state.schedClass = Number(el.dataset.id);
        render();
    },
    "add-lesson": (el) => {
        const ctx = buildContext();
        const classId = ctx.classes[state.schedClass] ? state.schedClass : state.data.classes[0]?.id;
        const extra = { class_id: classId };
        if (el.dataset.day) Object.assign(extra, { day: el.dataset.day, slot: Number(el.dataset.slot) });
        openModal("lesson", null, extra);
    },
    "edit-lesson": (el) => openModal("lesson", state.data.lessons.find((l) => l.id === Number(el.dataset.id))),
    "delete-lesson": () => {
        try {
            mutate(() => run("DELETE FROM lessons WHERE id = ?", [state.form.id]), t("toast.lessonRemoved"));
            closeModal();
        } catch (error) {
            showFormError(friendlyError(error));
        }
    },

    // Modal
    "close-modal": () => closeModal(),
    "save-modal": saveModal,
};

/** Select handlers, keyed by data-change. */
const changes = {
    role: (value) => {
        Object.assign(state, { role: value, selClass: null, detailId: null });
        render();
    },
    teacherId: (value) => {
        Object.assign(state, { teacherId: Number(value), selClass: null });
        render();
    },
    studentId: (value) => {
        state.studentId = Number(value);
        render();
    },
    classFilter: (value) => {
        state.classFilter = value;
        render();
    },
    addSel: (value) => {
        state.addSel = value;
    },
    gradeStudent: (value) => {
        Object.assign(state, { gradeStudent: Number(value), gradeError: null });
        render();
    },
    gradeSubject: (value) => {
        state.gradeForm.subject_id = Number(value);
        render();
    },
    "class-subject-teacher": (value, el) => {
        const teacherId = Number(value) || null;
        const subjectId = Number(el.dataset.subject);
        const c = findClass(state.selClass);
        const subject = state.data.subjects.find((s) => s.id === subjectId);
        mutate(
            () => run("UPDATE lessons SET teacher_id = ? WHERE class_id = ? AND subject_id = ?", [teacherId, c.id, subjectId]),
            t("toast.assigned", { subject: subject.name, class: c.name, teacher: fullName(findTeacher(teacherId)) })
        );
    },
};

/** Text-input handlers, keyed by data-input. They update state without a full redraw where possible. */
const inputs = {
    search: (value) => {
        state.search = value;
        render();
    },
    grade: (value) => {
        state.gradeForm.grade = value;
        if (state.gradeError) {
            state.gradeError = null;
            render();
        }
    },
    gradeDate: (value) => {
        state.gradeForm.date = value;
    },
};

/** Modal form fields (data-field). Ids, year and slot are stored as numbers. */
function updateFormField(el) {
    const field = el.dataset.field;
    const numeric = /_id$|^year$|^slot$/.test(field);
    const value = numeric && el.value !== "" ? Number(el.value) : el.value;
    state.form[field] = value;
    state.form.error = null;

    // Picking a subject for a lesson pre-fills its usual teacher and classroom.
    if (state.modal?.type === "lesson" && field === "subject_id") {
        const subject = state.data.subjects.find((s) => s.id === value);
        if (subject?.teacher_id) state.form.teacher_id = subject.teacher_id;
        if (!state.form.room) state.form.room = ROOMS[value] || "";
    }
}

function attachEvents() {
    document.addEventListener("click", (event) => {
        const el = event.target.closest("[data-action]");
        if (!el || el.matches("input, select")) return;
        actions[el.dataset.action]?.(el, event);
    });

    document.addEventListener("input", (event) => {
        const el = event.target;
        if (el.dataset.input) inputs[el.dataset.input]?.(el.value, el);
        if (el.dataset.field && el.tagName === "INPUT") updateFormField(el);
    });

    document.addEventListener("submit", (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.id !== "login-form") return;
        event.preventDefault();
        actions["login-submit"]?.();
    });

    document.addEventListener("change", (event) => {
        const el = event.target;
        if (el.dataset.change) changes[el.dataset.change]?.(el.value, el);
        if (el.dataset.field && el.tagName === "SELECT") {
            updateFormField(el);
            render();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target.id === "grade-value") saveGrade();
        if (event.key === "Escape") {
            if (state.modal) closeModal();
            else if (state.detailId) closeDrawer();
        }
    });

    $("#db-file").addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) openDatabaseFile(file);
        event.target.value = "";
    });
}

/* ==========================================================================
   Start
   ========================================================================== */

async function start() {
    $("#main").innerHTML = `<p class="muted">${t("loading")}</p>`;
    try {
        SQL = await initSqlJs({ locateFile: (file) => SQL_JS_CDN + file });
    } catch (error) {
        $("#main").innerHTML = `<p class="muted">${t("loading.failed")}</p>`;
        return;
    }

    const saved = loadSavedDatabase();
    useDatabase(saved || freshDatabase());
    if (!saved) persist();
    loadData();
    await ensureAuthTableAndUsers();
    loadData();

    const session = loadSession();
    if (session?.email) {
        const rows = query("SELECT * FROM users WHERE email = ?", [session.email.toLowerCase()]);
        if (rows[0]) {
            state.authenticated = true;
            state.authUser = rows[0];
            state.role = rows[0].role;
            if (rows[0].role === "teacher") state.teacherId = rows[0].teacher_id || state.teacherId || 1;
            if (rows[0].role === "student") state.studentId = rows[0].student_id || state.studentId || 1;
        }
    }

    attachEvents();
    render();

    // Sidebar slides in once on load.
    const g = gsapOrNull();
    if (g) g.fromTo("[data-side]", { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.05, ease: "power3.out", clearProps: "opacity,transform" });
}

start();
