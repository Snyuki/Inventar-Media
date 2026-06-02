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

In ngrok mode, frontend and backend logs go to `logs/frontend.log` and `logs/backend.log`. Monitor them with e.g. `tail -f logs/frontend.log` in a separate terminal.

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

## Environment Variables

### Backend (`backend/.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
DATABASE_URL=postgresql+asyncpg://postgres.your-project:[PASSWORD]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres     # Update as needed
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
RAKUTEN_APP_ID=your-rakuten-app-id
RAKUTEN_ACCESS_KEY=your-rakuten-access-key
RAKUTEN_ORIGIN=https://your-ngrok-or-render-url
FRONTEND_URL=https://your-frontend.vercel.app
```

For dev, copy to `backend/.env.dev` and point at the dev Supabase project. `FRONTEND_URL` should be your ngrok URL in dev and your Render URL in prod.

### Frontend (`frontend/.env.prod`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-backend.onrender.com/api
```

For dev, copy to `frontend/.env.dev`. Leave `VITE_API_URL` empty in dev so Vite proxies `/api` to localhost automatically.

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

## ngrok (remote access)

To use the dev stage on other devices:

1. Start with `./start.sh ngrok`
2. Access via `https://your-ngrok-url.ngrok-free.dev`

Make sure your ngrok URL is added to:
- Rakuten allowed websites
- Google OAuth authorized JavaScript origins
- Supabase redirect URLs

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