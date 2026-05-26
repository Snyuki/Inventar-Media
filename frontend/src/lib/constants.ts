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