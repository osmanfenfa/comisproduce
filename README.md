# COMIS — Cocoa, Coffee & Cola Management Information System

A mobile-first web app for recording produce purchases (cocoa, coffee, cola nut)
with moisture-deduction pricing, plus seller and loan management.

- `beyen/` — FastAPI backend (PostgreSQL, Alembic migrations)
- `comisbefoe/` — React + Vite frontend, served by nginx in production

## Run with Docker

```sh
cp .env.example .env               # set POSTGRES_PASSWORD
cp beyen/.env.example beyen/.env   # set SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_*
docker compose up --build
```

Open http://localhost:8080. On first start the backend applies migrations and
creates the System Admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Remove
`ADMIN_PASSWORD` from `beyen/.env` once you have logged in.

## Local development

```sh
cd beyen
python -m venv venv && venv/Scripts/pip install -r requirements.txt   # venv/bin/pip on macOS/Linux
cp .env.example .env               # point DATABASE_URL at your Postgres
venv/Scripts/python -m app.db.migrate    # create / upgrade the schema
venv/Scripts/uvicorn app.main:app --reload

cd ../comisbefoe
npm ci && npm run dev              # proxies /api to localhost:8000
```

Tests: `cd beyen && venv/Scripts/python -m pytest` (uses SQLite, no Postgres needed).

## Schema changes

Every schema change is an Alembic migration in `beyen/alembic/versions/`; the
app no longer alters tables at startup. After changing a model:

```sh
venv/Scripts/alembic revision --autogenerate -m "describe the change"
```

Review the generated file, then run `python -m app.db.migrate`. Databases created by
older versions of COMIS (with no migration history) are detected and upgraded
in place automatically.
