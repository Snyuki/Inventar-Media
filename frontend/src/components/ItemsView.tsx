import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import { fetchItems } from "../lib/api";
import { Item, Title, UserContext } from "../types";
import { TAG_COLORS, TAG_COLOR_FALLBACK } from "../lib/constants";
import AddItemDialog from "./AddItemDialog";

interface Props {
  title: Title;
  userCtx: UserContext;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Grouping types
// ---------------------------------------------------------------------------

interface EditionGroup {
  key: string;
  edition: string | null;
  item: Item; // representative item
}

interface VolumeGroup {
  key: string;
  volumeNumber: string | null;
  author: string | null;
  publisher: string | null;
  lowestEdition: string | null;
  count: number;
  editionGroups: EditionGroup[];
  representative: Item;
}

interface LanguageGroup {
  key: string;
  language: string | null;
  count: number;
  volumeGroups: VolumeGroup[];
  coverItem: Item | null;
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

function formatEdition(edition: string | null): string | null {
  if (!edition) return null;
  const n = parseInt(edition, 10);
  if (!isNaN(n)) return `Auflage ${n}`;
  return edition;
}

function lowestEdition(editions: (string | null)[]): string | null {
  const parsed = editions
    .map(e => ({ raw: e, n: e !== null ? parseInt(e, 10) : NaN }))
    .filter(e => !isNaN(e.n))
    .sort((a, b) => a.n - b.n);
  if (parsed.length > 0) return parsed[0].raw;
  // Fall back to first non-null string
  return editions.find(e => e !== null) ?? null;
}

function parseVolumeNumber(v: string | null): number {
  if (v === null) return Infinity;
  const n = parseInt(v, 10);
  return isNaN(n) ? Infinity : n;
}

function buildGroups(items: Item[]): LanguageGroup[] {
  // Sort items by volume number first
  const sorted = [...items].sort((a, b) =>
    parseVolumeNumber(a.volumeNumber) - parseVolumeNumber(b.volumeNumber)
  );

  // Level 1: group by (name, language)
  const langMap = new Map<string, Item[]>();
  for (const item of sorted) {
    const key = `${item.name}::${item.language ?? ""}`;
    if (!langMap.has(key)) langMap.set(key, []);
    langMap.get(key)!.push(item);
  }

  const languageGroups: LanguageGroup[] = [];

  for (const [, langItems] of langMap) {
    // Level 2: group by (name, volume_number, language, author, publisher)
    const volMap = new Map<string, Item[]>();
    for (const item of langItems) {
      const key = [
        item.name,
        item.volumeNumber ?? "",
        item.language ?? "",
        item.author ?? "",
        item.publisher ?? "",
      ].join("::");
      if (!volMap.has(key)) volMap.set(key, []);
      volMap.get(key)!.push(item);
    }

    const volumeGroups: VolumeGroup[] = [];
    for (const [volKey, volItems] of volMap) {
      const rep = volItems[0];
      const editions = volItems.map(i => i.edition);
      const lowest = lowestEdition(editions);

      const editionGroups: EditionGroup[] = volItems.map((item, idx) => ({
        key: `${volKey}::edition::${idx}`,
        edition: item.edition,
        item,
      }));

      volumeGroups.push({
        key: volKey,
        volumeNumber: rep.volumeNumber,
        author: rep.author,
        publisher: rep.publisher,
        lowestEdition: lowest,
        count: volItems.length,
        editionGroups,
        representative: rep,
      });
    }

    // Sort volume groups by volume number
    volumeGroups.sort((a, b) =>
      parseVolumeNumber(a.volumeNumber) - parseVolumeNumber(b.volumeNumber)
    );

    const rep = langItems[0];

    // Cover: item with lowest volume number that has a cover image
    const coverItem =
      [...langItems]
        .sort((a, b) => parseVolumeNumber(a.volumeNumber) - parseVolumeNumber(b.volumeNumber))
        .find(i => i.coverImageUrl) ?? null;

    languageGroups.push({
      key: `${rep.name}::${rep.language ?? ""}`,
      language: rep.language,
      count: langItems.length,
      volumeGroups,
      coverItem,
    });
  }

  return languageGroups;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ItemsView({ title, userCtx, onBack }: Props) {
  const [items, setItems]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);

  const tagColor = TAG_COLORS[title.tag.name] ?? TAG_COLOR_FALLBACK;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchItems(title.id)
      .then(setItems)
      .catch(() => setError("Failed to load items. Is the backend running?"))
      .finally(() => setLoading(false));
  }, [title.id]);

  const languageGroups = useMemo(() => buildGroups(items), [items]);

  return (
    <div className="w-full max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: tagColor }} />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{title.name}</h1>
            <span className="text-xs text-gray-400">{title.tag.name}</span>
          </div>
          {title.isExplicit && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium flex-shrink-0">
              Explicit
            </span>
          )}
        </div>
        {userCtx.role === "admin" && (
          <button
            className="ml-auto flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex-shrink-0"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      {/* Cover + meta */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6 flex gap-4">
        <ItemCover item={languageGroups[0]?.coverItem ?? null} size="lg" />
        <div className="flex flex-col justify-center gap-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{title.name}</p>
          <p className="text-xs text-gray-400">{title.tag.name}</p>
          <p className="text-xs text-gray-400 mt-1">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}

      {/* Language groups */}
      {!loading && !error && (
        <>
          {languageGroups.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No items yet.</div>
          )}
          <Accordion.Root type="multiple" className="space-y-3">
            {languageGroups.map(lg => (
              <LanguageGroupCard
                key={lg.key}
                lg={lg}
                tagColor={tagColor}
                tagName={title.tag.name}
              />
            ))}
          </Accordion.Root>
        </>
      )}
      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); fetchItems(title.id).then(setItems); }}
        tags={[title.tag]}  // only the title's own tag
        lockedTitle={title}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LanguageGroupCard — first level accordion
// ---------------------------------------------------------------------------

function LanguageGroupCard({
  lg,
  tagColor,
  tagName,
}: {
  lg: LanguageGroup;
  tagColor: string;
  tagName: string;
}) {
  return (
    <Accordion.Item
      value={lg.key}
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
    >
      <Accordion.Trigger className="w-full flex items-center text-left group hover:bg-gray-50 transition-colors">
        <div className="w-1 self-stretch flex-shrink-0" style={{ backgroundColor: tagColor }} />
        <ItemCover item={lg.coverItem} size="sm" />
        <div className="flex-1 py-3 px-3 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">
            {lg.volumeGroups[0]?.representative.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {lg.language ?? "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{tagName}</p>
        </div>
        <div className="flex items-center gap-2 pr-3 flex-shrink-0">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            ×{lg.count}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </Accordion.Trigger>

      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {lg.volumeGroups.map(vg => (
            <VolumeGroupRow key={vg.key} vg={vg} tagName={tagName} />
          ))}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

// ---------------------------------------------------------------------------
// VolumeGroupRow — second level, optionally expandable
// ---------------------------------------------------------------------------

function VolumeGroupRow({ vg, tagName }: { vg: VolumeGroup; tagName: string }) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = vg.count > 1;
  const editionLabel = formatEdition(vg.lowestEdition);

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${isExpandable ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}`}
        onClick={() => isExpandable && setExpanded(e => !e)}
      >
        <ItemCover item={vg.representative} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 truncate">{vg.representative.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {vg.volumeNumber && (
              <span className="text-xs text-gray-400">Vol. {vg.volumeNumber}</span>
            )}
            {vg.author && (
              <span className="text-xs text-gray-400">{vg.author}</span>
            )}
            {editionLabel && (
              <span className="text-xs text-gray-400">{editionLabel}</span>
            )}
            {
              !isExpandable && (
                <>
                  <ItemTypeDetail item={vg.representative} tagName={tagName} />
                </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isExpandable && (
            <>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                ×{vg.count}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </>
          )}
        </div>
      </div>

      {/* Expanded edition rows */}
      {isExpandable && expanded && (
        <div className="bg-gray-50 border-t border-gray-100 divide-y divide-gray-100">
          {vg.editionGroups.map(eg => (
            <div key={eg.key} className="flex items-center gap-3 px-6 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {eg.edition && (
                    <span className="text-xs text-gray-500 font-medium">
                      {formatEdition(eg.edition)}
                    </span>
                  )}
                  {eg.item.isbn13 && (
                    <span className="text-xs text-gray-400">ISBN: {eg.item.isbn13}</span>
                  )}
                  {eg.item.ean && (
                    <span className="text-xs text-gray-400">EAN: {eg.item.ean}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemCover
// ---------------------------------------------------------------------------

function ItemCover({ item, size }: { item: Item | null; size: "sm" | "lg" }) {
  const cls = size === "lg"
    ? "w-20 h-28 rounded flex-shrink-0"
    : "w-10 h-14 flex-shrink-0 ml-2";

  if (item?.coverImageUrl) {
    return <img src={item.coverImageUrl} alt={item.name} className={`${cls} object-cover`} />;
  }
  return (
    <div className={`${cls} bg-gray-100 flex items-center justify-center text-xl`}>
      📚
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemTypeDetail
// ---------------------------------------------------------------------------

function ItemTypeDetail({ item, tagName }: { item: Item; tagName: string }) {
  if (tagName === "Anime") {
    return item.ean ? <span className="text-xs text-gray-400">EAN: {item.ean}</span> : null;
  }
  if (tagName === "Sonstiges") {
    return item.isbn13 ? <span className="text-xs text-gray-400">ISBN: {item.isbn13}</span> : null;
  }
  return item.isbn13 ? <span className="text-xs text-gray-400">ISBN: {item.isbn13}</span> : null;
}