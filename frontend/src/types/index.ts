// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "all_seeing" | "guest";

export interface UserContext {
  role: UserRole;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

export interface Title {
  id: string;
  name: string;
  tag: Tag;
  isExplicit: boolean;
  externalId: string | null;
  createdAt: string;
  coverImageUrl: string | null; // resolved from first item at runtime
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface Item {
  id: string;
  titleId: string;
  name: string;
  volumeNumber: string | null;
  language: string | null;
  edition: string | null;
  coverImageUrl: string | null;
  externalId: string | null;
  dateAdded: string;
  // type-specific fields (null if not applicable)
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  author: string | null;
  publishDate: string | null;
  ean: string | null;
}
 

// Detail types (type-specific fields)
export interface ItemDetailManga {
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  author: string | null;
  publishDate: string | null;
}