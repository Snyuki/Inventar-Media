import { useState, useEffect, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { fetchTags, fetchTitles } from "../lib/api";
import { Tag, Title, UserContext } from "../types";
import { TAG_COLORS, TAG_COLOR_FALLBACK } from "../lib/constants";
import ItemsView from "./ItemsView";
import AddItemDialog from "./AddItemDialog";

interface Props {
  userCtx: UserContext;
}

export default function TitlesView({ userCtx }: Props) {
  const [titles, setTitles]       = useState<Title[]>([]);
  const [tags, setTags]           = useState<Tag[]>([]);
  const [search, setSearch]       = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);

  const [addOpen, setAddOpen]   = useState(false);

  // ---- Data loading ---------------------------------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);
    setTitles([]);
    Promise.all([fetchTitles(), fetchTags()])
      .then(([titlesData, tagsData]) => {
        setTitles(titlesData);
        setTags(tagsData);
      })
      .catch(() => setError("Failed to load titles. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  // ---- Filter ---------------------------------------------------------
  const toggleTag = (tagName: string) =>
    setActiveTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return titles.filter(t => {
      const matchSearch = !q || t.name.toLowerCase().includes(q);
      const matchTag    = activeTags.length === 0 || activeTags.includes(t.tag.name);
      return matchSearch && matchTag;
    });
  }, [titles, search, activeTags]);

  // ---- Style helpers --------------------------------------------------
  const tagColor = (tagName: string) =>
    TAG_COLORS[tagName] ?? TAG_COLOR_FALLBACK;

  const chipClass = (tagName: string) => {
    const active = activeTags.includes(tagName);
    return `px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer border-0 ${
      active ? "text-white" : "hover:opacity-80"
    }`;
  };

  const chipStyle = (tagName: string) => {
    const active = activeTags.includes(tagName);
    const color  = tagColor(tagName);
    return active
      ? { backgroundColor: color }
      : { backgroundColor: `${color}22`, color };
  };

  if (selectedTitle) {
    return (
      <ItemsView
        title={selectedTitle}
        userCtx={userCtx}
        onBack={() => setSelectedTitle(null)}
      />
    );
  }

  // ---- Render ---------------------------------------------------------
  return (
    <div className="w-full max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Titles</h1>
        {userCtx.role === "admin" && (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4" /> Add Title
          </button>
        )}
      </div>

      {/* Search + Filter chips */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search titles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              className={chipClass(tag.name)}
              style={chipStyle(tag.name)}
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}

      {/* Title cards */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              {titles.length === 0 ? "No titles yet." : "No titles match your search."}
            </div>
          )}
          {filtered.map(title => (
            <button
              key={title.id}
              className="w-full text-left"
              onClick={() => setSelectedTitle(title)}
            >
              <TitleCard title={title} tagColor={tagColor(title.tag.name)} />
            </button>
          ))}
        </div>
      )}
      <AddItemDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => { setAddOpen(false); /* reload titles */ fetchTitles().then(setTitles); }}
        tags={tags}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TitleCard
// ---------------------------------------------------------------------------

interface TitleCardProps {
  title: Title;
  tagColor: string;
}

function TitleCard({ title, tagColor }: TitleCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex">

      {/* Colored left border indicating tag */}
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: tagColor }} />

      {/* Cover image */}
      {title.coverImageUrl ? (
        <img
          src={title.coverImageUrl}
          alt={title.name}
          className="w-14 h-20 object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-20 bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-xl">
          📚
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-medium text-gray-900 text-sm leading-tight truncate">
              {title.name}
            </h2>
            <span className="text-xs text-gray-400 mt-0.5 block">
              {title.tag.name}
              {title.isExplicit && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
                  Explicit
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}