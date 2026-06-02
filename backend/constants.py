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
Base URL for the NDL API
"""
NDL_SEARCH_BASE_URL = "https://ndlsearch.ndl.go.jp/api/sru"

"""
URL for the AniList GraphQL endpoint.
"""
ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

"""
Rakuten Books Search API base URL.
"""
RAKUTEN_BOOKS_BASE_URL = "https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404"

"""
ISBN prefix for Japanese market publications.
"""
ISBN_PREFIX_JAPANESE = "9784"
 
"""
ISBN prefix for German market publications.
"""
ISBN_PREFIX_GERMAN = "9783"

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
    NDL          = "ndl"
    RAKUTEN      = "rakuten"
    ANILIST      = "anilist"
    NO_API       = "none"



"""
Regex patterns to strip suffixes
"""
STRIP_NAME_SUFFIXES_REGEX = r'(\s*(Vol\.?|Volume|Band|Bd\.?|#|Tome|Book|Part|Episode|Box)\s*\d+.*|\s*\((Light Novel|Manga|Novel|Art Book|Anime|Comic|Graphic Novel)\)|\s+\d+)*\s*$'
