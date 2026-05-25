# Inventar-Media

## Overview

Similar to the existing Inventar Project but for media — Books (Manga, Light Novel, Roman, ...), Anime (DVD/Blu-ray boxes) and similar things.
UI should also be similar to the existing project.

---

## Stack

Same as the existing Inventar Project:
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Python + FastAPI + asyncpg
- **DB / Auth:** Supabase (PostgreSQL + Supabase Auth via JWT)
- **Deployment:** Vercel (Frontend), Render (Backend), Supabase (DB)

---

## Stages

For now only a `pro` stage. A `dev` stage will be added later.
Should be easily extendable — same `.env` pattern as the existing project (`start.sh` with `dev | ngrok | prod`).

---

## Login

- On page load: login screen (same as existing project)
- Additional button: **Continue as Guest**
    - Guests have read-only access
    - Write access only for logged-in users with the right role

---

## Roles

| Role | Read | Read Explicit | Write |
|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ |
| `all_seeing` | ✅ | ✅ | ❌ |
| Guest (everyone else, logged in or not) | ✅ | ❌ | ❌ |

- Roles are stored in a `user_roles` DB table
- Not manageable in the UI — done via direct SQL
- Unrecognized logged-in users are treated as guests (no whitelist)

---

## Tags

Fixed list, stored in a `tags` DB table. Not editable in the UI.
Extendable via SQL script (just insert a new row).

**Current tags:** Manga, Light Novel, Anime, Novel, Art Book, Sonstiges

Additionally, each title has an **explicit flag** (boolean). Works on top of the tag system:
- One tag + explicit set or not
- Titles with explicit flag are hidden entirely for guests

---

## Entities

### Titles (previously: Groups)

- `id`
- `name` — free text, not restricted like group names in the existing project
- `tag` — FK to `tags` table (exactly one tag per title)
- `is_explicit` — boolean flag
- `external_id` — AniList ID, Google Books ID, etc.
- `created_at`

UI differences from existing groups:
- Tag name is shown where the earliest expiry date was in the existing project
- Color coding per tag, but shown as a **vertical line on the left side of the card** (not a full highlight)

### Items (= the individual volumes / boxes / books)

E.g.: Title: *Harry Potter*, Items: *Harry Potter and the Philosopher's Stone*, *Harry Potter and the Chamber of Secrets*, ...

**Base fields (all types):**
- `id`
- `title_id` — FK to titles, always required
- `name`
- `volume_number` — always stored as TEXT
    - At runtime: try to parse as int
    - If success: use for sorting and cover image selection (lowest volume number)
    - If fails: fall back to oldest `date_added` for cover image selection
- `language` — free text with autocomplete (like name autocomplete in existing project)
- `edition` — free text
- `cover_image_url`
- `date_added`
- `external_id`

**Grouping in the UI:**
Items are grouped by `(name, edition)` — purely in the frontend, same pattern as the existing project groups by `(name, expiry date)`. Instead of the date, the edition is shown.

**Multiple items with the same name:**
Allowed. Grouping only happens if both name AND edition match.

**Per-type detail tables** (normalized, FK to `items.id`):

| Table | Fields |
|---|---|
| `items_manga` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date` |
| `items_light_novel` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date` |
| `items_novel` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date` |
| `items_art_book` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date` |
| `items_anime` | `ean` |
| `items_sonstiges` | `isbn_10`, `isbn_13` |

`Sonstiges` is intentionally minimal — items there are temporary until the correct type/tag is found.

---

## Cover Image (Group Card)

No `cover_image_url` on the title itself. Instead:
- Take the `cover_image_url` of the item with the **lowest volume number** (parsed as int)
- If volume numbers are not numeric: take the item with the oldest `date_added`
- If no items have a cover image: show a no-image fallback

---

## Barcode Scanning

- Mobile only (camera)
- Scan prefills the form — does **not** auto-submit
- Manual input always available as fallback (API failure or unknown barcode)

**What gets filled from the barcode:**
- For books (Manga, Novel, etc.): ISBN is the barcode → look up via Google Books / OpenLibrary
- For Anime (DVD/Blu-ray): EAN is the barcode → no public DB available, so only the EAN gets filled in, rest is manual

---

## Data Sources / APIs

| Type | API |
|---|---|
| Manga, Light Novel, Novel, Art Book | Google Books API (free key, configured in `.env`) + OpenLibrary as fallback |
| Anime | AniList GraphQL API (no key required) — name search only |
| Sonstiges | Manual input only |

---

## Search

- Works like the existing project
- **Filter chips:** Manga, Light Novel, Anime, Novel, Art Book, Sonstiges

---

## Security

- RLS (Row Level Security) enabled on all tables in Supabase
- Explicit-flagged titles are filtered at DB level (not just backend)
- Backend also enforces role checks (defense in depth)
- Write access checked in backend before any mutation

---

## What's different from the existing Inventar Project

- No storages / locations — everything is in one flat list
- Groups → Titles (free name, with tag + explicit flag)
- Items represent volumes/boxes, not consumables — no expiry date
- Color coding via left border, not full card highlight
- Guest access (no whitelist enforcement)
- 3-role system instead of whitelist
- Barcode lookup hits different APIs (Google Books / AniList instead of Open Food Facts)
- Normalized per-type detail tables
- Titles are also auto-created when the first item is added (same pattern as existing project)