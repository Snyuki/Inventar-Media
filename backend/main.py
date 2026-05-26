from contextlib import asynccontextmanager
from typing import Optional
import os
import uuid
from pydantic import BaseModel, field_validator
import re
import httpx
 
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt
from jwt import PyJWKClient
import databases
import sqlalchemy
 
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
    sqlalchemy.Column("volume_number",   sqlalchemy.String, nullable=True),
    sqlalchemy.Column("language",        sqlalchemy.String, nullable=True),
    sqlalchemy.Column("edition",         sqlalchemy.String, nullable=True),
    sqlalchemy.Column("cover_image_url", sqlalchemy.String, nullable=True),
    sqlalchemy.Column("external_id",     sqlalchemy.String, nullable=True),
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
)
 
items_light_novel_table = sqlalchemy.Table(
    "items_light_novel", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
)
 
items_novel_table = sqlalchemy.Table(
    "items_novel", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
)
 
items_art_book_table = sqlalchemy.Table(
    "items_art_book", metadata,
    sqlalchemy.Column("item_id",      sqlalchemy.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
    sqlalchemy.Column("isbn_10",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("isbn_13",      sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publisher",    sqlalchemy.String, nullable=True),
    sqlalchemy.Column("author",       sqlalchemy.String, nullable=True),
    sqlalchemy.Column("publish_date", sqlalchemy.String, nullable=True),
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
 
TAG_TO_DETAIL_TABLE: dict[str, sqlalchemy.Table] = {
    "Manga":        items_manga_table,
    "Light Novel":  items_light_novel_table,
    "Novel":        items_novel_table,
    "Art Book":     items_art_book_table,
    "Anime":        items_anime_table,
    "Sonstiges":    items_sonstiges_table,
}
 
sync_url = DATABASE_URL.replace("+asyncpg", "")
engine = sqlalchemy.create_engine(sync_url)

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
 
 
class TitleOut(BaseModel):
    id: str
    name: str
    tag: TagOut
    is_explicit: bool
    external_id: Optional[str]
    created_at: str
 
 
class TitleIn(BaseModel):
    name: str
    tag_id: str
    is_explicit: bool = False
    external_id: Optional[str] = None
 
 
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
    volume_number:   Optional[str] = None
    language:        Optional[str] = None
    edition:         Optional[str] = None
    cover_image_url: Optional[str] = None
    external_id:     Optional[str] = None
    # Type-specific detail fields — only the relevant ones need to be filled
    isbn_10:         Optional[str] = None
    isbn_13:         Optional[str] = None
    publisher:       Optional[str] = None
    author:          Optional[str] = None
    publish_date:    Optional[str] = None
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
    volume_number:   Optional[str]
    language:        Optional[str]
    edition:         Optional[str]
    cover_image_url: Optional[str]
    external_id:     Optional[str]
    date_added:      str
    # Type-specific fields (None if not applicable for this type)
    isbn_10:         Optional[str] = None
    isbn_13:         Optional[str] = None
    publisher:       Optional[str] = None
    author:          Optional[str] = None
    publish_date:    Optional[str] = None
    ean:             Optional[str] = None
 

# ---------------------------------------------------------------------------
# Pydantic models — Lookup
# ---------------------------------------------------------------------------
 
class LookupResult(BaseModel):
    code: str                        # the raw barcode value
    code_type: str                   # "isbn13", "isbn10", "ean", "unknown"
    suggested_tag: Optional[str]     # "Manga", "Anime", None, etc.
    name:         Optional[str] = None
    author:       Optional[str] = None
    publisher:    Optional[str] = None
    publish_date: Optional[str] = None
    cover_image_url: Optional[str] = None
    isbn_10:      Optional[str] = None
    isbn_13:      Optional[str] = None
    ean:          Optional[str] = None
    from_api:     Optional[str] = None


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
    """Fetches base item + type-specific detail and returns a combined ItemOut."""
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
 
    return ItemOut(
        id=str(item_row["id"]),
        title_id=str(item_row["title_id"]),
        name=item_row["name"],
        volume_number=item_row["volume_number"],
        language=item_row["language"],
        edition=item_row["edition"],
        cover_image_url=item_row["cover_image_url"],
        external_id=item_row["external_id"],
        date_added=str(item_row["date_added"]),
        isbn_10=detail_row["isbn_10"] if detail_row and "isbn_10" in detail_row.keys() else None,
        isbn_13=detail_row["isbn_13"] if detail_row and "isbn_13" in detail_row.keys() else None,
        publisher=detail_row["publisher"] if detail_row and "publisher" in detail_row.keys() else None,
        author=detail_row["author"] if detail_row and "author" in detail_row.keys() else None,
        publish_date=detail_row["publish_date"] if detail_row and "publish_date" in detail_row.keys() else None,
        ean=detail_row["ean"] if detail_row and "ean" in detail_row.keys() else None,
    )


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
        print(f"Google Books response: {data}")
        if data.get("totalItems", 0) == 0:
            return None
        volume = data["items"][0]["volumeInfo"]
        isbn_10 = None
        isbn_13 = None
        for identifier in volume.get("industryIdentifiers", []):
            if identifier["type"] == "ISBN_10":
                isbn_10 = identifier["identifier"]
            if identifier["type"] == "ISBN_13":
                isbn_13 = identifier["identifier"]
        return {
            "name":            volume.get("title"),
            "author":          ", ".join(volume.get("authors", [])) or None,
            "publisher":       volume.get("publisher"),
            "publish_date":    volume.get("publishedDate"),
            "cover_image_url": volume.get("imageLinks", {}).get("thumbnail"),
            "isbn_10":         isbn_10,
            "isbn_13":         isbn_13,
            "from_api":        constants.From_Api.GOOGLE_BOOKS.value,
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
        return {
            "name":            book.get("title"),
            "author":          ", ".join(authors) or None,
            "publisher":       ", ".join(publishers) or None,
            "publish_date":    book.get("publish_date"),
            "cover_image_url": cover,
            "isbn_10":         None,
            "isbn_13":         code if len(code) == 13 else None,
            "from_api":        constants.From_Api.OPEN_LIBRARY.value,
        }
    except Exception as e:
        print(f"OpenLibrary lookup error: {e}")
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
            t.external_id,
            t.created_at,
            tg.id   AS tag_id,
            tg.name AS tag_name
        FROM titles t
        JOIN tags tg ON tg.id = t.tag_id
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
            external_id=r["external_id"],
            created_at=str(r["created_at"]),
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
            t.external_id,
            t.created_at,
            tg.id   AS tag_id,
            tg.name AS tag_name
        FROM titles t
        JOIN tags tg ON tg.id = t.tag_id
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
        external_id=row["external_id"],
        created_at=str(row["created_at"]),
    )
 
 
@app.post("/api/titles", response_model=TitleOut, status_code=201)
async def create_title(body: TitleIn, user: UserContext = Depends(get_current_user)):
    """
    Creates a new title. Admin only.
    Returns 404 if the given tag_id does not exist.
    """
    # Verify tag exists
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
            external_id=body.external_id,
        )
    )
 
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
    """
    Creates a new item under a title. Admin only.
    Also inserts a row into the correct per-type detail table.
    Registers the language in language_registry if new.
    """
    tag_name = await get_tag_name_for_title(title_id, user)
 
    iid = str(uuid.uuid4())
    await database.execute(
        items_table.insert().values(
            id=iid,
            title_id=title_id,
            name=body.name,
            volume_number=body.volume_number,
            language=body.language,
            edition=body.edition,
            cover_image_url=body.cover_image_url,
            external_id=body.external_id,
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
    """
    Updates an item and its type-specific detail row. Admin only.
    """
    item_row = await database.fetch_one(
        items_table.select().where(items_table.c.id == item_id)
    )
    if not item_row:
        raise HTTPException(status_code=404, detail="Item not found")
 
    tag_name = await get_tag_name_for_title(str(item_row["title_id"]), user)
 
    # Update base fields
    await database.execute(
        items_table.update()
        .where(items_table.c.id == item_id)
        .values(
            name=body.name,
            volume_number=body.volume_number,
            language=body.language,
            edition=body.edition,
            cover_image_url=body.cover_image_url,
            external_id=body.external_id,
        )
    )
 
    # Update detail row
    detail_table = TAG_TO_DETAIL_TABLE.get(tag_name)
    if detail_table is not None:
        detail_values: dict = {}
        cols = [c.name for c in detail_table.columns if c.name != "item_id"]
        for col in cols:
            detail_values[col] = getattr(body, col, None)
        # Upsert: update if exists, insert if not
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
 
    # Register language if new
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
    Looks up a barcode/ISBN and returns prefill data for the item form.
    - ISBN-13 / ISBN-10 → tries Google Books, falls back to OpenLibrary
    - EAN → returns raw EAN with suggested tag "Anime", no API lookup
    - Unknown → returns code as-is with no prefill
 
    Guests can use this endpoint since it reads no user data.
    """
    code = code.strip()
    code_type = detect_code_type(code)
    suggested_tag = suggested_tag_from_code_type(code_type)
 
    # Non-book code — return immediately with no API lookup
    if code_type not in (constants.TYPE_ISBN13, constants.TYPE_ISBN10):
        return LookupResult(
            code=code,
            code_type=code_type,
            suggested_tag=suggested_tag,
            ean=code if code_type == constants.TYPE_EAN else None,
            from_api=constants.From_Api.NO_API.value,
        )
 
    # Book code — try Google Books first, then OpenLibrary
    async with httpx.AsyncClient() as client:
        result = await lookup_google_books(code, client)
        if not result:
            result = await lookup_openlibrary(code, client)
 
    if not result:
        # No result from any API — return code type info only
        return LookupResult(
            code=code,
            code_type=code_type,
            suggested_tag=suggested_tag,
            isbn_10=code if code_type == constants.TYPE_ISBN10 else None,
            isbn_13=code if code_type == constants.TYPE_ISBN13 else None,
            from_api=constants.From_Api.NO_API.value,
        )
 
    return LookupResult(
        code=code,
        code_type=code_type,
        suggested_tag=suggested_tag,
        **result,
    )