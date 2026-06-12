import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, Loader2 } from "lucide-react";
import { deleteItem } from "../lib/api";
import { Item } from "../types";

interface Props {
  item: Item;
  onDeleted: () => void;          // called after successful delete
  onTitleEmpty: () => void;       // called if title has no items left after delete
  remainingItemCount: number;     // total items in the title (including this one)
}

export default function ItemContextMenu({
  item,
  onDeleted,
  onTitleEmpty,
  remainingItemCount,
}: Props) {
  const [menuOpen, setMenuOpen]       = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      await deleteItem(item.id);
      setConfirmOpen(false);
      if (remainingItemCount <= 1) {
        onTitleEmpty();
      } else {
        onDeleted();
      }
    } catch (e: any) {
      setError(e.message ?? "Fehler beim Löschen.");
    } finally {
      setLoading(false);
    }
  };

  const itemLabel = item.volumeNumber
    ? `Vol. ${item.volumeNumber}${item.edition ? `, Auflage ${item.edition}` : ""}`
    : item.name;

  return (
    <>
      <div ref={menuRef} className="relative flex-shrink-0">
        <div
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          onKeyDown={e => e.key === "Enter" && setMenuOpen(v => !v)}
          className="p-1 text-subtle hover:text-primary hover:bg-hover rounded transition-colors cursor-pointer"
          title="Optionen"
        >
          <MoreVertical className="w-3 h-3" />
        </div>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-30 bg-card border border-subtle rounded-lg shadow-lg min-w-[140px] py-1">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-explicit-bg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-explicit-bg rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-primary text-base">
                  Item löschen?
                </h2>
                <p className="text-sm text-muted mt-1">
                  <span className="font-medium text-primary">„{itemLabel}"</span> wird
                  unwiderruflich gelöscht.
                  {remainingItemCount <= 1 && (
                    <span className="block mt-1 text-red-600 font-medium">
                      Dies ist das letzte Item - der Titel wird ebenfalls gelöscht.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-explicit-bg rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 border border-default rounded-xl text-sm font-medium text-secondary hover:bg-surface transition-colors disabled:opacity-50"
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