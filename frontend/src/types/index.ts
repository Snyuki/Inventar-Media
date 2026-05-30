// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "all_seeing" | "guest";

export interface UserContext {
  role: UserRole;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Tags (media type tags: Manga, Anime, etc.)
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

export interface TitleMetadata {
  volumeCount:      number | null;
  chapterCount:     number | null;
  status:           string | null;
  anilistId:        number | null;
  coverImageUrl:    string | null; // series-level fallback cover from AniList
  nameRomaji:       string | null;
}

export interface Title {
  id:           string;
  name:         string;
  tag:          Tag;
  isExplicit:   boolean;
  externalId:   string | null;
  createdAt:    string;
  coverImageUrl: string | null; // resolved from first item at runtime
  metadata:     TitleMetadata | null;
  mediaTags:    string[];
  mediaGenres:  string[];
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface Item {
  id:             string;
  titleId:        string;
  name:           string;
  nameRomaji:     string | null;
  nameEnglish:    string | null;
  volumeNumber:   string | null;
  language:       string | null;
  edition:        string | null;
  coverImageUrl:  string | null;
  externalIds:    Array<{source: string; externalId: string}>;
  dateAdded:      string;
  // type-specific fields (null if not applicable)
  isbn10:       string | null;
  isbn13:       string | null;
  publisher:    string | null;
  author:       string | null;
  publishDate:  string | null;
  pageCount:    number | null;
  ean:          string | null;
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export interface LookupResult {
  code:          string;
  code_type:     string;
  suggested_tag: string | null;
  // Item-level fields
  name:            string | null;
  name_romaji:     string | null;
  name_english:    string | null;
  author:          string | null;
  publisher:       string | null;
  publish_date:    string | null;
  cover_image_url: string | null;
  isbn_10:         string | null;
  isbn_13:         string | null;
  language:        string | null;
  ean:             string | null;
  page_count:      number | null;
  volume_number:   string | null;
  // Title metadata fields
  volume_count:          number | null;
  chapter_count:         number | null;
  status:                string | null;
  anilist_id:            number | null;
  title_cover_image_url: string | null;
  // Flags
  anilist_found: boolean;
  is_adult:      boolean;
  // Lists
  tags:         string[];
  genres:       string[];
  sources_used: string[];
  external_ids:  Array<{ source: string; external_id: string }>;
}