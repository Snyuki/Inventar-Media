from contextlib import asynccontextmanager
from typing import Optional
import os
 
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
 
sync_url = DATABASE_URL.replace("+asyncpg", "")
engine = sqlalchemy.create_engine(sync_url)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"DEBUG SUPABASE_URL: {SUPABASE_URL}")
    print(f"DEBUG JWKS_URL: {JWKS_URL}")
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
            user_roles_table.c.id == user_id
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