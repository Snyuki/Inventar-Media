# Inventar-Media

## Overview

Similar to the existing Inventar Project but for media — Books (Manga, Light Novel, Roman, ...), Anime (DVD/Blu-ray boxes) and similar things.
UI also similar to the existing project.

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
Extendable via SQL script (just insert a new row + add the color to `constants.ts`).

**Current tags:** Manga, Light Novel, Anime, Novel, Art Book, Sonstiges

Additionally, each title has an **explicit flag** (boolean):
- One tag + explicit set or not
- Titles with explicit flag are hidden entirely for guests and normal users

---

## Entities

### Titles

- `id`
- `name` — free text
- `tag` — FK to `tags` table (exactly one tag per title)
- `is_explicit` — boolean flag
- `external_id` — AniList ID, Google Books ID, etc.
- `created_at`

UI:
- Tag name shown where expiry date was in the existing project
- Color coding per tag via a **vertical line on the left side of the card**
- Auto-created when the first item is added (same pattern as existing project)

### Title Metadata (API-sourced, optional)

Stored in a separate `title_metadata` table (1:1 with titles). Only populated when API data is available.

- `volume_count`
- `chapter_count`
- `status` — FINISHED, RELEASING, etc.
- `anilist_id`
- `cover_image_url` — series-level fallback cover from AniList

### Items (= the individual volumes / boxes / books)

E.g.: Title: *One Piece*, Items: *Vol. 1*, *Vol. 2*, ...

**Base fields (all types):**
- `id`
- `title_id` — FK to titles, always required
- `name` — native name (e.g. Japanese kanji for Japanese manga)
- `name_romaji` — only set and shown when language = Japanese
- `name_english` — only set and shown when language ≠ English
- `volume_number` — stored as TEXT, parsed as int at runtime
    - Parsed successfully → sort by number, use lowest for cover image
    - Parse fails → fall back to oldest `date_added`
- `language` — free text with autocomplete
- `edition` (Auflage) — stored as TEXT, parsed as int at runtime
- `cover_image_url`
- `date_added`
- `external_id`

**Cover image fallback chain (frontend):**
1. Item with lowest volume number that has a cover image
2. `title_metadata.cover_image_url` (AniList series cover)
3. 📚 placeholder

**Grouping in the UI:**
- First level: `(name, language)` — shown as accordion card
- Second level: `(name, volume_number, language, author, publisher)` — flat rows inside accordion
    - If multiple items share all these fields but differ only in edition → row is expandable, shows lowest edition

**Per-type detail tables** (normalized, FK to `items.id`):

| Table | Fields |
|---|---|
| `items_manga` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date`, `page_count` |
| `items_light_novel` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date`, `page_count` |
| `items_novel` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date`, `page_count` |
| `items_art_book` | `isbn_10`, `isbn_13`, `publisher`, `author`, `publish_date`, `page_count` |
| `items_anime` | `ean` |
| `items_sonstiges` | `isbn_10`, `isbn_13` |

`Sonstiges` is intentionally minimal — items there are temporary until the correct type is found.

### Media Tags + Genres (n:m with titles)

- `media_tags` + `title_media_tags` — source-agnostic tags (e.g. Seinen, Isekai)
- `media_genres` + `title_media_genres` — source-agnostic genres (e.g. Comedy, Romance)
- Both tables auto-populate from API results
- UI: comma-separated input with autocomplete (completes the last token only)

---

## Barcode Scanning

- Mobile only (camera)
- Scanner opens immediately on button click
- Scan prefills the form — does **not** auto-submit
- Manual input always available (skip button or API failure)

**Lookup flow (cascading per API, not per field for now):**
1. Google Books (ISBN → book metadata, cover, author, publisher)
2. OpenLibrary (fallback for books not in Google Books)
3. AniList (series-level metadata: romaji/english title, cover, tags, genres, volume count, status)
    - Search term is the name from step 1/2 with volume suffix stripped
    - If AniList returns no result → "Search AniList" button appears in the form for manual search
- `is_adult` from any API → pre-sets the explicit flag (once true, stays true)
- `sources_used` field in response lists which APIs contributed

**What the barcode tells us:**
- ISBN-13 / ISBN-10 (starts with 978/979) → book type → suggest "Manga" tag by default
- EAN-13 (other) → non-book → suggest "Anime" tag, no API lookup
- Unknown → no suggestion, manual input

**Tag locked (adding from ItemsView):**
- API lookup still runs
- If result suggests a different tag → warning banner shown, fields still prefilled

---

## Data Sources / APIs

| Source | Used for | Key required |
|---|---|---|
| Google Books | ISBN lookup (books) | Yes (free, configured in `.env`) |
| OpenLibrary | ISBN fallback (books) | No |
| AniList GraphQL | Series metadata, cover, tags/genres | No |

Language codes from Google Books (e.g. `"ja"`) are mapped to German display names via `LANGUAGE_CODE_MAP` in `constants.ts`.

---

## Search

- Works like the existing project
- **Filter chips:** Manga, Light Novel, Anime, Novel, Art Book, Sonstiges
- Multi-select supported

---

## Security

- RLS (Row Level Security) on all tables in Supabase
- Explicit-flagged titles filtered at DB level (not just backend)
- Backend also enforces role checks (defense in depth)
- Write access checked in backend before any mutation
- `cover_image_url` validated as http/https URL on insert

---

## What's different from the existing Inventar Project

- No storages / locations — everything is in one flat list
- Groups → Titles (free name, with tag + explicit flag)
- Items represent volumes/boxes, not consumables — no expiry date
- Color coding via left border, not full card highlight
- Guest access (no whitelist enforcement)
- 3-role system instead of simple whitelist
- Barcode lookup hits Google Books / OpenLibrary / AniList instead of Open Food Facts
- Normalized per-type detail tables instead of a single items table
- Two-level item grouping in the UI
- API-sourced metadata stored separately in `title_metadata`
- Series-level cover image fallback from AniList