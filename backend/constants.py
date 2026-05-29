from enum import Enum


"""
Timeout in seconds for external API requests (Google Books, AniList, OpenLibrary, ...).
"""
EXTERNAL_API_TIMEOUT_SECONDS = 8.0
 
"""
Base URL for the Google Books API.
"""
GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1/volumes"
 
"""
Base URL for the OpenLibrary API (fallback for ISBN lookups).
"""
OPEN_LIBRARY_BASE_URL = "https://openlibrary.org/api/books"
 
"""
URL for the AniList GraphQL endpoint.
"""
ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

"""
Guest Role string
"""
GUEST_ROLE = "guest"

"""
ADMIN Role string
"""
ADMIN_ROLE = "admin"

"""
ALL-SEEING Role string
"""
ALL_SEEING_ROLE = "all_seeing"

"""
Type ISBN13 String
"""
TYPE_ISBN13 = "isbn13"

"""
Type ISBN10 String
"""
TYPE_ISBN10 = "isbn10"

"""
Type EAN String
"""
TYPE_EAN = "ean"

"""
UNKNOWN type
"""
TYPE_UNKNOWN = "unknown"

"""
Manga Tag
"""
TAG_MANGA = "Manga"

"""
Anime Tag
"""
TAG_ANIME = "Anime"

"""
Light Novel Tag
"""
TAG_LIGHT_NOVEL = "Light Novel"

"""
Art Book Tag
"""
TAG_ART_BOOK = "Art Book"

"""
Novel Tag
"""
TAG_NOVEL = "Novel"

"""
Sonstiges Tag
"""
TAG_SONSTIGES = "Sonstiges"

"""
From API values
"""
class From_Api(Enum):
    GOOGLE_BOOKS = "google_books"
    OPEN_LIBRARY = "openlibrary"
    ANILIST      = "anilist"
    NO_API       = "none"


"""
Regex patterns to strip suffixes from AniList Queries
"""
STRIP_ANILIST_QUERY_STRING_REGEX_PATTERNS = [
    r'\s+Vol\.?\s*\d+.*$',
    r'\s+Volume\s*\d+.*$',
    r'\s+Band\s*\d+.*$',
    r'\s+Bd\.?\s*\d+.*$',
    r'\s+#\s*\d+.*$',
    r'\s+Tome\s*\d+.*$',
    r'\s+Book\s*\d+.*$',
    r'\s+Part\s*\d+.*$',
    r'\s+Episode\s*\d+.*$',
    r'\s+Box\s*\d+.*$',
    r'\s+\d+$',  # trailing number only as last resort
]