from contextlib import asynccontextmanager
from typing import Optional
import os
import uuid
from pydantic import BaseModel, field_validator
import re
import httpx
import asyncio
 
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt
from jwt import PyJWKClient
import databases
import sqlalchemy

import xml.etree.ElementTree as ET
 
from dotenv import load_dotenv
 
import constants
 
load_dotenv()


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL")

database = databases.Database(DATABASE_URL, min_size=1, max_size=5, statement_cache_size=0)
metadata = sqlalchemy.MetaData()

# ---------------------------------------------------------------------------
# Table definitions
# ---------------------------------------------------------------------------
tags_table = sqlalchemy.Table(
    "tags",
    metadata,
    sqlalchemy.Column("id",   sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("name", sqlalchemy.String, nullable=False, unique=True),
)
 
user_roles_table = sqlalchemy.Table(
    "user_roles",
    metadata,
    sqlalchemy.Column("id",         sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("user_id",    sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False, unique=True),
    sqlalchemy.Column("role",       sqlalchemy.String, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime(timezone=True), nullable=True),
)
 
titles_table = sqlalchemy.Table(
    "titles",
    metadata,
    sqlalchemy.Column("id",          sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("name",        sqlalchemy.String, nullable=False),
    sqlalchemy.Column("tag_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), sqlalchemy.ForeignKey("tags.id"), nullable=False),
    sqlalchemy.Column("is_explicit", sqlalchemy.Boolean, nullable=False, default=False),
    sqlalchemy.Column("external_id", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("created_at",  sqlalchemy.DateTime(timezone=True), nullable=True),
)
 
items_table = sqlalchemy.Table(
    "items",
    metadata,
    sqlalchemy.Column("id",              sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("title_id",        sqlalchemy.dialects.postgresql.UUID(as_uuid=False), sqlalchemy.ForeignKey("titles.id"), nullable=False),
    sqlalchemy.Column("name",            sqlalchemy.String, nullable=False),
    sqlalchemy.Column("name_romaji",     sqlalchemy.String, nullable=True),
    sqlalchemy.Column("name_english",    sqlalchemy.String, nullable=True), 
    sqlalchemy.Column("volume_number",   sqlalchemy.String, nullable=True),
    sqlalchemy.Column("language",        sqlalchemy.String, nullable=True),
    sqlalchemy.Column("edition",         sqlalchemy.String, nullable=True),
    sqlalchemy.Column("cover_image_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("date_added",      sqlalchemy.DateTime(timezone=True), nullable=True),
)
 
language_registry_table = sqlalchemy.Table(
    "language_registry",
    metadata,
    sqlalchemy.Column("id",       sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("language", sqlalchemy.String, nullable=False, unique=True),
)
 
items_manga_table = sqlalchemy.Table(
    "items_manga", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("page_count", sqlalchemy.Integer, nullable=True),
)
 
items_light_novel_table = sqlalchemy.Table(
    "items_light_novel", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("page_count", sqlalchemy.Integer, nullable=True),
)
 
items_novel_table = sqlalchemy.Table(
    "items_novel", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("page_count", sqlalchemy.Integer, nullable=True),
)
 
items_art_book_table = sqlalchemy.Table(
    "items_art_book", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("page_count", sqlalchemy.Integer, nullable=True),
)
 
items_anime_table = sqlalchemy.Table(
    "items_anime", metadata,
    sqlalchemy.Column("item_id", sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("ean",     sqlalchemy.String, nullable=True),
)
 
items_sonstiges_table = sqlalchemy.Table(
    "items_sonstiges", metadata,
    sqlalchemy.Column("item_id",  sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",  sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",  sqlalchemy.String, nullable=True),
)

title_metadata_table = sqlalchemy.Table(
    "title_metadata", metadata,
    sqlalchemy.Column("title_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("volume_count",  sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("chapter_count", sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("status",        sqlalchemy.String, nullable=True),
    sqlalchemy.Column("anilist_id",    sqlalchemy.Integer, nullable=True),
    sqlalchemy.Column("cover_image_url", sqlalchemy.String, nullable=True),  
    sqlalchemy.Column("name_romaji",     sqlalchemy.String, nullable=True),
)
 
media_tags_table = sqlalchemy.Table(
    "media_tags", metadata,
    sqlalchemy.Column("id",   sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("name", sqlalchemy.String, nullable=False, unique=True),
)
 
title_media_tags_table = sqlalchemy.Table(
    "title_media_tags", metadata,
    sqlalchemy.Column("title_id", sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False),
    sqlalchemy.Column("tag_id",   sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False),
)
 
media_genres_table = sqlalchemy.Table(
    "media_genres", metadata,
    sqlalchemy.Column("id",   sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("name", sqlalchemy.String, nullable=False, unique=True),
)
 
title_media_genres_table = sqlalchemy.Table(
    "title_media_genres", metadata,
    sqlalchemy.Column("title_id",  sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False),
    sqlalchemy.Column("genre_id",  sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False),
)

item_external_ids_table = sqlalchemy.Table(
    "item_external_ids", metadata,
    sqlalchemy.Column("id",          sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("item_id",     sqlalchemy.dialects.postgresql.UUID(as_uuid=False), nullable=False),
    sqlalchemy.Column("source",      sqlalchemy.String, nullable=False),
    sqlalchemy.Column("external_id", sqlalchemy.String, nullable=False),
)

TAG_TO_DETAIL_TABLE: dict[str, sqlalchemy.Table] = {
    "Manga":        items_manga_table,
    "Light Novel":  items_light_novel_table,
    "Novel":        items_novel_table,
    "Art Book":     items_art_book_table,
    "Anime":        items_anime_table,
    "Sonstiges":    items_sonstiges_table,
}
 
@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    yield
    await database.disconnect()
 
app = FastAPI(title="Inventar-Media API", lifespan=lifespan)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth - Supabase JWT via JWKS
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

bearer_scheme = HTTPBearer(auto_error=False)
jwks_client = PyJWKClient(JWKS_URL)

class UserContext:
    """
    Holds the resolved identity of the caller.
    role is one of: 'admin', 'all_seeing', 'guest'
    user_id is None for unauthenticated guests.
    """
    def __init__(self, user_id: Optional[str], email: Optional[str], role: str):
        self.user_id = user_id
        self.email = email
        self.role = role

    @property
    def is_guest(self) -> bool:
        return self.role == constants.GUEST_ROLE
    
    @property
    def can_write(self) -> bool:
        return self.role == constants.ADMIN_ROLE
    
    @property
    def can_see_explicit(self) -> bool:
        return self.role in (constants.ADMIN_ROLE, constants.ALL_SEEING_ROLE)
    

async def resolve_role(user_id: str) -> str:
    """
    Looks up the user's role in the user_roles table.
    Falls back to 'guest' if no entry exists.
    """
    row = await database.fetch_one(
        user_roles_table.select().where(
            user_roles_table.c.user_id == user_id
        )
    )
    if row:
        return row["role"]
    return constants.GUEST_ROLE
 
 
def _decode_token(token: str) -> dict:
    """
    Verifies and decodes a Supabase JWT. Raises HTTPException on failure.
    """
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["HS256", "ES256"],
            audience="authenticated",
        )
        return payload
    except Exception as e:
        print(f"JWT error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserContext:
    """
    Requires a valid JWT. Used on write endpoints.
    Raises 401 if no token or invalid token.
    Raises 403 if the user does not have write access.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
 
    payload = _decode_token(credentials.credentials)
 
    user_id: str | None = payload.get("sub")
    email: str | None = payload.get("email")
 
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token contains no user id",
        )
 
    role = await resolve_role(user_id)
    ctx = UserContext(user_id=user_id, email=email, role=role)
 
    if not ctx.can_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Write access required",
        )
 
    return ctx


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserContext:
    """
    Tries to resolve a JWT. Falls back to guest if missing or invalid.
    Used on read endpoints.
    """
    if not credentials:
        return UserContext(user_id=None, email=None, role="guest")
 
    try:
        payload = _decode_token(credentials.credentials)
    except HTTPException:
        return UserContext(user_id=None, email=None, role="guest")
 
    user_id: str | None = payload.get("sub")
    email: str | None = payload.get("email")
 
    if not user_id:
        return UserContext(user_id=None, email=None, role="guest")
 
    role = await resolve_role(user_id)
    return UserContext(user_id=user_id, email=email, role=role)

 
# ---------------------------------------------------------------------------
# Pydantic models — Titles
# --------------------------------------------------------------------------- 

class TagOut(BaseModel):
    id: str
    name: str
 

class TitleMetadataOut(BaseModel):
    volume_count:    Optional[int] = None
    chapter_count:   Optional[int] = None
    status:          Optional[str] = None
    anilist_id:      Optional[int] = None
    cover_image_url: Optional[str] = None
    name_romaji:     Optional[str] = None
 

class TitleOut(BaseModel):
    id:          str
    name:        str
    tag:         TagOut
    is_explicit: bool
    created_at:  str
    metadata:    Optional[TitleMetadataOut] = None
    media_tags:  list[str] = []
    media_genres: list[str] = []
 
 
class TitleIn(BaseModel):
    name:        str
    tag_id:      str
    is_explicit: bool = False
    external_id: Optional[str] = None
    # Title metadata — optional, from API
    volume_count:  Optional[int] = None
    chapter_count: Optional[int] = None
    status:        Optional[str] = None
    anilist_id:    Optional[int] = None
    title_cover_image_url: Optional[str] = None
    # Tags and genres
    tags:   list[str] = []
    genres: list[str] = []

    @field_validator("is_explicit")
    @classmethod
    def validate_is_explicit(cls, v):
        if v is None:
            raise ValueError("is_explicit cannot be null")
        return v
 
 
class TitleUpdate(BaseModel):
    name: Optional[str] = None
    tag_id: Optional[str] = None
    is_explicit: Optional[bool] = None
    external_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Pydantic models — Items
# ---------------------------------------------------------------------------
 
class ItemIn(BaseModel):
    name:            str
    name_romaji:     Optional[str] = None
    name_english:    Optional[str] = None
    volume_number:   Optional[str] = None
    language:        Optional[str] = None
    edition:         Optional[str] = None
    cover_image_url: Optional[str] = None
    external_ids:     list[dict] = []
    # Book-specific
    isbn_10:         Optional[str] = None
    isbn_13:         Optional[str] = None
    publisher:       Optional[str] = None
    author:          Optional[str] = None
    publish_date:    Optional[str] = None
    page_count:      Optional[int] = None
    # Anime-specific
    ean:             Optional[str] = None
 
    @field_validator("cover_image_url")
    @classmethod
    def validate_cover_url(cls, v):
        if v is None:
            return v
        if not re.match(r"^https?://", v):
            raise ValueError("cover_image_url must be a valid http/https URL")
        return v
    
 
class ItemOut(BaseModel):
    id:              str
    title_id:        str
    name:            str
    name_romaji:     Optional[str] = None
    name_english:    Optional[str] = None
    volume_number:   Optional[str]
    language:        Optional[str]
    edition:         Optional[str]
    cover_image_url: Optional[str]
    date_added:      str
    isbn_10:         Optional[str] = None
    isbn_13:         Optional[str] = None
    publisher:       Optional[str] = None
    author:          Optional[str] = None
    publish_date:    Optional[str] = None
    page_count:      Optional[int] = None
    ean:             Optional[str] = None
    external_ids:    list[dict] = []
 

# ---------------------------------------------------------------------------
# Pydantic models — Lookup
# ---------------------------------------------------------------------------
 
class LookupResult(BaseModel):
    code: str                        # the raw barcode value
    code_type: str                   # "isbn13", "isbn10", "ean", "unknown"
    suggested_tag: Optional[str]     # "Manga", "Anime", None, etc.
    name:            Optional[str] = None  # native name
    name_romaji:     Optional[str] = None
    name_english:    Optional[str] = None
    author:          Optional[str] = None
    publisher:       Optional[str] = None
    publish_date:    Optional[str] = None
    cover_image_url: Optional[str] = None
    isbn_10:         Optional[str] = None
    isbn_13:         Optional[str] = None
    language:        Optional[str] = None
    ean:             Optional[str] = None
    page_count:      Optional[int] = None
    language:        Optional[str] = None
    volume_number:   Optional[str] = None
    # Title metadata fields
    volume_count:    Optional[int] = None
    chapter_count:   Optional[int] = None
    status:          Optional[str] = None
    anilist_id:      Optional[int] = None
    title_cover_image_url: Optional[str] = None  # series-level fallback cover
    anilist_found:      bool = True  # False triggers "Search AniList" button in UI
    # Explicit flag hint (not stored — used to pre-set is_explicit)
    is_adult:        bool = False
    tags:            list[str] = []
    genres:          list[str] = []
    sources_used:    list[str] = []
    external_ids:    list[dict] = [] 


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
 
async def get_tag_name_for_title(title_id: str, user: UserContext) -> str:
    """
    Returns the tag name for a given title_id.
    Raises 404 if not found OR if the caller cannot see the title.
    """
    row = await database.fetch_one("""
        SELECT tg.name AS tag_name
        FROM titles t
        JOIN tags tg ON tg.id = t.tag_id
        WHERE t.id = :title_id
          AND (:see_explicit = TRUE OR t.is_explicit = FALSE)
    """, values={"title_id": title_id, "see_explicit": user.can_see_explicit})
    if not row:
        raise HTTPException(status_code=404, detail="Title not found")
    return row["tag_name"]
 

async def fetch_item_with_detail(item_id: str, tag_name: str) -> ItemOut:
    """Fetches base item + type-specific detail + external IDs."""
    item_row = await database.fetch_one(
        items_table.select().where(items_table.c.id == item_id)
    )
    if not item_row:
        raise HTTPException(status_code=404, detail="Item not found")
 
    detail_table = TAG_TO_DETAIL_TABLE.get(tag_name)
    detail_row = None
    if detail_table is not None:
        detail_row = await database.fetch_one(
            detail_table.select().where(detail_table.c.item_id == item_id)
        )
 
    ext_id_rows = await database.fetch_all(
        item_external_ids_table.select().where(
            item_external_ids_table.c.item_id == item_id
        )
    )
    external_ids = [
        {"source": r["source"], "external_id": r["external_id"]}
        for r in ext_id_rows
    ]
 
    return ItemOut(
        id=str(item_row["id"]),
        title_id=str(item_row["title_id"]),
        name=item_row["name"],
        name_romaji=item_row["name_romaji"],
        name_english=item_row["name_english"],
        volume_number=item_row["volume_number"],
        language=item_row["language"],
        edition=item_row["edition"],
        cover_image_url=item_row["cover_image_url"],
        date_added=str(item_row["date_added"]),
        isbn_10=detail_row["isbn_10"] if detail_row and "isbn_10" in detail_row.keys() else None,
        isbn_13=detail_row["isbn_13"] if detail_row and "isbn_13" in detail_row.keys() else None,
        publisher=detail_row["publisher"] if detail_row and "publisher" in detail_row.keys() else None,
        author=detail_row["author"] if detail_row and "author" in detail_row.keys() else None,
        publish_date=detail_row["publish_date"] if detail_row and "publish_date" in detail_row.keys() else None,
        page_count=detail_row["page_count"] if detail_row and "page_count" in detail_row.keys() else None,
        ean=detail_row["ean"] if detail_row and "ean" in detail_row.keys() else None,
        external_ids=external_ids,
    )


async def fetch_media_tags(title_id: str) -> list[str]:
    rows = await database.fetch_all("""
        SELECT mt.name
        FROM title_media_tags tmt
        JOIN media_tags mt ON mt.id = tmt.tag_id
        WHERE tmt.title_id = :title_id
        ORDER BY mt.name ASC
    """, values={"title_id": title_id})
    return [r["name"] for r in rows]


async def fetch_media_genres(title_id: str) -> list[str]:
    rows = await database.fetch_all("""
        SELECT mg.name
        FROM title_media_genres tmg
        JOIN media_genres mg ON mg.id = tmg.genre_id
        WHERE tmg.title_id = :title_id
        ORDER BY mg.name ASC
    """, values={"title_id": title_id})
    return [r["name"] for r in rows]


async def upsert_title_metadata(
    title_id: str,
    volume_count: Optional[int],
    chapter_count: Optional[int],
    status: Optional[str],
    anilist_id: Optional[int],
    cover_image_url: Optional[str] = None,
    name_romaji: Optional[str] = None,
):
    """Upserts title_metadata for a title. Only updates non-None fields."""
    existing = await database.fetch_one(
        title_metadata_table.select().where(
            title_metadata_table.c.title_id == title_id
        )
    )
    values = {k: v for k, v in {
        "volume_count":    volume_count,
        "chapter_count":   chapter_count,
        "status":          status,
        "anilist_id":      anilist_id,
        "cover_image_url": cover_image_url,
        "name_romaji":     name_romaji if (existing is None or not existing["name_romaji"]) else None,
    }.items() if v is not None}
 
    if not values:
        return
 
    if existing:
        await database.execute(
            title_metadata_table.update()
            .where(title_metadata_table.c.title_id == title_id)
            .values(**values)
        )
    else:
        await database.execute(
            title_metadata_table.insert().values(title_id=title_id, **values)
        )


async def upsert_tags_and_genres(title_id: str, tags: list[str], genres: list[str]):
    """
    Ensures all tag/genre names exist in media_tags/media_genres,
    then links them to the title via the n:m tables.
    Existing links are preserved — only new ones are added.
    """
    for tag_name in tags:
        # Upsert tag
        await database.execute("""
            INSERT INTO media_tags (id, name)
            VALUES (:id, :name)
            ON CONFLICT (name) DO NOTHING
        """, values={"id": str(uuid.uuid4()), "name": tag_name})
        # Get tag id
        tag_row = await database.fetch_one(
            media_tags_table.select().where(media_tags_table.c.name == tag_name)
        )
        if tag_row:
            await database.execute("""
                INSERT INTO title_media_tags (title_id, tag_id)
                VALUES (:title_id, :tag_id)
                ON CONFLICT DO NOTHING
            """, values={"title_id": title_id, "tag_id": str(tag_row["id"])})
 
    for genre_name in genres:
        # Upsert genre
        await database.execute("""
            INSERT INTO media_genres (id, name)
            VALUES (:id, :name)
            ON CONFLICT (name) DO NOTHING
        """, values={"id": str(uuid.uuid4()), "name": genre_name})
        # Get genre id
        genre_row = await database.fetch_one(
            media_genres_table.select().where(media_genres_table.c.name == genre_name)
        )
        if genre_row:
            await database.execute("""
                INSERT INTO title_media_genres (title_id, genre_id)
                VALUES (:title_id, :genre_id)
                ON CONFLICT DO NOTHING
            """, values={"title_id": title_id, "genre_id": str(genre_row["id"])})


async def upsert_item_external_ids(item_id: str, external_ids: list[dict]):
    """
    Upserts external IDs for an item.
    Each entry: {"source": "google_books", "external_id": "..."}
    Skips entries with unknown sources.
    """
    valid_sources = {e.value for e in constants.From_Api
                     if e != constants.From_Api.NO_API}
 
    for entry in external_ids:
        source = entry.get("source")
        ext_id = entry.get("external_id")
        if not source or not ext_id or source not in valid_sources:
            continue
        await database.execute("""
            INSERT INTO item_external_ids (id, item_id, source, external_id)
            VALUES (:id, :item_id, :source, :external_id)
            ON CONFLICT (item_id, source) DO UPDATE
            SET external_id = EXCLUDED.external_id
        """, values={
            "id":          str(uuid.uuid4()),
            "item_id":     item_id,
            "source":      source,
            "external_id": ext_id,
        })


def detect_code_type(code: str) -> str:
    """Detects whether a barcode is ISBN-13, ISBN-10, EAN, or unknown."""
    digits_only = code.replace("-", "").replace(" ", "")
    if len(digits_only) == 13 and digits_only.startswith(("978", "979")):
        return constants.TYPE_ISBN13
    if len(digits_only) == 10:
        return constants.TYPE_ISBN10
    if len(digits_only) == 13 or len(digits_only) == 8:
        return constants.TYPE_EAN
    return constants.TYPE_UNKNOWN


def suggested_tag_from_code_type(code_type: str) -> Optional[str]:
    """Returns a suggested tag name based on the code type."""
    if code_type in (constants.TYPE_ISBN13, constants.TYPE_ISBN10):
        return constants.TAG_MANGA      # Default for now when ISBN is found
    if code_type == constants.TYPE_EAN:
        return constants.TAG_ANIME
    return None


def strip_volume_suffix(name: str) -> str:
    """
    Strips common volume/chapter suffixes from a title name
    before searching AniList.
    Examples:
        "No Game, No Life Vol. 1"  → "No Game, No Life"
        "One Piece Band 3"         → "One Piece"
        "Attack on Titan #5"       → "Attack on Titan"
        "Berserk Volume 10"        → "Berserk"
        "Sword Art Online Bd. 2"   → "Sword Art Online"
    """
    return re.sub(constants.STRIP_NAME_SUFFIXES_REGEX, '', name, flags=re.IGNORECASE).strip()


async def lookup_google_books(code: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Looks up a book by ISBN via Google Books API."""
    api_key = os.getenv("GOOGLE_BOOKS_API_KEY", "")
    params = {"q": f"isbn:{code}", "maxResults": 1}
    if api_key:
        params["key"] = api_key
    try:
        res = await client.get(
            constants.GOOGLE_BOOKS_BASE_URL,
            params=params,
            timeout=constants.EXTERNAL_API_TIMEOUT_SECONDS,
        )
        data = res.json()
        if data.get("totalItems", 0) == 0:
            return None
        item = data["items"][0]
        volume = item["volumeInfo"]
        isbn_10 = None
        isbn_13 = None
        for identifier in volume.get("industryIdentifiers", []):
            if identifier["type"] == "ISBN_10":
                isbn_10 = identifier["identifier"]
            if identifier["type"] == "ISBN_13":
                isbn_13 = identifier["identifier"]
        return {
            "name":             volume.get("title"),
            "author":           ", ".join(volume.get("authors", [])) or None,
            "publisher":        volume.get("publisher"),
            "publish_date":     volume.get("publishedDate"),
            "cover_image_url":  volume.get("imageLinks", {}).get("thumbnail"),
            "isbn_10":          isbn_10,
            "isbn_13":          isbn_13,
            "language":         volume.get("language"),
            "page_count":       volume.get("pageCount"),
            "google_books_id":  item.get("id"),
            "from_api":         constants.From_Api.GOOGLE_BOOKS.value,
        }
    except Exception as e:
        print(f"Google Books lookup error: {e}")
        return None


async def lookup_openlibrary(code: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Looks up a book by ISBN via OpenLibrary API (fallback)."""
    try:
        res = await client.get(
            constants.OPEN_LIBRARY_BASE_URL,
            params={"bibkeys": f"ISBN:{code}", "format": "json", "jscmd": "data"},
            timeout=constants.EXTERNAL_API_TIMEOUT_SECONDS,
        )
        text = res.text.strip()
        if not text:
            return None
        data = res.json()
        key = f"ISBN:{code}"
        if key not in data:
            return None
        book = data[key]
        authors = [a["name"] for a in book.get("authors", [])]
        publishers = [p["name"] for p in book.get("publishers", [])]
        cover = book.get("cover", {}).get("large") or book.get("cover", {}).get("medium")
        
        ol_cover = None
        try:
            cover_url = f"https://covers.openlibrary.org/b/isbn/{code}-L.jpg?default=false"
            head = await client.head(
                cover_url,
                timeout=3.0,
                headers={"User-Agent": "Mozilla/5.0 (compatible; inventar-media/1.0)"}
            )
            if head.status_code == 200:
                ol_cover = cover_url
        except Exception:
            pass
        final_cover = ol_cover or cover

        return {
            "name":            book.get("title"),
            "author":          ", ".join(authors) or None,
            "publisher":       ", ".join(publishers) or None,
            "publish_date":    book.get("publish_date"),
            "cover_image_url": final_cover,
            "isbn_10":         None,
            "isbn_13":         code if len(code) == 13 else None,
            "openlibrary_id":  book.get("key"),
            "from_api":        constants.From_Api.OPEN_LIBRARY.value,
        }

    except Exception as e:
        print(f"OpenLibrary lookup error: {e}")
        return None
    

async def lookup_ndl(code: str, client: httpx.AsyncClient) -> Optional[dict]:
    """
    Looks up a book by ISBN via the National Diet Library (NDL) Search API.
    Particularly strong for Japanese publications.
    Returns XML which is parsed for title, publisher, volume, language,
    and alternative (English) title.
    No API key required. Free for personal/non-commercial use.
    """
    try:
        res = await client.get(
            constants.NDL_SEARCH_BASE_URL,
            params={
                "operation":    "searchRetrieve",
                "version":      "1.2",
                "recordSchema": "dcndl",
                "onlyBib":      "true",
                "recordPacking": "xml",
                "query":        f'isbn="{code}" AND dpid=iss-ndl-opac',
            },
            timeout=constants.EXTERNAL_API_TIMEOUT_SECONDS,
        )
 
        root = ET.fromstring(res.text)
 
        # Check for diagnostics (= not found or error)
        ns_srw = "http://www.loc.gov/zing/srw/"
        diag = root.find(f"{{{ns_srw}}}diagnostics")
        if diag is not None:
            return None
 
        # Check numberOfRecords
        num = root.find(f"{{{ns_srw}}}numberOfRecords")
        if num is None or int(num.text or 0) == 0:
            return None
 
        # Navigate to BibResource
        ns = {
            "rdf":     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs":    "http://www.w3.org/2000/01/rdf-schema#",
            "dc":      "http://purl.org/dc/elements/1.1/",
            "dcterms": "http://purl.org/dc/terms/",
            "dcndl":   "http://ndl.go.jp/dcndl/terms/",
            "foaf":    "http://xmlns.com/foaf/0.1/",
        }
 
        bib = root.find(
            f".//{{{ns_srw}}}recordData"
            f"//{{{ns['rdf']}}}RDF"
            f"//{{{ns['dcndl']}}}BibResource"
        )
        if bib is None:
            return None
 
        def find_text(path: str) -> Optional[str]:
            el = bib.find(path, ns)
            return el.text.strip() if el is not None and el.text else None
 
        # Title — prefer dcterms:title (full with volume), fall back to dc:title value
        title_full = find_text("dcterms:title")
        title_native = find_text("dc:title/rdf:Description/rdf:value")
 
        # Use native title (without volume suffix) as the name
        name = title_native or title_full
 
        # Alternative title (often the English/romanized title)
        name_english = find_text("dcndl:alternative/rdf:Description/rdf:value")
 
        # Volume number
        volume_number = find_text("dcndl:volume/rdf:Description/rdf:value")
 
        # Publisher
        publisher = find_text(
            f"dcterms:publisher/{{{ns['foaf']}}}Agent/{{{ns['foaf']}}}name"
        )
 
        # Publish date
        publish_date = find_text("dcterms:date")
        if publish_date:
            # NDL returns e.g. "2016.4" — normalize to "2016-04"
            parts = publish_date.replace(".", "-").split("-")
            if len(parts) >= 2:
                publish_date = f"{parts[0]}-{parts[1].zfill(2)}"
            else:
                publish_date = parts[0]
 
        # Language — NDL uses ISO 639-2 (3-letter codes like "jpn")
        lang_el = bib.find("dcterms:language", ns)
        language = lang_el.text.strip() if lang_el is not None and lang_el.text else None
 
        # NDL thumbnail — verify existence via HEAD request
        # Only works with ISBN-13
        isbn13_normalized = code if len(code) == 13 else None
        ndl_cover = None
        if isbn13_normalized:
            thumbnail_url = f"https://ndlsearch.ndl.go.jp/thumbnail/{isbn13_normalized}.jpg"
            try:
                head = await client.head(
                    thumbnail_url,
                    timeout=3.0,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; inventar-media/1.0)"}
                )
                if head.status_code == 200:
                    ndl_cover = thumbnail_url
            except Exception:
                pass
 
        return {
            "name":            name,
            "name_english":    name_english,
            "volume_number":   volume_number,
            "publisher":       publisher,
            "publish_date":    publish_date,
            "language":        language,
            "cover_image_url": ndl_cover,
            "from_api":        constants.From_Api.NDL.value,
        }
 
    except Exception as e:
        print(f"NDL lookup error: {e}")
        return None


async def lookup_rakuten(code: str, client: httpx.AsyncClient) -> Optional[dict]:
    """
    Looks up a book by ISBN via Rakuten Books Total Search API.
    Best coverage for Japanese publisher ISBNs (978-4).
    Returns cover image URL, metadata including publisher.
    Requires RAKUTEN_APP_ID in environment.
    Fails gracefully if key is missing or invalid.
    """
    app_id     = os.getenv("RAKUTEN_APP_ID", "")
    access_key = os.getenv("RAKUTEN_ACCESS_KEY", "")
    origin     = os.getenv("RAKUTEN_ORIGIN", "")
    if not app_id or not access_key or not origin:
        return None
 
    try:
        res = await client.get(
            constants.RAKUTEN_BOOKS_BASE_URL,
            params={
                "applicationId":        app_id,
                "accessKey":            access_key,
                "isbnjan":              code,
                "formatVersion":        "2",
            },
            timeout=constants.EXTERNAL_API_TIMEOUT_SECONDS,
            headers={
                "Origin": origin
            },
        )
        if res.status_code in (401, 403):
            print(f"Rakuten API key invalid or unauthorized: {res.status_code}")
            return None
 
        data = res.json()
        if data.get("error"):
            print(f"Rakuten API error: {data.get('error')}")
            return None
 
        items = data.get("Items", [])
        if not items:
            return None
 
        item = items[0].get("Item", items[0])
        item_url = item.get("itemUrl", "")
        rakuten_id = item_url.rstrip("/").split("/")[-1] if item_url else None
 
        # Prefer largeImageUrl, fall back to mediumImageUrl
        cover = item.get("largeImageUrl") or item.get("mediumImageUrl") or None
 
        return {
            "name":            item.get("title"),
            "author":          item.get("author"),
            "publisher":       item.get("publisherName"),
            "publish_date":    item.get("salesDate"),
            "cover_image_url": cover,
            "isbn_13":         code if len(code) == 13 else None,
            "rakuten_item_code": rakuten_id,
            "from_api":        constants.From_Api.RAKUTEN.value,
        }
    except Exception as e:
        print(f"Rakuten lookup error: {e}")
        return None
 

async def lookup_anilist(
    search: str,
    media_type: str,  # "MANGA" or "ANIME"
    client: httpx.AsyncClient,
) -> Optional[dict]:
    """
    Looks up a title by name via AniList GraphQL API.
    Automatically strips volume suffixes before searching.
    Returns series-level metadata only — no volume-specific fields.
    cover_image_url here is a series fallback, not a volume cover.
    """
    cleaned_search = strip_volume_suffix(search)
    print(cleaned_search)
 
    query = """
    query ($search: String, $type: MediaType) {
        Media(search: $search, type: $type) {
            id
            title { romaji english native }
            coverImage { extraLarge }
            staff { edges { role node { name { full } } } }
            volumes
            chapters
            startDate { year month day }
            status
            isAdult
            genres
            tags { name }
        }
    }
    """
    try:
        res = await client.post(
            constants.ANILIST_GRAPHQL_URL,
            json={"query": query, "variables": {"search": cleaned_search, "type": media_type}},
            timeout=constants.EXTERNAL_API_TIMEOUT_SECONDS,
        )
        data = res.json()
        if "errors" in data or not data.get("data", {}).get("Media"):
            return None
 
        media = data["data"]["Media"]
 
        # Extract author — prefer "Story & Art", fall back to "Story" or "Art"
        authors = [
            edge["node"]["name"]["full"]
            for edge in media.get("staff", {}).get("edges", [])
            if edge.get("role") in ("Story & Art", "Story", "Art", "Original Creator")
        ]
 
        return {
            # Title names (series-level, safe for all volumes)
            "name":            media["title"].get("native"),
            "name_romaji":     media["title"].get("romaji"),
            "name_english":    media["title"].get("english"),
            "author":          ", ".join(dict.fromkeys(authors)) or None,  # deduplicated
            # Series-level fallback cover — goes into title_metadata, not item
            "title_cover_image_url": media.get("coverImage", {}).get("extraLarge"),
            # Series metadata
            "volume_count":    media.get("volumes"),
            "chapter_count":   media.get("chapters"),
            "status":          media.get("status"),
            "anilist_id":      media.get("id"),
            "is_adult":        media.get("isAdult", False),
            "tags":            [t["name"] for t in media.get("tags", [])],
            "genres":          media.get("genres", []),
            "from_api":        constants.From_Api.ANILIST.value,
        }
    except Exception as e:
        print(f"AniList lookup error: {e}")
        return None
    

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
 
@app.get("/api/health")
async def health():
    return {"status": "ok"}
 
 
@app.get("/api/auth/check")
async def auth_check(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    Returns the caller's resolved role.
    Used by the frontend on login to know what access level to apply.
    Works for guests too (no token required).
    """
    if not credentials:
        return {"role": "guest", "email": None}
 
    try:
        payload = _decode_token(credentials.credentials)
    except HTTPException:
        return {"role": "guest", "email": None}
 
    user_id = payload.get("sub")
    email = payload.get("email")
 
    if not user_id:
        return {"role": "guest", "email": None}
 
    role = await resolve_role(user_id)
    return {"role": role, "email": email}
 
 
@app.get("/api/tags")
async def list_tags(_: UserContext = Depends(get_optional_user)):
    """
    Returns all available tags. Readable by everyone.
    """
    rows = await database.fetch_all(tags_table.select().order_by(tags_table.c.name))
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]


@app.get("/api/titles", response_model=list[TitleOut])
async def list_titles(user: UserContext = Depends(get_optional_user)):
    """
    Returns all titles the caller is allowed to see.
    Guests and normal users do not see explicit titles.
    Admin and all_seeing see everything.
    """
    query = """
        SELECT
            t.id,
            t.name,
            t.is_explicit,
            t.created_at,
            tg.id   AS tag_id,
            tg.name AS tag_name,
            tm.volume_count,
            tm.chapter_count,
            tm.status,
            tm.anilist_id,
            tm.cover_image_url AS metadata_cover,
            tm.name_romaji
        FROM titles t
        JOIN tags tg ON tg.id = t.tag_id
        LEFT JOIN title_metadata tm ON tm.title_id = t.id
        WHERE (:see_explicit = TRUE OR t.is_explicit = FALSE)
        ORDER BY t.name ASC
    """
    rows = await database.fetch_all(query, values={"see_explicit": user.can_see_explicit})
    return [
        TitleOut(
            id=str(r["id"]),
            name=r["name"],
            tag=TagOut(id=str(r["tag_id"]), name=r["tag_name"]),
            is_explicit=r["is_explicit"],
            created_at=str(r["created_at"]),
            metadata=TitleMetadataOut(
                volume_count=r["volume_count"],
                chapter_count=r["chapter_count"],
                status=r["status"],
                anilist_id=r["anilist_id"],
                cover_image_url=r["metadata_cover"],
                name_romaji=r["name_romaji"],
            ) if any([r["volume_count"], r["chapter_count"], r["status"], r["anilist_id"], r["metadata_cover"], r["name_romaji"]]) else None,
            media_tags=await fetch_media_tags(str(r["id"])),
            media_genres=await fetch_media_genres(str(r["id"])),
        )
        for r in rows
    ]


@app.get("/api/titles/{title_id}", response_model=TitleOut)
async def get_title(title_id: str, user: UserContext = Depends(get_optional_user)):
    """
    Returns a single title by ID.
    Returns 404 if the title does not exist or the caller cannot see it.
    """
    row = await database.fetch_one("""
        SELECT
            t.id,
            t.name,
            t.is_explicit,
            t.created_at,
            tg.id   AS tag_id,
            tg.name AS tag_name,
            tm.volume_count,
            tm.chapter_count,
            tm.status,
            tm.anilist_id,
            tm.cover_image_url AS metadata_cover,
            tm.name_romaji
        FROM titles t
        JOIN tags tg ON tg.id = t.tag_id
        LEFT JOIN title_metadata tm ON tm.title_id = t.id
        WHERE t.id = :title_id
          AND (:see_explicit = TRUE OR t.is_explicit = FALSE)
    """, values={"title_id": title_id, "see_explicit": user.can_see_explicit})

    if not row:
        raise HTTPException(status_code=404, detail="Title not found")
    
    return TitleOut(
                id=str(row["id"]),
                name=row["name"],
                tag=TagOut(id=str(row["tag_id"]), name=row["tag_name"]),
                is_explicit=row["is_explicit"],
                created_at=str(row["created_at"]),
                metadata=TitleMetadataOut(
                    volume_count=row["volume_count"],
                    chapter_count=row["chapter_count"],
                    status=row["status"],
                    anilist_id=row["anilist_id"],
                    cover_image_url=row["metadata_cover"],
                    name_romaji=row["name_romaji"],
                ) if any([row["volume_count"], row["chapter_count"], row["status"], row["anilist_id"], row["metadata_cover"], row["name_romaji"]]) else None,
                media_tags=await fetch_media_tags(str(row["id"])),
                media_genres=await fetch_media_genres(str(row["id"])),
            )
 
 
@app.post("/api/titles", response_model=TitleOut, status_code=201)
async def create_title(body: TitleIn, user: UserContext = Depends(get_current_user)):
    """Creates a new title. Admin only."""
    tag_row = await database.fetch_one(
        tags_table.select().where(tags_table.c.id == body.tag_id)
    )
    if not tag_row:
        raise HTTPException(status_code=404, detail="Tag not found")
 
    tid = str(uuid.uuid4())
    await database.execute(
        titles_table.insert().values(
            id=tid,
            name=body.name,
            tag_id=body.tag_id,
            is_explicit=body.is_explicit,
        )
    )
 
    await upsert_title_metadata(
        tid,
        body.volume_count,
        body.chapter_count,
        body.status,
        body.anilist_id,
        body.title_cover_image_url,
    )
 
    await upsert_tags_and_genres(tid, body.tags, body.genres)
    return await get_title(tid, user)
 
 
@app.put("/api/titles/{title_id}", response_model=TitleOut)
async def update_title(
    title_id: str,
    body: TitleUpdate,
    user: UserContext = Depends(get_current_user),
):
    """
    Updates a title. Admin only.
    Only provided fields are updated (partial update).
    """
    existing = await database.fetch_one(
        titles_table.select().where(titles_table.c.id == title_id)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Title not found")
 
    # If tag_id is being updated, verify it exists
    if body.tag_id is not None:
        tag_row = await database.fetch_one(
            tags_table.select().where(tags_table.c.id == body.tag_id)
        )
        if not tag_row:
            raise HTTPException(status_code=404, detail="Tag not found")
 
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if updates:
        await database.execute(
            titles_table.update()
            .where(titles_table.c.id == title_id)
            .values(**updates)
        )
 
    return await get_title(title_id, user)
 
 
@app.delete("/api/titles/{title_id}", status_code=204)
async def delete_title(
    title_id: str,
    user: UserContext = Depends(get_current_user),
):
    """
    Deletes a title and all its items (cascade handled by DB).
    Admin only.
    """
    existing = await database.fetch_one("""
        SELECT id FROM titles
        WHERE id = :title_id
        AND (:see_explicit = TRUE OR is_explicit = FALSE)
    """, values={"title_id": title_id, "see_explicit": user.can_see_explicit})
    if not existing:
        raise HTTPException(status_code=404, detail="Title not found")
 
    await database.execute(
        titles_table.delete().where(titles_table.c.id == title_id)
    )
    return None


@app.get("/api/titles/{title_id}/items", response_model=list[ItemOut])
async def list_items(
    title_id: str,
    user: UserContext = Depends(get_optional_user),
):
    """
    Returns all items for a title.
    Respects the same explicit filter as titles — guests cannot access
    items of explicit titles (the title lookup will 404 for them).
    """
    tag_name = await get_tag_name_for_title(title_id, user)
 
    rows = await database.fetch_all(
        items_table.select()
        .where(items_table.c.title_id == title_id)
        .order_by(items_table.c.date_added.asc())
    )
 
    result = []
    for row in rows:
        result.append(await fetch_item_with_detail(str(row["id"]), tag_name))
    return result


@app.get("/api/items/{item_id}", response_model=ItemOut)
async def get_item(
    item_id: str,
    user: UserContext = Depends(get_optional_user),
):
    """
    Returns a single item by ID with its type-specific detail fields.
    """
    item_row = await database.fetch_one(
        items_table.select().where(items_table.c.id == item_id)
    )
    if not item_row:
        raise HTTPException(status_code=404, detail="Item not found")

    tag_name = await get_tag_name_for_title(str(item_row["title_id"]), user)

    return await fetch_item_with_detail(item_id, tag_name)
 
 
@app.post("/api/titles/{title_id}/items", response_model=ItemOut, status_code=201)
async def create_item(
    title_id: str,
    body: ItemIn,
    user: UserContext = Depends(get_current_user),
):
    """Creates a new item under a title. Admin only."""
    tag_name = await get_tag_name_for_title(title_id, user)
 
    iid = str(uuid.uuid4())
    await database.execute(
        items_table.insert().values(
            id=iid,
            title_id=title_id,
            name=body.name,
            name_romaji=body.name_romaji,
            name_english=body.name_english,
            volume_number=body.volume_number,
            language=body.language,
            edition=body.edition,
            cover_image_url=body.cover_image_url,
        )
    )
 
    # Insert type-specific detail row
    detail_table = TAG_TO_DETAIL_TABLE.get(tag_name)
    if detail_table is not None:
        detail_values: dict = {"item_id": iid}
        cols = [c.name for c in detail_table.columns if c.name != "item_id"]
        for col in cols:
            detail_values[col] = getattr(body, col, None)
        await database.execute(detail_table.insert().values(**detail_values))
 
    # Upsert external IDs
    await upsert_item_external_ids(iid, body.external_ids)

    if body.name_romaji:
        await upsert_title_metadata(
            title_id,
            volume_count=None,
            chapter_count=None,
            status=None,
            anilist_id=None,
            name_romaji=body.name_romaji,
        )
 
    # Register language if new
    if body.language:
        await database.execute("""
            INSERT INTO language_registry (id, language)
            VALUES (:id, :language)
            ON CONFLICT (language) DO NOTHING
        """, values={"id": str(uuid.uuid4()), "language": body.language})
 
    return await fetch_item_with_detail(iid, tag_name)


@app.put("/api/items/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: str,
    body: ItemIn,
    user: UserContext = Depends(get_current_user),
):
    """Updates an item and its type-specific detail row. Admin only."""
    item_row = await database.fetch_one(
        items_table.select().where(items_table.c.id == item_id)
    )
    if not item_row:
        raise HTTPException(status_code=404, detail="Item not found")
 
    tag_name = await get_tag_name_for_title(str(item_row["title_id"]), user)
 
    await database.execute(
        items_table.update()
        .where(items_table.c.id == item_id)
        .values(
            name=body.name,
            name_romaji=body.name_romaji,
            name_english=body.name_english,
            volume_number=body.volume_number,
            language=body.language,
            edition=body.edition,
            cover_image_url=body.cover_image_url,
        )
    )
 
    detail_table = TAG_TO_DETAIL_TABLE.get(tag_name)
    if detail_table is not None:
        detail_values: dict = {}
        cols = [c.name for c in detail_table.columns if c.name != "item_id"]
        for col in cols:
            detail_values[col] = getattr(body, col, None)
        existing_detail = await database.fetch_one(
            detail_table.select().where(detail_table.c.item_id == item_id)
        )
        if existing_detail:
            await database.execute(
                detail_table.update()
                .where(detail_table.c.item_id == item_id)
                .values(**detail_values)
            )
        else:
            await database.execute(
                detail_table.insert().values(item_id=item_id, **detail_values)
            )
 
    # Upsert external IDs
    await upsert_item_external_ids(item_id, body.external_ids)
 
    if body.language:
        await database.execute("""
            INSERT INTO language_registry (id, language)
            VALUES (:id, :language)
            ON CONFLICT (language) DO NOTHING
        """, values={"id": str(uuid.uuid4()), "language": body.language})
 
    return await fetch_item_with_detail(item_id, tag_name)


@app.delete("/api/items/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    user: UserContext = Depends(get_current_user),
):
    """
    Deletes an item. Admin only.
    Detail row is deleted automatically via DB cascade.
    """
    item_row = await database.fetch_one(
        items_table.select().where(items_table.c.id == item_id)
    )
    if not item_row:
        raise HTTPException(status_code=404, detail="Item not found")
 
    await database.execute(
        items_table.delete().where(items_table.c.id == item_id)
    )
    return None
 
 
@app.get("/api/languages")
async def list_languages(
    q: str = "",
    _: UserContext = Depends(get_optional_user),
):
    """
    Returns language suggestions for autocomplete.
    Filters by prefix if q is provided.
    """
    if q:
        rows = await database.fetch_all("""
            SELECT language FROM language_registry
            WHERE language ILIKE :prefix
            ORDER BY language ASC
            LIMIT 10
        """, values={"prefix": f"{q}%"})
    else:
        rows = await database.fetch_all("""
            SELECT language FROM language_registry
            ORDER BY language ASC
        """)
    return [r["language"] for r in rows]

 
@app.get("/api/lookup", response_model=LookupResult)
async def lookup_barcode(
    code: str,
    _: UserContext = Depends(get_optional_user),
):
    """
    Cascading ISBN/barcode lookup with parallel API calls per market.
    Japanese (978-4): Google Books + Rakuten + NDL in parallel, then AniList
    German   (978-3): Google Books + OpenLibrary in parallel, then AniList
    Other           : Google Books + OpenLibrary in parallel, then AniList
    Results are merged: first non-None value per field wins.
    """
    code = code.strip()
    code_type = detect_code_type(code)
    suggested_tag = suggested_tag_from_code_type(code_type)
 
    if code_type not in (constants.TYPE_ISBN13, constants.TYPE_ISBN10):
        return LookupResult(
            code=code,
            code_type=code_type,
            suggested_tag=suggested_tag,
            ean=code if code_type == constants.TYPE_EAN else None,
            sources_used=[constants.From_Api.NO_API.value],
        )
 
    merged: dict = {
        "name": None, "name_romaji": None, "name_english": None,
        "author": None, "publisher": None, "publish_date": None,
        "cover_image_url": None,
        "title_cover_image_url": None,
        "isbn_10": None, "isbn_13": None,
        "page_count": None,
        "language": None,
        "google_books_id": None,
        "openlibrary_id": None,
        "rakuten_item_code": None,
        "volume_number": None,
        "volume_count": None, "chapter_count": None,
        "status": None, "anilist_id": None,
        "is_adult": False, "tags": [], "genres": [],
        "sources_used": [],
        "anilist_found": True,
    }
 
    if code_type == constants.TYPE_ISBN10:
        merged["isbn_10"] = code
    else:
        merged["isbn_13"] = code
 
    def merge(result: dict):
        for key, value in result.items():
            if key == "is_adult":
                if value:
                    merged["is_adult"] = True
            elif key in ("tags", "genres"):
                existing = set(merged.get(key, []))
                existing.update(value or [])
                merged[key] = list(existing)
            elif key == "from_api":
                if value and value != constants.From_Api.NO_API.value:
                    if value not in merged["sources_used"]:
                        merged["sources_used"].append(value)
            elif key == "title_cover_image_url":
                if merged.get("title_cover_image_url") is None and value:
                    merged["title_cover_image_url"] = value
            elif key == "google_books_id":
                if merged.get("google_books_id") is None and value:
                    merged["google_books_id"] = value
            elif key == "openlibrary_id":
                if merged.get("openlibrary_id") is None and value:
                    merged["openlibrary_id"] = value
            elif key == "rakuten_item_code":
                if merged.get("rakuten_item_code") is None and value:
                    merged["rakuten_item_code"] = value
            elif value is not None and merged.get(key) is None:
                merged[key] = value
 
    is_japanese = code.startswith(constants.ISBN_PREFIX_JAPANESE)
 
    async with httpx.AsyncClient() as client:
 
        # ---- Phase 1: parallel bibliographic lookups ----
        if is_japanese:
            tasks = [
                lookup_google_books(code, client),
                lookup_rakuten(code, client),
                lookup_ndl(code, client),
            ]
        else:
            # German (978-3) and all others: Google Books + OpenLibrary
            tasks = [
                lookup_google_books(code, client),
                lookup_openlibrary(code, client),
            ]
 
        results = await asyncio.gather(*tasks, return_exceptions=True)
 
        for result in results:
            if isinstance(result, Exception):
                print(f"Lookup task error: {result}")
                continue
            if result:
                merge(result)
 
        # ---- Phase 2: AniList (needs merged name from phase 1) ----
        if merged.get("name"):
            name_lower = merged["name"].lower()
            # Improve suggested_tag based on media type suffix
            if "(light novel)" in name_lower:
                suggested_tag = constants.TAG_LIGHT_NOVEL
            elif "(novel)" in name_lower:
                suggested_tag = constants.TAG_NOVEL
            elif "(manga)" in name_lower:
                suggested_tag = constants.TAG_MANGA
            elif "(art book)" in name_lower:
                suggested_tag = constants.TAG_ART_BOOK

            if not merged.get("volume_number"):
                vol_match = re.search(
                    r'(?:Vol\.?|Volume|Band|Bd\.?|#)\s*(\d+)',
                    merged["name"],
                    flags=re.IGNORECASE
                )
                if not vol_match:
                    vol_match = re.search(r'\b(\d+)\s*$', merged["name"])
                if vol_match:
                    merged["volume_number"] = vol_match.group(1)

            merged["name"] = strip_volume_suffix(merged["name"])

            anilist_media_type = "ANIME" if suggested_tag == constants.TAG_ANIME else "MANGA"
            al_result = await lookup_anilist(merged["name"], anilist_media_type, client)
            if al_result:
                merge(al_result)
            else:
                merged["anilist_found"] = False
        else:
            merged["anilist_found"] = False
 
    # Build external_ids list
    external_ids: list[dict] = []
    if merged.get("google_books_id"):
        external_ids.append({
            "source":      constants.From_Api.GOOGLE_BOOKS.value,
            "external_id": merged["google_books_id"],
        })
    if merged.get("openlibrary_id"):
        external_ids.append({
            "source":      constants.From_Api.OPEN_LIBRARY.value,
            "external_id": merged["openlibrary_id"],
        })
    if merged.get("rakuten_item_code"):
        external_ids.append({
            "source":      constants.From_Api.RAKUTEN.value,
            "external_id": merged["rakuten_item_code"],
        })
    if merged.get("anilist_id"):
        external_ids.append({
            "source":      constants.From_Api.ANILIST.value,
            "external_id": str(merged["anilist_id"]),
        })
 
    if not merged["sources_used"]:
        merged["sources_used"] = [constants.From_Api.NO_API.value]
 
    response_merged = {k: v for k, v in merged.items()
                       if k not in ("google_books_id", "openlibrary_id", "rakuten_item_code")}
 
    return LookupResult(
        code=code,
        code_type=code_type,
        suggested_tag=suggested_tag,
        external_ids=external_ids,
        **response_merged,
    )
 

@app.get("/api/media-tags")
async def list_media_tags(
    q: str = "",
    _: UserContext = Depends(get_optional_user),
):
    """Returns media tag suggestions for autocomplete."""
    if q:
        rows = await database.fetch_all("""
            SELECT name FROM media_tags
            WHERE name ILIKE :prefix
            ORDER BY name ASC
            LIMIT 10
        """, values={"prefix": f"%{q}%"})
    else:
        rows = await database.fetch_all(
            "SELECT name FROM media_tags ORDER BY name ASC"
        )
    return [r["name"] for r in rows]
 
 
@app.get("/api/media-genres")
async def list_media_genres(
    q: str = "",
    _: UserContext = Depends(get_optional_user),
):
    """Returns media genre suggestions for autocomplete."""
    if q:
        rows = await database.fetch_all("""
            SELECT name FROM media_genres
            WHERE name ILIKE :prefix
            ORDER BY name ASC
            LIMIT 10
        """, values={"prefix": f"%{q}%"})
    else:
        rows = await database.fetch_all(
            "SELECT name FROM media_genres ORDER BY name ASC"
        )
    return [r["name"] for r in rows]


@app.get("/api/anilist-search")
async def anilist_search(
    q: str,
    type: str = "MANGA",  # "MANGA" or "ANIME"
    _: UserContext = Depends(get_optional_user),
):
    """
    Manual AniList search endpoint.
    Used by the frontend "Search AniList" button when automatic
    lookup returned no AniList result.
    Returns the same shape as a LookupResult's AniList fields.
    """
    if type not in ("MANGA", "ANIME"):
        raise HTTPException(status_code=400, detail="type must be MANGA or ANIME")
    if not q.strip():
        raise HTTPException(status_code=400, detail="q must not be empty")
 
    async with httpx.AsyncClient() as client:
        result = await lookup_anilist(q.strip(), type, client)
 
    if not result:
        return {"found": False}
 
    return {"found": True, **result}