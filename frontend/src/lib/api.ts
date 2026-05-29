import { Item, LookupResult, Title } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
let _cachedToken: string | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function headers(requireAuth = false): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_cachedToken) h["Authorization"] = `Bearer ${_cachedToken}`;
  if (requireAuth && !_cachedToken) throw new Error("Authentication required");
  return h;
}

async function handleResponse(res: Response): Promise<any> {
  if (!res.ok) {
    let message = `Request fehlgeschlagen (${res.status})`;
    try {
      const body = await res.json();
      if (res.status === 409) throw { status: 409, detail: body.detail };
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail))
        message = body.detail.map((e: any) => e.msg).join(", ");
    } catch (e: any) {
      if (e.status === 409) throw e;
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function checkAuthRole(token?: string): Promise<{ role: string; email: string | null }> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/auth/check`, { headers: h });
  return handleResponse(res);
}

export function setAuthToken(token: string | null) {
  _cachedToken = token;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${BASE_URL}/tags`, {
    headers: await headers(),
  });
  return handleResponse(res);
}


// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

export async function fetchTitles(): Promise<Title[]> {
  const res = await fetch(`${BASE_URL}/titles`, {
    headers: await headers(),
  });
  const data = await handleResponse(res);
  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    tag: { id: t.tag.id, name: t.tag.name },
    isExplicit: t.is_explicit,
    externalId: t.external_id ?? null,
    createdAt: t.created_at,
    coverImageUrl: null, // resolved from items later
  }));
}

export async function createTitle(body: {
  name: string;
  tag_id: string;
  is_explicit: boolean;
  external_id?: string | null;
}): Promise<Title> {
  const res = await fetch(`${BASE_URL}/titles`, {
    method: "POST",
    headers: await headers(true),
    body: JSON.stringify(body),
  });
  const data = await handleResponse(res);
  return {
    id: data.id,
    name: data.name,
    tag: { id: data.tag.id, name: data.tag.name },
    isExplicit: data.is_explicit,
    externalId: data.external_id ?? null,
    createdAt: data.created_at,
    coverImageUrl: null,
  };
}


// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
 
export async function fetchItems(titleId: string): Promise<Item[]> {
  const res = await fetch(`${BASE_URL}/titles/${titleId}/items`, {
    headers: await headers(),
  });
  const data = await handleResponse(res);
  return data.map((i: any) => ({
    id: i.id,
    titleId: i.title_id,
    name: i.name,
    volumeNumber: i.volume_number ?? null,
    language: i.language ?? null,
    edition: i.edition ?? null,
    coverImageUrl: i.cover_image_url ?? null,
    externalId: i.external_id ?? null,
    dateAdded: i.date_added,
    // type-specific
    isbn10: i.isbn_10 ?? null,
    isbn13: i.isbn_13 ?? null,
    publisher: i.publisher ?? null,
    author: i.author ?? null,
    publishDate: i.publish_date ?? null,
    ean: i.ean ?? null,
  }));
}

export async function createItem(
  titleId: string,
  body: {
    name: string;
    volume_number?: string | null;
    language?: string | null;
    edition?: string | null;
    cover_image_url?: string | null;
    external_id?: string | null;
    isbn_10?: string | null;
    isbn_13?: string | null;
    publisher?: string | null;
    author?: string | null;
    publish_date?: string | null;
    ean?: string | null;
  }
): Promise<void> {
  const res = await fetch(`${BASE_URL}/titles/${titleId}/items`, {
    method: "POST",
    headers: await headers(true),
    body: JSON.stringify(body),
  });
  await handleResponse(res);
}


// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

export async function fetchLanguageSuggestions(q: string): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/languages?q=${encodeURIComponent(q)}`, {
    headers: await headers(),
  });
  return handleResponse(res);
}


// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

export async function lookupBarcode(code: string): Promise<LookupResult> {
  const res = await fetch(`${BASE_URL}/lookup?code=${encodeURIComponent(code)}`, {
    headers: await headers(),
  });
  return handleResponse(res);
}