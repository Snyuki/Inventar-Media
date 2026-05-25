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