/* ==========================================================================
   SchoolHub — localization
   --------------------------------------------------------------------------
   All interface text, per language. To add a language:
     1. add it to LANGUAGES (display name + Intl locale),
     2. copy the `en` block in TRANSLATIONS and translate the values.
   Missing keys fall back to English.

   Placeholders look like {name}. Entries with { one, other } are plurals,
   picked with Intl.PluralRules from the {n} parameter.

   Data from the database (people, class names, test titles) is shown as is.
   Days and subject names are stored in English in the database and are
   translated for display only (see `day.*` and `subject.*`).
   ========================================================================== */

"use strict";

const LANGUAGES = {
    en: { name: "English", locale: "en-GB" },
    nl: { name: "Nederlands", locale: "nl-NL" },
};

const TRANSLATIONS = {
    en: {
        // Navigation & roles
        "nav.dashboard": "Dashboard",
        "nav.students": "Students",
        "nav.teachers": "Teachers",
        "nav.classes": "Classes",
        "nav.grades": "Grades",
        "nav.schedule": "Schedule",
        "role.admin": "Admin",
        "role.teacher": "Teacher",
        "role.student": "Student",

        // Dev panel & top bar
        "dev.viewAs": "Dev · view as",
        "dev.download": "Download .db file",
        "dev.open": "Open .db file",
        "dev.reset": "Reset demo data",
        "top.dark": "Dark",
        "top.light": "Light",
        "top.sqlLabel": "sqlite — query behind this view",
        "me.admin": "School admin",
        "me.studentRole": "Student · {class}",
        "loading": "Loading database…",
        "loading.failed": "Could not load SQLite (sql.js). Check your internet connection and reload.",

        // Counted nouns
        "count.student": { one: "{n} student", other: "{n} students" },
        "count.teacher": { one: "{n} teacher", other: "{n} teachers" },
        "count.class": { one: "{n} class", other: "{n} classes" },
        "count.lesson": { one: "{n} lesson", other: "{n} lessons" },
        "count.grade": { one: "{n} grade", other: "{n} grades" },

        // Page titles & subtitles
        "greeting": "Good morning.",
        "greeting.name": "Good morning, {name}.",
        "subtitle.dashboard.admin": "{students}, {teachers} and {classes} this term.",
        "subtitle.dashboard.teacher": "Your classes, grades and lessons at a glance.",
        "subtitle.dashboard.student": "Your grades, tests and timetable at a glance.",
        "subtitle.students": "{students} across {classes}. Select a row to see classes and grades.",
        "subtitle.teachers": "{teachers} and the subjects they teach.",
        "subtitle.classes.admin": "Create classes, add students and assign teachers.",
        "subtitle.classes.teacher": "The classes you teach.",
        "subtitle.classDetail": "Year {year} class.",
        "subtitle.grades.student": "All your grades this term, per subject.",
        "subtitle.grades.staff": "Enter a grade and see the student’s averages update.",
        "subtitle.schedule": "Day, time, subject, teacher, classroom and class.",

        // Shared
        "common.edit": "Edit",
        "common.delete": "Delete",
        "common.add": "Add",
        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.close": "Close ✕",
        "common.unassigned": "Unassigned",
        "common.unknown": "Unknown",
        "common.noClass": "No class",
        "common.noGradesYet": "No grades yet",
        "common.year": "Year {year}",
        "common.perWeek": "{lessons} per week",

        // Dashboard
        "stat.students": "Students",
        "stat.teachers": "Teachers",
        "stat.classes": "Classes",
        "stat.myClasses": "My classes",
        "stat.myStudents": "My students",
        "stat.lessons": "Lessons",
        "stat.average": "Average",
        "stat.grades": "Grades",
        "note.enrolled": "enrolled",
        "note.onStaff": "on staff",
        "note.thisYear": "this year",
        "note.thisTerm": "this term",
        "note.inTotal": "in total",
        "note.perWeek": "per week",
        "note.allSubjects": "all subjects",
        "dash.recentGrades": "Recent grades",
        "dash.viewAll": "View all →",
        "dash.noGrades": "No grades yet.",
        "dash.upcomingTests": "Upcoming tests",
        "dash.noTests": "Nothing scheduled.",
        "dash.today": "Today",
        "dash.schoolWide": "{lessons} school-wide",
        "dash.noLessons": "No lessons today.",

        // Students
        "students.search": "Search name or email",
        "students.allClasses": "All classes",
        "students.add": "+ Add student",
        "students.noMatch": "No students match this search.",
        "col.student": "Student",
        "col.email": "Email",
        "col.class": "Class",
        "col.average": "Average",

        // Teachers
        "teachers.add": "+ Add teacher",
        "teachers.noSubjects": "No subjects assigned",
        "teachers.noClasses": "No classes",

        // Classes
        "classes.create": "+ Create class",
        "classes.cardMeta": "{teachers} · avg {average}",
        "classes.back": "← All classes",
        "classes.rename": "Rename",
        "classes.delete": "Delete class",
        "classes.students": "Students",
        "classes.empty": "No students in this class yet.",
        "classes.addStudent": "Add a student…",
        "classes.remove": "Remove from class",
        "classes.subjectsTeachers": "Subjects & teachers",
        "classes.assignNote": "Assigning a teacher updates every lesson of that subject for {class}.",
        "classes.lessonsPerWeek": "{lessons}/week",

        // Grades
        "grades.newEntry": "New entry",
        "grades.enter": "Enter a grade",
        "grades.student": "Student",
        "grades.subject": "Subject",
        "grades.grade": "Grade (1–10)",
        "grades.date": "Date",
        "grades.save": "Save grade",
        "grades.average": "average",
        "grades.below": "{n} below {limit}",
        "grades.allSufficient": "all sufficient",
        "grades.footnote": "Filled grades are below {limit} (insufficient).",

        // Schedule
        "schedule.yourWeek": "Your week · {lessons}",
        "schedule.classNote": "Class {class} · {lessons}",
        "schedule.add": "+ Add lesson",
        "schedule.addHint": "Add lesson",
        "schedule.today": "TODAY",
        "schedule.break": "Break",
        "schedule.lunch": "Lunch",

        // Student drawer
        "drawer.class": "Class",
        "drawer.average": "Average",
        "drawer.lessons": "Lessons/wk",
        "drawer.subjects": "Subjects & grades",
        "drawer.edit": "Edit student",
        "drawer.grade": "Enter grade",

        // Forms & modals
        "form.firstName": "First name",
        "form.lastName": "Last name",
        "form.email": "Email",
        "form.emailHint": "Generated if left empty",
        "form.class": "Class",
        "form.subjects": "Subjects taught",
        "form.className": "Class name",
        "form.year": "Year",
        "form.subject": "Subject",
        "form.teacher": "Teacher",
        "form.room": "Classroom",
        "form.day": "Day",
        "form.time": "Time",
        "form.choose": "Choose…",
        "modal.new.student": "New student",
        "modal.edit.student": "Edit student",
        "modal.new.teacher": "New teacher",
        "modal.edit.teacher": "Edit teacher",
        "modal.new.klass": "New class",
        "modal.edit.klass": "Edit class",
        "modal.new.lesson": "New lesson",
        "modal.edit.lesson": "Edit lesson",
        "modal.deleteLesson": "Delete lesson",

        // Confirmations
        "confirm.reset.title": "Reset demo data?",
        "confirm.reset.body": "All students, teachers, classes, grades and lessons go back to the seeded demo set.",
        "confirm.reset.cta": "Reset",
        "confirm.delete.title": "Delete {name}?",
        "confirm.deleteStudent.body": "This removes the student and all {grades}. This can’t be undone.",
        "confirm.deleteTeacher.body": "Their subjects and {lessons} become unassigned.",
        "confirm.deleteClass.body": "Students stay in the system without a class; the class’s lessons and tests are removed.",

        // Errors
        "error.nameRequired": "First and last name are required.",
        "error.className": "Give the class a name, e.g. 4V1.",
        "error.classExists": "{name} already exists.",
        "error.classAndSubject": "Choose a class and a subject.",
        "error.lessonClash": "That class already has a lesson at this time.",
        "error.teacherEmail": "Another teacher already uses this email.",
        "error.pickStudent": "Pick a student and a subject.",
        "error.gradeRange": "Enter a grade between {min} and {max}.",

        // Toasts
        "toast.studentAdded": "Student added",
        "toast.studentUpdated": "Student updated",
        "toast.studentDeleted": "Student deleted",
        "toast.teacherAdded": "Teacher added",
        "toast.teacherUpdated": "Teacher updated",
        "toast.teacherDeleted": "Teacher deleted",
        "toast.classCreated": "Class {name} created",
        "toast.classRenamed": "Class renamed",
        "toast.classDeleted": "Class deleted",
        "toast.lessonAdded": "Lesson added",
        "toast.lessonUpdated": "Lesson updated",
        "toast.lessonRemoved": "Lesson removed",
        "toast.gradeSaved": "{grade} saved for {name} · {subject}",
        "toast.addedToClass": "{name} added to {class}",
        "toast.removedFromClass": "{name} removed from {class}",
        "toast.assigned": "{subject} in {class} → {teacher}",
        "toast.demoRestored": "Demo data restored",
        "toast.opened": "Opened {file}",
        "toast.notSchoolhub": "Not a SchoolHub database (missing: {tables})",
        "toast.openFailed": "Could not open that file",

        // Days and subjects (stored in English in the database)
        "day.Monday": "Monday",
        "day.Tuesday": "Tuesday",
        "day.Wednesday": "Wednesday",
        "day.Thursday": "Thursday",
        "day.Friday": "Friday",
    },

    nl: {
        "nav.dashboard": "Dashboard",
        "nav.students": "Leerlingen",
        "nav.teachers": "Docenten",
        "nav.classes": "Klassen",
        "nav.grades": "Cijfers",
        "nav.schedule": "Rooster",
        "role.admin": "Beheerder",
        "role.teacher": "Docent",
        "role.student": "Leerling",

        "dev.viewAs": "Dev · bekijk als",
        "dev.download": "Download .db-bestand",
        "dev.open": "Open .db-bestand",
        "dev.reset": "Demodata herstellen",
        "top.dark": "Donker",
        "top.light": "Licht",
        "top.sqlLabel": "sqlite — query achter deze weergave",
        "me.admin": "Schoolbeheerder",
        "me.studentRole": "Leerling · {class}",
        "loading": "Database laden…",
        "loading.failed": "SQLite (sql.js) kon niet worden geladen. Controleer je internetverbinding en laad de pagina opnieuw.",

        "count.student": { one: "{n} leerling", other: "{n} leerlingen" },
        "count.teacher": { one: "{n} docent", other: "{n} docenten" },
        "count.class": { one: "{n} klas", other: "{n} klassen" },
        "count.lesson": { one: "{n} les", other: "{n} lessen" },
        "count.grade": { one: "{n} cijfer", other: "{n} cijfers" },

        "greeting": "Goedemorgen.",
        "greeting.name": "Goedemorgen, {name}.",
        "subtitle.dashboard.admin": "{students}, {teachers} en {classes} deze periode.",
        "subtitle.dashboard.teacher": "Je klassen, cijfers en lessen in één oogopslag.",
        "subtitle.dashboard.student": "Je cijfers, toetsen en rooster in één oogopslag.",
        "subtitle.students": "{students} verdeeld over {classes}. Kies een rij om klas en cijfers te bekijken.",
        "subtitle.teachers": "{teachers} en de vakken die ze geven.",
        "subtitle.classes.admin": "Maak klassen aan, voeg leerlingen toe en wijs docenten toe.",
        "subtitle.classes.teacher": "De klassen waaraan je lesgeeft.",
        "subtitle.classDetail": "Klas in leerjaar {year}.",
        "subtitle.grades.student": "Al je cijfers van deze periode, per vak.",
        "subtitle.grades.staff": "Voer een cijfer in en zie het gemiddelde van de leerling meteen bijwerken.",
        "subtitle.schedule": "Dag, tijd, vak, docent, lokaal en klas.",

        "common.edit": "Bewerken",
        "common.delete": "Verwijderen",
        "common.add": "Toevoegen",
        "common.save": "Opslaan",
        "common.cancel": "Annuleren",
        "common.close": "Sluiten ✕",
        "common.unassigned": "Niet toegewezen",
        "common.unknown": "Onbekend",
        "common.noClass": "Geen klas",
        "common.noGradesYet": "Nog geen cijfers",
        "common.year": "Leerjaar {year}",
        "common.perWeek": "{lessons} per week",

        "stat.students": "Leerlingen",
        "stat.teachers": "Docenten",
        "stat.classes": "Klassen",
        "stat.myClasses": "Mijn klassen",
        "stat.myStudents": "Mijn leerlingen",
        "stat.lessons": "Lessen",
        "stat.average": "Gemiddelde",
        "stat.grades": "Cijfers",
        "note.enrolled": "ingeschreven",
        "note.onStaff": "in dienst",
        "note.thisYear": "dit schooljaar",
        "note.thisTerm": "deze periode",
        "note.inTotal": "in totaal",
        "note.perWeek": "per week",
        "note.allSubjects": "alle vakken",
        "dash.recentGrades": "Recente cijfers",
        "dash.viewAll": "Alles bekijken →",
        "dash.noGrades": "Nog geen cijfers.",
        "dash.upcomingTests": "Komende toetsen",
        "dash.noTests": "Niets gepland.",
        "dash.today": "Vandaag",
        "dash.schoolWide": "{lessons} schoolbreed",
        "dash.noLessons": "Vandaag geen lessen.",

        "students.search": "Zoek op naam of e-mail",
        "students.allClasses": "Alle klassen",
        "students.add": "+ Leerling toevoegen",
        "students.noMatch": "Geen leerlingen gevonden.",
        "col.student": "Leerling",
        "col.email": "E-mail",
        "col.class": "Klas",
        "col.average": "Gemiddelde",

        "teachers.add": "+ Docent toevoegen",
        "teachers.noSubjects": "Geen vakken toegewezen",
        "teachers.noClasses": "Geen klassen",

        "classes.create": "+ Klas aanmaken",
        "classes.cardMeta": "{teachers} · gem. {average}",
        "classes.back": "← Alle klassen",
        "classes.rename": "Hernoemen",
        "classes.delete": "Klas verwijderen",
        "classes.students": "Leerlingen",
        "classes.empty": "Nog geen leerlingen in deze klas.",
        "classes.addStudent": "Leerling toevoegen…",
        "classes.remove": "Uit klas halen",
        "classes.subjectsTeachers": "Vakken & docenten",
        "classes.assignNote": "Een docent toewijzen past elke les van dat vak voor {class} aan.",
        "classes.lessonsPerWeek": "{lessons}/week",

        "grades.newEntry": "Nieuw cijfer",
        "grades.enter": "Cijfer invoeren",
        "grades.student": "Leerling",
        "grades.subject": "Vak",
        "grades.grade": "Cijfer (1–10)",
        "grades.date": "Datum",
        "grades.save": "Cijfer opslaan",
        "grades.average": "gemiddelde",
        "grades.below": "{n} onder de {limit}",
        "grades.allSufficient": "alles voldoende",
        "grades.footnote": "Gevulde cijfers zijn lager dan {limit} (onvoldoende).",

        "schedule.yourWeek": "Jouw week · {lessons}",
        "schedule.classNote": "Klas {class} · {lessons}",
        "schedule.add": "+ Les toevoegen",
        "schedule.addHint": "Les toevoegen",
        "schedule.today": "VANDAAG",
        "schedule.break": "Pauze",
        "schedule.lunch": "Lunchpauze",

        "drawer.class": "Klas",
        "drawer.average": "Gemiddelde",
        "drawer.lessons": "Lessen/wk",
        "drawer.subjects": "Vakken & cijfers",
        "drawer.edit": "Leerling bewerken",
        "drawer.grade": "Cijfer invoeren",

        "form.firstName": "Voornaam",
        "form.lastName": "Achternaam",
        "form.email": "E-mail",
        "form.emailHint": "Wordt aangemaakt als je dit leeg laat",
        "form.class": "Klas",
        "form.subjects": "Vakken",
        "form.className": "Klasnaam",
        "form.year": "Leerjaar",
        "form.subject": "Vak",
        "form.teacher": "Docent",
        "form.room": "Lokaal",
        "form.day": "Dag",
        "form.time": "Tijd",
        "form.choose": "Kies…",
        "modal.new.student": "Nieuwe leerling",
        "modal.edit.student": "Leerling bewerken",
        "modal.new.teacher": "Nieuwe docent",
        "modal.edit.teacher": "Docent bewerken",
        "modal.new.klass": "Nieuwe klas",
        "modal.edit.klass": "Klas bewerken",
        "modal.new.lesson": "Nieuwe les",
        "modal.edit.lesson": "Les bewerken",
        "modal.deleteLesson": "Les verwijderen",

        "confirm.reset.title": "Demodata herstellen?",
        "confirm.reset.body": "Alle leerlingen, docenten, klassen, cijfers en lessen gaan terug naar de oorspronkelijke demoset.",
        "confirm.reset.cta": "Herstellen",
        "confirm.delete.title": "{name} verwijderen?",
        "confirm.deleteStudent.body": "Hiermee verwijder je de leerling en alle {grades}. Dit kan niet ongedaan worden gemaakt.",
        "confirm.deleteTeacher.body": "Hun vakken en {lessons} hebben daarna geen docent meer.",
        "confirm.deleteClass.body": "Leerlingen blijven in het systeem zonder klas; de lessen en toetsen van de klas worden verwijderd.",

        "error.nameRequired": "Voor- en achternaam zijn verplicht.",
        "error.className": "Geef de klas een naam, bijv. 4V1.",
        "error.classExists": "{name} bestaat al.",
        "error.classAndSubject": "Kies een klas en een vak.",
        "error.lessonClash": "Die klas heeft op dit moment al een les.",
        "error.teacherEmail": "Een andere docent gebruikt dit e-mailadres al.",
        "error.pickStudent": "Kies een leerling en een vak.",
        "error.gradeRange": "Voer een cijfer in tussen {min} en {max}.",

        "toast.studentAdded": "Leerling toegevoegd",
        "toast.studentUpdated": "Leerling bijgewerkt",
        "toast.studentDeleted": "Leerling verwijderd",
        "toast.teacherAdded": "Docent toegevoegd",
        "toast.teacherUpdated": "Docent bijgewerkt",
        "toast.teacherDeleted": "Docent verwijderd",
        "toast.classCreated": "Klas {name} aangemaakt",
        "toast.classRenamed": "Klas hernoemd",
        "toast.classDeleted": "Klas verwijderd",
        "toast.lessonAdded": "Les toegevoegd",
        "toast.lessonUpdated": "Les bijgewerkt",
        "toast.lessonRemoved": "Les verwijderd",
        "toast.gradeSaved": "{grade} opgeslagen voor {name} · {subject}",
        "toast.addedToClass": "{name} toegevoegd aan {class}",
        "toast.removedFromClass": "{name} uit {class} gehaald",
        "toast.assigned": "{subject} in {class} → {teacher}",
        "toast.demoRestored": "Demodata hersteld",
        "toast.opened": "{file} geopend",
        "toast.notSchoolhub": "Geen SchoolHub-database (ontbreekt: {tables})",
        "toast.openFailed": "Kon dat bestand niet openen",

        "day.Monday": "Maandag",
        "day.Tuesday": "Dinsdag",
        "day.Wednesday": "Woensdag",
        "day.Thursday": "Donderdag",
        "day.Friday": "Vrijdag",

        "subject.Mathematics": "Wiskunde",
        "subject.English": "Engels",
        "subject.Dutch": "Nederlands",
        "subject.Biology": "Biologie",
        "subject.History": "Geschiedenis",
        "subject.Geography": "Aardrijkskunde",
        "subject.Physics": "Natuurkunde",
        "subject.Chemistry": "Scheikunde",
        "subject.Art": "Kunst",
    },
};

/* ---- Current language --------------------------------------------------- */

const LANGUAGE_KEY = "schoolhub-language";

/** Saved choice, else the browser's language if we have it, else English. */
function detectLanguage() {
    try {
        const saved = localStorage.getItem(LANGUAGE_KEY);
        if (saved && LANGUAGES[saved]) return saved;
    } catch {
        /* storage unavailable: fall through */
    }
    const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGUAGES[browser] ? browser : "en";
}

let currentLanguage = detectLanguage();
document.documentElement.lang = currentLanguage;

function setLanguage(language) {
    if (!LANGUAGES[language]) return;
    currentLanguage = language;
    document.documentElement.lang = language;
    try {
        localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
        /* the choice just won't be remembered */
    }
}

/** The language after the current one, for the top-bar switch. */
function nextLanguage() {
    const codes = Object.keys(LANGUAGES);
    return codes[(codes.indexOf(currentLanguage) + 1) % codes.length];
}

const locale = () => LANGUAGES[currentLanguage].locale;

/* ---- Translating -------------------------------------------------------- */

/**
 * Look up `key` in the current language (falling back to English) and fill in
 * {placeholders} from `params`. Plural entries choose a form using `params.n`.
 */
function t(key, params = {}) {
    let entry = TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS.en[key];
    if (entry == null) return key;
    if (typeof entry === "object") {
        const form = new Intl.PluralRules(locale()).select(params.n ?? 0);
        entry = entry[form] ?? entry.other;
    }
    return entry.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

/** "3 students" / "3 leerlingen". `noun` is one of the count.* keys. */
const count = (noun, n) => t(`count.${noun}`, { n });

/** Translate a value stored in English in the database, or show it unchanged. */
function translateStored(prefix, value) {
    const key = `${prefix}.${value}`;
    return TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS.en[key] ?? value;
}

const dayName = (day) => translateStored("day", day);
const subjectName = (name) => translateStored("subject", name);

/* ---- Numbers & dates ---------------------------------------------------- */

/** 7.5 in English, 7,5 in Dutch. */
function formatNumber(value, decimals = 0) {
    return new Intl.NumberFormat(locale(), {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/** Format a 'YYYY-MM-DD' date. */
function formatDate(iso, options) {
    return new Date(iso + "T12:00:00").toLocaleDateString(locale(), options);
}

/** "today", "tomorrow", "in 5 days" — or "vandaag", "morgen", "over 5 dagen". */
function relativeDays(days) {
    return new Intl.RelativeTimeFormat(locale(), { numeric: "auto" }).format(days, "day");
}
