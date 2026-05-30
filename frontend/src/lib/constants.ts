/**
 * Tag color map — keyed by tag name as stored in the DB.
 * Used for the vertical left border on title cards.
 * To add a new tag color: insert the tag in the DB via SQL,
 * then add the corresponding entry here.
 */
export const TAG_COLORS: Record<string, string> = {
  "Manga":       "#F97316",
  "Light Novel": "#8B5CF6",
  "Anime":       "#3B82F6",
  "Novel":       "#10B981",
  "Art Book":    "#EC4899",
  "Sonstiges":   "#6B7280",
};
 
/**
 * Fallback color for unknown tags.
 */
export const TAG_COLOR_FALLBACK = "#9CA3AF";
 
/**
 * Maps ISO 639-1 language codes (as returned by APIs like Google Books)
 * to German display names used in the language field.
 * If a code is not found here, the raw code is inserted into the field as-is.
 */
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  "af":    "Afrikaans",
  "ar":    "Arabisch",
  "bg":    "Bulgarisch",
  "bn":    "Bengalisch",
  "ca":    "Katalanisch",
  "cs":    "Tschechisch",
  "cy":    "Walisisch",
  "da":    "Dänisch",
  "de":    "Deutsch",
  "el":    "Griechisch",
  "en":    "Englisch",
  "es":    "Spanisch",
  "et":    "Estnisch",
  "fa":    "Persisch",
  "fi":    "Finnisch",
  "fr":    "Französisch",
  "ga":    "Irisch",
  "gl":    "Galizisch",
  "gu":    "Gujarati",
  "he":    "Hebräisch",
  "hi":    "Hindi",
  "hr":    "Kroatisch",
  "hu":    "Ungarisch",
  "hy":    "Armenisch",
  "id":    "Indonesisch",
  "is":    "Isländisch",
  "it":    "Italienisch",
  "ja":    "Japanisch",
  "ka":    "Georgisch",
  "kn":    "Kannada",
  "ko":    "Koreanisch",
  "lt":    "Litauisch",
  "lv":    "Lettisch",
  "mk":    "Mazedonisch",
  "ml":    "Malayalam",
  "mr":    "Marathi",
  "ms":    "Malaiisch",
  "mt":    "Maltesisch",
  "nl":    "Niederländisch",
  "no":    "Norwegisch",
  "pa":    "Punjabi",
  "pl":    "Polnisch",
  "pt":    "Portugiesisch",
  "ro":    "Rumänisch",
  "ru":    "Russisch",
  "sk":    "Slowakisch",
  "sl":    "Slowenisch",
  "sq":    "Albanisch",
  "sr":    "Serbisch",
  "sv":    "Schwedisch",
  "sw":    "Suaheli",
  "ta":    "Tamilisch",
  "te":    "Telugu",
  "th":    "Thailändisch",
  "tl":    "Filipinisch",
  "tr":    "Türkisch",
  "uk":    "Ukrainisch",
  "ur":    "Urdu",
  "vi":    "Vietnamesisch",
  "zh":    "Chinesisch",
  "zh-cn": "Chinesisch (Vereinfacht)",
  "zh-tw": "Chinesisch (Traditionell)",
};
 
/**
 * Resolves an ISO language code to a German display name.
 * Falls back to the raw code if not found in the map.
 */
export function resolveLanguageCode(code: string): string {
  return LANGUAGE_CODE_MAP[code.toLowerCase()] ?? code;
}
 
/**
 * Book-type tags — these show book-specific fields (ISBN, author, etc.)
 */
export const BOOK_TAGS = ["Manga", "Light Novel", "Novel", "Art Book"];
 
/**
 * Tags where volume_count and chapter_count apply.
 */
export const APPLY_SERIES_COUNT_TAGS = ["Manga", "Light Novel", "Novel"];
 
/**
 * Tags where status applies.
 */
export const APPLY_STATUS_TAGS = ["Manga", "Light Novel", "Novel", "Anime"];

/**
 * Strips a suffix from a title/item name
 * 
 * @param name The title/item name where to strip the suffix from
 * @returns The stripped title
 */
export function stripVolumeSuffix(name: string): string {
  return name
    .replace(/\s+(Vol\.?|Volume|Band|Bd\.?|#|Tome|Book|Part|Episode|Box)\s*\d+.*$/i, "")
    .replace(/\s+\d+$/, "")
    .trim();
}