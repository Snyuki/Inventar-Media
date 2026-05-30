-- ============================================================
-- Inventar-Media — Vollständiges Datenbank-Setup Script
-- Für ein frisches Supabase Projekt (z.B. inventar-media-pro)
-- ============================================================


-- ------------------------------------------------------------
-- 1. Tags
-- Fixed list of media types. Not editable in the UI.
-- Extend by inserting new rows via SQL script.
-- Colors are intentionally not stored here — they live in
-- the frontend constants file.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE tags IS
    'Lookup-Tabelle der verfügbaren Medien-Tags. Wird einmalig befüllt und ist nicht vom User editierbar.';

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
-- 3. Titles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS titles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    tag_id      UUID NOT NULL REFERENCES tags(id),
    is_explicit BOOLEAN NOT NULL DEFAULT false,
    external_id TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE titles IS
    'Titel (z.B. "One Piece"). Entspricht den Gruppen im bestehenden Inventar-Projekt.';
COMMENT ON COLUMN titles.tag_id IS
    'Genau ein Tag pro Titel (Manga, Anime, ...).';
COMMENT ON COLUMN titles.is_explicit IS
    'Wenn true, wird der Titel für Gäste komplett ausgeblendet.';
COMMENT ON COLUMN titles.external_id IS
    'Externe ID aus der jeweiligen API (AniList, Google Books, etc.).';

CREATE INDEX IF NOT EXISTS idx_titles_tag_id      ON titles(tag_id);
CREATE INDEX IF NOT EXISTS idx_titles_is_explicit  ON titles(is_explicit);


-- ------------------------------------------------------------
-- 4. Title Metadata (1:1 with titles, API-sourced)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS title_metadata (
    title_id        UUID PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    volume_count    INTEGER,
    chapter_count   INTEGER,
    status          TEXT,
    anilist_id      INTEGER,
    cover_image_url TEXT
);

COMMENT ON TABLE title_metadata IS
    'API-sourced metadata for a title. Optional — not every title will have this.';
COMMENT ON COLUMN title_metadata.status IS
    'Publication status from AniList: FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED, HIATUS.';
COMMENT ON COLUMN title_metadata.anilist_id IS
    'AniList internal Media ID. Used for future re-fetching or deep linking.';
COMMENT ON COLUMN title_metadata.cover_image_url IS
    'Series-level fallback cover from AniList. Used in UI only when no item has a cover image.';


-- ------------------------------------------------------------
-- 5. Media Tags (source-agnostic, n:m with titles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_tags (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE media_tags IS
    'Generic media tags (e.g. Age Regression, Seinen). Source-agnostic — populated from any API.';

CREATE TABLE IF NOT EXISTS title_media_tags (
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    tag_id   UUID NOT NULL REFERENCES media_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_title_media_tags_title_id ON title_media_tags(title_id);


-- ------------------------------------------------------------
-- 6. Media Genres (source-agnostic, n:m with titles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_genres (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE media_genres IS
    'Generic media genres (e.g. Comedy, Romance). Source-agnostic — populated from any API.';

CREATE TABLE IF NOT EXISTS title_media_genres (
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES media_genres(id) ON DELETE CASCADE,
    PRIMARY KEY (title_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_title_media_genres_title_id ON title_media_genres(title_id);


-- ------------------------------------------------------------
-- 7. Items (base table, all types)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id         UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    name_romaji      TEXT,
    name_english     TEXT,
    volume_number    TEXT,
    language         TEXT,
    edition          TEXT,
    cover_image_url  TEXT,
    date_added       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE items IS
    'Einzelne Bände/Boxen/Bücher. Immer einem Titel zugeordnet.';
COMMENT ON COLUMN items.name IS
    'Native name (e.g. Japanese kanji for Japanese manga).';
COMMENT ON COLUMN items.name_romaji IS
    'Romanized name. Only set and shown in UI when language = Japanese.';
COMMENT ON COLUMN items.name_english IS
    'English name. Only set and shown in UI when language is not English.';
COMMENT ON COLUMN items.volume_number IS
    'Bandnummer als Text. Wird zur Laufzeit als int geparst.';
COMMENT ON COLUMN items.edition IS
    'Auflage. Zusammen mit name + language wird im Frontend gruppiert.';


-- ------------------------------------------------------------
-- 7b. Item External IDs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_external_ids (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source      TEXT NOT NULL CHECK (source IN ('google_books', 'openlibrary', 'anilist', 'ndl')),
    external_id TEXT NOT NULL,
    UNIQUE (item_id, source)
);

COMMENT ON TABLE item_external_ids IS
    'Stores external IDs for items from various APIs. One ID per source per item.';
COMMENT ON COLUMN item_external_ids.source IS
    'API source. Fixed list: google_books, openlibrary, anilist. Extend via ALTER TABLE.';

CREATE INDEX IF NOT EXISTS idx_item_external_ids_item_id ON item_external_ids(item_id);

CREATE INDEX IF NOT EXISTS idx_items_title_id ON items(title_id);


-- ------------------------------------------------------------
-- 8. Per-Type Detail Tables
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS items_manga (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT,
    page_count   INTEGER
);
COMMENT ON TABLE items_manga IS 'Typ-spezifische Felder für Manga-Items.';

CREATE TABLE IF NOT EXISTS items_light_novel (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT,
    page_count   INTEGER
);
COMMENT ON TABLE items_light_novel IS 'Typ-spezifische Felder für Light Novel-Items.';

CREATE TABLE IF NOT EXISTS items_novel (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT,
    page_count   INTEGER
);
COMMENT ON TABLE items_novel IS 'Typ-spezifische Felder für Roman-Items.';

CREATE TABLE IF NOT EXISTS items_art_book (
    item_id      UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10      TEXT,
    isbn_13      TEXT,
    publisher    TEXT,
    author       TEXT,
    publish_date TEXT,
    page_count   INTEGER
);
COMMENT ON TABLE items_art_book IS 'Typ-spezifische Felder für Art Book-Items.';

CREATE TABLE IF NOT EXISTS items_anime (
    item_id  UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    ean      TEXT
);
COMMENT ON TABLE items_anime IS 'Typ-spezifische Felder für Anime DVD/Blu-ray-Items.';

CREATE TABLE IF NOT EXISTS items_sonstiges (
    item_id  UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    isbn_10  TEXT,
    isbn_13  TEXT
);
COMMENT ON TABLE items_sonstiges IS 'Typ-spezifische Felder für Sonstiges-Items. Bewusst minimal.';


-- ------------------------------------------------------------
-- 9. Language Autocomplete Registry
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS language_registry (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language TEXT NOT NULL UNIQUE
);

COMMENT ON TABLE language_registry IS
    'Bekannte Sprachen für Autocomplete im Item-Formular.';

INSERT INTO language_registry (language) VALUES
    ('Deutsch'),
    ('Englisch'),
    ('Japanisch')
ON CONFLICT (language) DO NOTHING;


-- ------------------------------------------------------------
-- 10. RLS — Row Level Security
-- ------------------------------------------------------------

ALTER TABLE titles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_metadata     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_manga        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_light_novel  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_novel        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_art_book     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_anime        ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_sonstiges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_registry  ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_media_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_genres       ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_media_genres ENABLE ROW LEVEL SECURITY;

-- Tags: readable by everyone
CREATE POLICY "tags_read_all" ON tags FOR SELECT USING (true);

-- Language registry
CREATE POLICY "language_registry_read_all" ON language_registry FOR SELECT USING (true);
CREATE POLICY "language_registry_write_authenticated" ON language_registry
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- User roles
CREATE POLICY "user_roles_read_own" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- Media tags: readable by everyone, writable by admin
CREATE POLICY "media_tags_read_all" ON media_tags FOR SELECT USING (true);
CREATE POLICY "media_tags_write_admin" ON media_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Media genres: readable by everyone, writable by admin
CREATE POLICY "media_genres_read_all" ON media_genres FOR SELECT USING (true);
CREATE POLICY "media_genres_write_admin" ON media_genres FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Titles
CREATE POLICY "titles_read_non_explicit" ON titles FOR SELECT USING (is_explicit = false);
CREATE POLICY "titles_read_privileged" ON titles FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "titles_write_admin" ON titles FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Title metadata
CREATE POLICY "title_metadata_read_non_explicit" ON title_metadata FOR SELECT USING (
    EXISTS (SELECT 1 FROM titles WHERE titles.id = title_metadata.title_id AND titles.is_explicit = false));
CREATE POLICY "title_metadata_read_privileged" ON title_metadata FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "title_metadata_write_admin" ON title_metadata FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Title media tags
CREATE POLICY "title_media_tags_read_non_explicit" ON title_media_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM titles WHERE titles.id = title_media_tags.title_id AND titles.is_explicit = false));
CREATE POLICY "title_media_tags_read_privileged" ON title_media_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "title_media_tags_write_admin" ON title_media_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Title media genres
CREATE POLICY "title_media_genres_read_non_explicit" ON title_media_genres FOR SELECT USING (
    EXISTS (SELECT 1 FROM titles WHERE titles.id = title_media_genres.title_id AND titles.is_explicit = false));
CREATE POLICY "title_media_genres_read_privileged" ON title_media_genres FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "title_media_genres_write_admin" ON title_media_genres FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Items
CREATE POLICY "items_read_non_explicit" ON items FOR SELECT USING (
    EXISTS (SELECT 1 FROM titles WHERE titles.id = items.title_id AND titles.is_explicit = false));
CREATE POLICY "items_read_privileged" ON items FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_write_admin" ON items FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Item external IDs: mirrors items/titles visibility
ALTER TABLE item_external_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_external_ids_read_non_explicit" ON item_external_ids FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = item_external_ids.item_id AND titles.is_explicit = false));
CREATE POLICY "item_external_ids_read_privileged" ON item_external_ids FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "item_external_ids_write_admin" ON item_external_ids FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Detail tables
CREATE POLICY "items_manga_read_non_explicit" ON items_manga FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_manga.item_id AND titles.is_explicit = false));
CREATE POLICY "items_manga_read_privileged" ON items_manga FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_manga_write_admin" ON items_manga FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "items_light_novel_read_non_explicit" ON items_light_novel FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_light_novel.item_id AND titles.is_explicit = false));
CREATE POLICY "items_light_novel_read_privileged" ON items_light_novel FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_light_novel_write_admin" ON items_light_novel FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "items_novel_read_non_explicit" ON items_novel FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_novel.item_id AND titles.is_explicit = false));
CREATE POLICY "items_novel_read_privileged" ON items_novel FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_novel_write_admin" ON items_novel FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "items_art_book_read_non_explicit" ON items_art_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_art_book.item_id AND titles.is_explicit = false));
CREATE POLICY "items_art_book_read_privileged" ON items_art_book FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_art_book_write_admin" ON items_art_book FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "items_anime_read_non_explicit" ON items_anime FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_anime.item_id AND titles.is_explicit = false));
CREATE POLICY "items_anime_read_privileged" ON items_anime FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_anime_write_admin" ON items_anime FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "items_sonstiges_read_non_explicit" ON items_sonstiges FOR SELECT USING (
    EXISTS (SELECT 1 FROM items JOIN titles ON titles.id = items.title_id WHERE items.id = items_sonstiges.item_id AND titles.is_explicit = false));
CREATE POLICY "items_sonstiges_read_privileged" ON items_sonstiges FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'all_seeing')));
CREATE POLICY "items_sonstiges_write_admin" ON items_sonstiges FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));


-- ------------------------------------------------------------
-- 11. Overview View
-- Aggregates all media data without IDs for easy inspection.
-- Usage: SELECT * FROM media_overview;
--        SELECT * FROM media_overview WHERE tag = 'Manga';
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW media_overview AS
SELECT
    tg.name                                         AS tag,
    t.name                                          AS title,
    t.is_explicit                                   AS explicit,
    COALESCE(tm.status, '—')                        AS status,
    tm.volume_count,
    tm.chapter_count,
    i.name                                          AS item,
    i.name_romaji,
    i.name_english,
    i.volume_number                                 AS volume,
    i.language,
    i.edition                                       AS auflage,
    i.date_added,
    COALESCE(
        imanga.author, iln.author, inovel.author, iab.author
    )                                               AS author,
    COALESCE(
        imanga.publisher, iln.publisher, inovel.publisher, iab.publisher
    )                                               AS publisher,
    COALESCE(
        imanga.isbn_13, iln.isbn_13, inovel.isbn_13, iab.isbn_13, isont.isbn_13
    )                                               AS isbn_13,
    COALESCE(
        imanga.isbn_10, iln.isbn_10, inovel.isbn_10, iab.isbn_10, isont.isbn_10
    )                                               AS isbn_10,
    COALESCE(
        imanga.publish_date, iln.publish_date, inovel.publish_date, iab.publish_date
    )                                               AS publish_date,
    COALESCE(
        imanga.page_count, iln.page_count, inovel.page_count, iab.page_count
    )                                               AS page_count,
    ianime.ean,
    (
        SELECT STRING_AGG(mg.name, ', ' ORDER BY mg.name)
        FROM title_media_genres tmg
        JOIN media_genres mg ON mg.id = tmg.genre_id
        WHERE tmg.title_id = t.id
    )                                               AS genres,
    (
        SELECT STRING_AGG(mt.name, ', ' ORDER BY mt.name)
        FROM title_media_tags tmt
        JOIN media_tags mt ON mt.id = tmt.tag_id
        WHERE tmt.title_id = t.id
    )                                               AS media_tags,
    i.cover_image_url
FROM titles t
JOIN tags tg ON tg.id = t.tag_id
LEFT JOIN title_metadata tm     ON tm.title_id    = t.id
JOIN items i                    ON i.title_id     = t.id
LEFT JOIN items_manga    imanga ON imanga.item_id  = i.id
LEFT JOIN items_light_novel iln ON iln.item_id    = i.id
LEFT JOIN items_novel   inovel  ON inovel.item_id  = i.id
LEFT JOIN items_art_book iab    ON iab.item_id     = i.id
LEFT JOIN items_anime   ianime  ON ianime.item_id  = i.id
LEFT JOIN items_sonstiges isont ON isont.item_id   = i.id
ORDER BY tg.name, t.name, i.volume_number, i.name;

COMMENT ON VIEW media_overview IS
    'Aggregated view of all media without IDs. Use for quick inspection in Supabase SQL editor.';


-- ------------------------------------------------------------
-- 12. Admin Setup — Insert your admin user
-- Run this separately after your first login.
-- Replace the email with your own.
-- ------------------------------------------------------------

-- INSERT INTO user_roles (user_id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (user_id) DO NOTHING;