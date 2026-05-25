# Inventar-Media

A media inventory web app for books, manga, anime and more.

---

## Project Structure

```
inventar-media/
├── frontend/          React + TypeScript + Vite + TailwindCSS
└── backend/           Python FastAPI + asyncpg + Supabase
```

---

## Quick Start

```
./start.sh [dev|ngrok|prod]
```

- `dev` — local only, dev database
- `ngrok` — expose via ngrok, dev database
- `prod` — local frontend + backend, production database (confirmation required)

---

## Backend

```
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API at `http://localhost:8000` — docs at `http://localhost:8000/docs`.

---

## Frontend

```
cd frontend
npm install
npm run dev
```

Vite proxies `/api/*` to the FastAPI backend automatically.

---

## Auth

Supabase Auth (Google OAuth). Roles are managed via the `user_roles` table in the database — not in the UI.

To give someone a role, run in the Supabase SQL editor:

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'   -- or 'all_seeing'
FROM auth.users
WHERE email = 'someone@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

---

## Deployment

| Part     | Host         | Notes                          |
|----------|--------------|--------------------------------|
| Frontend | **Vercel**   | Free tier; auto-deploy from GitHub |
| Backend  | **Render**   | Free tier; auto-deploy from GitHub |
| Database | **Supabase** | PostgreSQL                     |