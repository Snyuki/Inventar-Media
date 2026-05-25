-- ============================================================
-- Inventar-Media — Vollständiges Datenbank-Setup Script
-- Für ein frisches Supabase Projekt (z.B. inventar-media-pro)
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tags
-- Fixed list of media types. Not editable in the UI.
-- Extend by inserting new rows via SQL script.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE tags IS
    'Lookup-Tabelle der verfügbaren Medien-Tags. Wird einmalig befüllt und ist nicht vom User editierbar.';
COMMENT ON TABLE tags IS
    'Colors are intentionally not stored here — they live in the frontend constants file.';

INSERT INTO tags (name) VALUES
    ('Manga'),
    ('Light Novel'),
    ('Anime'),
    ('Novel'),
    ('Art Book'),
    ('Sonstiges')
ON CONFLICT (name) DO NOTHING;


-- ------------------------------------------------------------
-- 2. User Roles
-- Only admin and all_seeing are stored here.
-- Everyone else (logged in or not) is treated as a guest.
-- Managed via SQL only, not in the UI.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'all_seeing')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE user_roles IS
    'Speichert erhöhte Rollen (admin, all_seeing). Nicht in der UI verwaltbar — nur per SQL-Script.';
COMMENT ON COLUMN user_roles.user_id IS
    'Referenz auf auth.users. Wird bei User-Löschung automatisch mitgelöscht.';
COMMENT ON COLUMN user_roles.role IS
    'admin: Lese- und Schreibzugriff, sieht explizite Titel. all_seeing: Nur Lesezugriff, sieht explizite Titel.';


-- ------------------------------------------------------------
-- 3. Titles (previously: Groups)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS titles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    tag_id      UUID NOT NULL REFERENCES tags(id),
    is_explicit BOOLEAN NOT NULL DEFAULT false,
    external_id TEXT,   -- AniList ID, Google Books ID, etc.
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE titles IS
    'Titel (z.B. "Harry Potter"). Entspricht den Gruppen im bestehenden Inventar-Projekt.';
COMMENT ON COLUMN titles.tag_id IS
    'Genau ein Tag pro Titel (Manga, Anime, ...).';
COMMENT ON COLUMN titles.is_explicit IS
    'Wenn true, wird der Titel für Gäste komplett ausgeblendet.';
COMMENT ON COLUMN titles.external_id IS
    'Externe ID aus der jeweiligen API (AniList, Google Books, etc.).';

CREATE INDEX IF NOT EXISTS idx_titles_tag_id     ON titles(tag_id);
CREATE INDEX IF NOT EXISTS idx_titles_is_explicit ON titles(is_explicit);


-- ------------------------------------------------------------
-- 4. Items (base table, all types)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id         UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    volume_number    TEXT,           -- stored as text, parsed as int at runtime where possible
    language         TEXT,           -- free text with autocomplete in the UI
    edition          TEXT,
    cover_image_url  TEXT,
    external_id      TEXT,           -- API-specific ID for this item
    date_added       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE items IS
    'Einzelne Bände/Boxen/Bücher. Immer einem Titel zugeordnet.';
COMMENT ON COLUMN items.volume_number IS
    'Bandnummer als Text. Wird zur Laufzeit als int geparst. Bei Erfolg: Sortierung nach Nummer. Bei Fehler: Sortierung nach date_added.';
COMMENT ON COLUMN items.language IS
    'Sprache des Items (Freitext mit Autocomplete).';
COMMENT ON COLUMN items.edition IS
    'Edition des Items. Zusammen mit name wird im Frontend gruppiert.';
COMMENT ON COLUMN items.cover_image_url IS
    'Cover-Bild URL. Das Bild des Items mit der niedrigsten volume_number wird als Gruppen-Cover verwendet.';

CREATE INDEX IF NOT EXISTS idx_items_title_id ON items(title_id);


-- ------------------------------------------------------------
-- 5. Per-Type Detail Tables
-- Each has a 1:1 FK to items.id.
-- ------------------------------------------------------------

-- Manga
CREATE TABLE IF NOT EXISTS items_manga (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT
);

COMMENT ON TABLE items_manga IS
    'Typ-spezifische Felder für Manga-Items.';

-- Light Novel
CREATE TABLE IF NOT EXISTS items_light_novel (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT
);

COMMENT ON TABLE items_light_novel IS
    'Typ-spezifische Felder für Light Novel-Items.';

-- Novel
CREATE TABLE IF NOT EXISTS items_novel (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT
);

COMMENT ON TABLE items_novel IS
    'Typ-spezifische Felder für Roman-Items.';

-- Art Book
CREATE TABLE IF NOT EXISTS items_art_book (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT
);

COMMENT ON TABLE items_art_book IS
    'Typ-spezifische Felder für Art Book-Items.';

-- Anime (DVD/Blu-ray boxes)
CREATE TABLE IF NOT EXISTS items_anime (
    item_id  UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    ean      TEXT
);

COMMENT ON TABLE items_anime IS
    'Typ-spezifische Felder für Anime DVD/Blu-ray-Items. EAN wird per Barcode-Scan befüllt, Rest manuell.';

-- Sonstiges (minimal, temporary until correct type is found)
CREATE TABLE IF NOT EXISTS items_sonstiges (
    item_id  UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10  TEXT,
    isbn_13  TEXT
);

COMMENT ON TABLE items_sonstiges IS
    'Typ-spezifische Felder für Sonstiges-Items. Bewusst minimal gehalten — diese Items sind temporär.';


-- ------------------------------------------------------------
-- 6. Language Autocomplete Registry
-- Similar to item_name_to_group_registry in the existing project.
-- Collects known language strings for autocomplete suggestions.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS language_registry (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE language_registry IS
    'Bekannte Sprachen für Autocomplete im Item-Formular. Wird beim ersten Vorkommen einer neuen Sprache befüllt.';

INSERT INTO language_registry (language) VALUES
    ('Deutsch'),
    ('Englisch'),
    ('Japanisch')
ON CONFLICT (language) DO NOTHING;


-- ------------------------------------------------------------
-- 7. RLS — Row Level Security
-- Enforced at DB level. Backend also checks roles (defense in depth).
-- ------------------------------------------------------------

ALTER TABLE titles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_manga     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_light_novel ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_novel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_art_book  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_anime     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_sonstiges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_registry ENABLE ROW LEVEL SECURITY;


-- Tags: readable by everyone (anon + authenticated)
CREATE POLICY "tags_read_all" ON tags
    FOR SELECT
    USING (true);

-- Language registry: readable by everyone, writable only by authenticated
CREATE POLICY "language_registry_read_all" ON language_registry
    FOR SELECT
    USING (true);

CREATE POLICY "language_registry_write_authenticated" ON language_registry
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- User roles: only readable by the user themselves or admin
CREATE POLICY "user_roles_read_own" ON user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Titles: guests (anon) and normal users can read non-explicit
CREATE POLICY "titles_read_non_explicit" ON titles
    FOR SELECT
    USING (is_explicit = false);

-- Titles: admin and all_seeing can read everything including explicit
CREATE POLICY "titles_read_privileged" ON titles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

-- Titles: only admin can write
CREATE POLICY "titles_write_admin" ON titles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Items: guests and normal users can read items belonging to non-explicit titles
CREATE POLICY "items_read_non_explicit" ON items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM titles
            WHERE titles.id = items.title_id
            AND titles.is_explicit = false
        )
    );

-- Items: admin and all_seeing can read everything
CREATE POLICY "items_read_privileged" ON items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

-- Items: only admin can write
CREATE POLICY "items_write_admin" ON items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Detail tables: mirror the items policies via their FK
-- (guests read non-explicit, privileged read all, only admin writes)

-- Helper macro-style: same 3 policies for each detail table
-- items_manga
CREATE POLICY "items_manga_read_non_explicit" ON items_manga
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_manga.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_manga_read_privileged" ON items_manga
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_manga_write_admin" ON items_manga
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- items_light_novel
CREATE POLICY "items_light_novel_read_non_explicit" ON items_light_novel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_light_novel.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_light_novel_read_privileged" ON items_light_novel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_light_novel_write_admin" ON items_light_novel
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- items_novel
CREATE POLICY "items_novel_read_non_explicit" ON items_novel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_novel.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_novel_read_privileged" ON items_novel
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_novel_write_admin" ON items_novel
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- items_art_book
CREATE POLICY "items_art_book_read_non_explicit" ON items_art_book
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_art_book.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_art_book_read_privileged" ON items_art_book
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_art_book_write_admin" ON items_art_book
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- items_anime
CREATE POLICY "items_anime_read_non_explicit" ON items_anime
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_anime.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_anime_read_privileged" ON items_anime
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_anime_write_admin" ON items_anime
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- items_sonstiges
CREATE POLICY "items_sonstiges_read_non_explicit" ON items_sonstiges
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM items
            JOIN titles ON titles.id = items.title_id
            WHERE items.id = items_sonstiges.item_id
            AND titles.is_explicit = false
        )
    );

CREATE POLICY "items_sonstiges_read_privileged" ON items_sonstiges
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'all_seeing')
        )
    );

CREATE POLICY "items_sonstiges_write_admin" ON items_sonstiges
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );


-- ------------------------------------------------------------
-- 8. Admin Setup — Insert your admin user
-- Run this separately after your first login.
-- Replace the email with your own.
-- ------------------------------------------------------------

-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (user_id) DO NOTHING;