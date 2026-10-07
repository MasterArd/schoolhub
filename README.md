# SchoolHub

A small school administration app: students, teachers, classes, grades and a weekly timetable,
with admin / teacher / student views.

There is no server. Open `index.html` in a browser and it works. The data lives in a real
SQLite database that runs in the page via [sql.js](https://sql.js.org) (SQLite compiled to WebAssembly).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell |
| `style.css` | All styles (light + dark theme) |
| `app.js` | The app: database access, views, events, animations |
| `i18n.js` | All interface text (English, Dutch) and number/date formatting |
| `schoolhub.db` | Ready-made SQLite database with the demo data |
| `db/schema.sql` | Table definitions and relationships |
| `db/seed.py` | Generates the demo data → `db/seed.sql`, `db/seed.js`, `schoolhub.db` |
| `db/seed.sql` | Schema + demo data as plain SQL |
| `db/seed.js` | The same SQL wrapped for the browser (generated, don't edit) |
| `design/` | The original design export this was built from |

## How the data works

- On first load the app builds the database from `db/seed.js` and saves it in `localStorage`.
  Every change is written back there, so it survives a reload.
- **Download .db file** (dev panel, bottom left) saves the current database as `schoolhub.db`,
  which you can open with `sqlite3`, DB Browser for SQLite, etc.
- **Open .db file** loads a SQLite file into the app, such as the included `schoolhub.db`.
- **Reset demo data** goes back to the seeded data.

```sh
sqlite3 schoolhub.db "SELECT first_name, last_name FROM students LIMIT 5;"
python3 db/seed.py   # regenerate seed.sql, seed.js and schoolhub.db after editing schema/seed
```

## Languages

The app is in English and Dutch. The **NL / EN** button in the top bar switches language; the choice is
remembered per browser, and the first visit follows the browser's language.

Every interface string lives in `i18n.js`. To add a language, add it to `LANGUAGES` and copy the `en`
block in `TRANSLATIONS`; missing keys fall back to English. Numbers, dates and "in 3 days" use the
browser's `Intl` formatting, so Dutch shows `7,5` and `over 3 dagen`. Day and subject names are stored in
English in the database and translated for display; names, class codes and test titles are shown as entered.

sql.js and GSAP (animations, optional) load from a CDN, so the first load needs an internet connection.
