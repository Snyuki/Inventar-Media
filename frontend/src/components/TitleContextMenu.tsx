import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, Loader2 } from "lucide-react";
import { deleteTitle } from "../lib/api";
import { Title } from "../types";

interface Props {
  title: Title;
  itemCount?: number;        // pass when known (ItemsView knows, TitlesView doesn't)
  onDeleted: () => void;     // called after successful delete
}

export default function TitleContextMenu({ title, itemCount, onDeleted }: Props) {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setError(null);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteTitle(title.id);
      setConfirmOpen(false);
      onDeleted();
    } catch (e: any) {
      setError(e.message ?? "Fehler beim Löschen.");
    } finally {
      setLoading(false);
    }
  };

  const itemLabel = itemCount === undefined
    ? "allen zugehörigen Items"
    : itemCount === 0
      ? "keine Items (der Titel ist leer)"
      : itemCount === 1
        ? "1 Item"
        : `${itemCount} Items`;

  return (
    <>
      {/* Three-dot button + dropdown */}
      <div ref={menuRef} className="relative flex-shrink-0" data-context-menu>
        <div
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          onKeyDown={e => e.key === "Enter" && setMenuOpen(v => !v)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          title="Optionen"
        >
          <MoreVertical className="w-4 h-4" />
        </div>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px] py-1">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          data-context-menu
          onClick={e => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-base">
                  Titel löschen?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-800">„{title.name}"</span> wird
                  unwiderruflich gelöscht — zusammen mit {itemLabel}.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Wird gelöscht..." : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}