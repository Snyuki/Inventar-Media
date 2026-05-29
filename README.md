# Inventar-Media

A media inventory app for books, manga, anime and more. Basically a spiritual successor to the Inventar project but for physical media instead of food.

---

## Project Structure

```
inventar-media/
├── frontend/          React + TypeScript + Vite + TailwindCSS
├── backend/           Python FastAPI + asyncpg + Supabase
├── start.sh           Dev/prod launcher
└── admin_setup_complete.sql   Full DB setup script for fresh installs
```

---

## Quick Start

```bash
./start.sh [dev|ngrok|prod]
```

- `dev` — local only, dev database
- `ngrok` — expose via ngrok, dev database
- `prod` — local frontend + backend, production database (confirmation required)

---

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in the env file
cp .env.template .env

uvicorn main:app --reload
```

API at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

---

## Frontend

```bash
cd frontend
npm install
cp .env.frontend.template .env.prod   # fill in values
cp .env.prod .env.local
npm run dev
```

Vite proxies `/api/*` to the FastAPI backend automatically in dev.

---

## Database Setup

For a fresh Supabase project, run `admin_setup_complete.sql` in the SQL editor. That sets up all tables, RLS policies, and the overview view.

After your first login, run the admin insert at the bottom of that file with your email to give yourself admin access.

---

## Auth

Google OAuth via Supabase Auth. Roles are managed via the `user_roles` table — not in the UI.

To give someone a role:

```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'   -- or 'all_seeing'
FROM auth.users
WHERE email = 'someone@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

Three roles exist: `admin` (read/write, sees explicit), `all_seeing` (read-only, sees explicit), and guest (everyone else — read-only, no explicit content).

---

## Inspecting the DB

There's a view for quick overviews without dealing with IDs:

```sql
SELECT * FROM media_overview;
SELECT * FROM media_overview WHERE tag = 'Manga';
```

---

## Deployment

| Part     | Host         | Notes                              |
|----------|--------------|------------------------------------|
| Frontend | **Vercel**   | Auto-deploy from GitHub on push    |
| Backend  | **Render**   | Auto-deploy from GitHub on push    |
| Database | **Supabase** | PostgreSQL, Frankfurt region       |

After deploying, make sure to:
- Add the Vercel URL to Supabase redirect URLs
- Add the Vercel URL to Google OAuth authorized origins
- Set `FRONTEND_URL` in Render env vars