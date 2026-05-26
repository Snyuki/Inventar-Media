import { supabase } from "./supabase";
import { Item, Title } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function headers(requireAuth = false): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  if (requireAuth && !token) throw new Error("Authentication required");
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

export async function checkAuthRole(): Promise<{ role: string; email: string | null }> {
  const res = await fetch(`${BASE_URL}/auth/check`, {
    headers: await headers(),
  });
  return handleResponse(res);
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


// ---------------------------------------------------------------------------
// Items
// 
 
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
 