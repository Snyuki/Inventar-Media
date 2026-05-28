import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, AlertTriangle } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import {
  fetchTitles,
  createTitle,
  createItem,
  fetchLanguageSuggestions,
} from "../lib/api";
import { Tag, Title, LookupResult } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tags: Tag[];
  // If provided, the title is locked (adding from ItemsView)
  lockedTitle?: Title;
}

// Fields that differ per tag
const BOOK_TAGS = ["Manga", "Light Novel", "Novel", "Art Book"];

function isBookTag(tagName: string) {
  return BOOK_TAGS.includes(tagName);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AddItemDialog({
  open,
  onClose,
  onSuccess,
  tags,
  lockedTitle,
}: Props) {
  // ---- Scanner phase -------------------------------------------------------
  const [scannerOpen, setScannerOpen] = useState(true);
  const [tagMismatchWarning, setTagMismatchWarning] = useState<string | null>(null);

  // ---- Title fields --------------------------------------------------------
  const [titles, setTitles]               = useState<Title[]>([]);
  const [titleQuery, setTitleQuery]       = useState(lockedTitle?.name ?? "");
  const [titleSuggestions, setTitleSuggestions] = useState<Title[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(lockedTitle ?? null);
  const [selectedTagId, setSelectedTagId] = useState<string>(lockedTitle?.tag.id ?? "");

  // ---- Item fields ---------------------------------------------------------
  const [name, setName]               = useState("");
  const [volumeNumber, setVolumeNumber] = useState("");
  const [language, setLanguage]       = useState("");
  const [edition, setEdition]         = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [externalId, setExternalId]   = useState("");
  // Book-specific
  const [isbn10, setIsbn10]           = useState("");
  const [isbn13, setIsbn13]           = useState("");
  const [publisher, setPublisher]     = useState("");
  const [author, setAuthor]           = useState("");
  const [publishDate, setPublishDate] = useState("");
  // Anime-specific
  const [ean, setEan]                 = useState("");

  // ---- Language autocomplete -----------------------------------------------
  const [langSuggestions, setLangSuggestions]   = useState<string[]>([]);
  const [showLangSuggestions, setShowLangSuggestions] = useState(false);

  // ---- Submit state --------------------------------------------------------
  const [loading, setLoading]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // ---- Load titles for autocomplete ----------------------------------------
  useEffect(() => {
    if (!lockedTitle) {
      fetchTitles().then(setTitles).catch(() => {});
    }
  }, [lockedTitle]);

  // ---- Reset on open -------------------------------------------------------
  useEffect(() => {
    if (open) {
      setScannerOpen(true);
      setTagMismatchWarning(null);
      setTitleQuery(lockedTitle?.name ?? "");
      setSelectedTitle(lockedTitle ?? null);
      setSelectedTagId(lockedTitle?.tag.id ?? "");
      setName("");
      setVolumeNumber("");
      setLanguage("");
      setEdition("");
      setCoverImageUrl("");
      setExternalId("");
      setIsbn10("");
      setIsbn13("");
      setPublisher("");
      setAuthor("");
      setPublishDate("");
      setEan("");
      setFormError(null);
    }
  }, [open, lockedTitle]);

  // ---- Title autocomplete --------------------------------------------------
  const handleTitleQueryChange = (q: string) => {
    setTitleQuery(q);
    setSelectedTitle(null); // deselect if user is typing a new name
    if (q.length > 0) {
      const matches = titles.filter(t =>
        t.name.toLowerCase().includes(q.toLowerCase())
      );
      setTitleSuggestions(matches.slice(0, 6));
      setShowTitleSuggestions(true);
    } else {
      setShowTitleSuggestions(false);
    }
  };

  const handleSelectTitle = (title: Title) => {
    setSelectedTitle(title);
    setTitleQuery(title.name);
    setSelectedTagId(title.tag.id);
    setShowTitleSuggestions(false);
  };

  // ---- Language autocomplete -----------------------------------------------
  const handleLanguageChange = async (q: string) => {
    setLanguage(q);
    if (q.length > 0) {
      try {
        const suggestions = await fetchLanguageSuggestions(q);
        setLangSuggestions(suggestions);
        setShowLangSuggestions(suggestions.length > 0);
      } catch {
        setShowLangSuggestions(false);
      }
    } else {
      setShowLangSuggestions(false);
    }
  };

  // ---- Scanner result handler ----------------------------------------------
  const handleScanResult = (result: LookupResult) => {
    setScannerOpen(false);

    // Prefill item fields from lookup result
    if (result.name)            setName(result.name);
    if (result.author)          setAuthor(result.author);
    if (result.publisher)       setPublisher(result.publisher);
    if (result.publish_date)    setPublishDate(result.publish_date);
    if (result.cover_image_url) setCoverImageUrl(result.cover_image_url);
    if (result.isbn_10)         setIsbn10(result.isbn_10);
    if (result.isbn_13)         setIsbn13(result.isbn_13);
    if (result.ean)             setEan(result.ean);

    if (lockedTitle) {
      // Tag is locked — check for mismatch
      const suggestedTag = result.suggested_tag;
      if (suggestedTag && suggestedTag !== lockedTitle.tag.name) {
        setTagMismatchWarning(
          `⚠️ Dieses Item wurde als "${suggestedTag}" erkannt, aber dieser Titel ist als "${lockedTitle.tag.name}" getaggt.`
        );
      }
    } else {
      // Tag is free — preselect suggested tag
      if (result.suggested_tag) {
        const matchingTag = tags.find(t => t.name === result.suggested_tag);
        if (matchingTag) setSelectedTagId(matchingTag.id);
      }
    }
  };

  // ---- Derived state -------------------------------------------------------
  const selectedTag = tags.find(t => t.id === selectedTagId);
  const showBookFields = selectedTag ? isBookTag(selectedTag.name) : false;
  const showAnimeFields = selectedTag?.name === "Anime";
  const showSonstigesFields = selectedTag?.name === "Sonstiges";

  // ---- Submit --------------------------------------------------------------
  const handleSubmit = async () => {
    setFormError(null);

    // Validate
    if (!selectedTagId) {
      setFormError("Bitte einen Tag auswählen.");
      return;
    }
    if (!titleQuery.trim()) {
      setFormError("Bitte einen Titel eingeben.");
      return;
    }
    if (!name.trim()) {
      setFormError("Bitte einen Item-Namen eingeben.");
      return;
    }

    setLoading(true);
    try {
      let titleId: string;

      if (selectedTitle) {
        // Use existing title
        titleId = selectedTitle.id;
      } else {
        // Create new title
        const newTitle = await createTitle({
          name: titleQuery.trim(),
          tag_id: selectedTagId,
          is_explicit: false,
        });
        titleId = newTitle.id;
      }

      await createItem(titleId, {
        name: name.trim(),
        volume_number: volumeNumber.trim() || null,
        language: language.trim() || null,
        edition: edition.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        external_id: externalId.trim() || null,
        isbn_10: isbn10.trim() || null,
        isbn_13: isbn13.trim() || null,
        publisher: publisher.trim() || null,
        author: author.trim() || null,
        publish_date: publishDate.trim() || null,
        ean: ean.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (e: any) {
      setFormError(e.message ?? "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Render --------------------------------------------------------------
  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[92dvh] overflow-y-auto shadow-xl">

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {lockedTitle ? `Add to "${lockedTitle.name}"` : "Add Item"}
            </Dialog.Title>
            <Dialog.Close className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="px-4 py-4 space-y-5">

            {/* Scanner */}
            {scannerOpen && (
              <BarcodeScanner
                onResult={handleScanResult}
                onSkip={() => setScannerOpen(false)}
              />
            )}

            {!scannerOpen && (
              <>
                {/* Tag mismatch warning */}
                {tagMismatchWarning && (
                  <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{tagMismatchWarning}</span>
                  </div>
                )}

                {/* Title section */}
                {lockedTitle ? (
                  <div>
                    <label className="block text-sm text-gray-500 mb-1">Titel</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                      {lockedTitle.name}
                      <span className="ml-2 text-xs text-gray-400">{lockedTitle.tag.name}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Tag selector */}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Tag *</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => setSelectedTagId(tag.id)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border-0 ${
                              selectedTagId === tag.id
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Title autocomplete */}
                    <div className="relative">
                      <label className="block text-sm text-gray-700 mb-1">Titel *</label>
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={titleQuery}
                        onChange={e => handleTitleQueryChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 150)}
                        placeholder="Titel suchen oder neu anlegen..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {showTitleSuggestions && titleSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {titleSuggestions.map(t => (
                            <li
                              key={t.id}
                              onMouseDown={() => handleSelectTitle(t)}
                              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                            >
                              <span>{t.name}</span>
                              <span className="text-xs text-gray-400">{t.tag.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {titleQuery && !selectedTitle && (
                        <p className="text-xs text-blue-600 mt-1">
                          Neuer Titel wird angelegt: „{titleQuery}"
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Item name */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="z.B. One Piece"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Volume number */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Band / Volume</label>
                  <input
                    type="text"
                    value={volumeNumber}
                    onChange={e => setVolumeNumber(e.target.value)}
                    placeholder={showAnimeFields ? "z.B. Box 1" : "z.B. 1"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Language */}
                <div className="relative">
                  <label className="block text-sm text-gray-700 mb-1">Sprache</label>
                  <input
                    type="text"
                    value={language}
                    onChange={e => handleLanguageChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowLangSuggestions(false), 150)}
                    placeholder="z.B. Deutsch"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showLangSuggestions && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                      {langSuggestions.map(lang => (
                        <li
                          key={lang}
                          onMouseDown={() => { setLanguage(lang); setShowLangSuggestions(false); }}
                          className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                        >
                          {lang}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Auflage */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Auflage</label>
                  <input
                    type="text"
                    value={edition}
                    onChange={e => setEdition(e.target.value)}
                    placeholder="z.B. 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Book-specific fields */}
                {showBookFields && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Autor</label>
                      <input
                        type="text"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Verlag</label>
                      <input
                        type="text"
                        value={publisher}
                        onChange={e => setPublisher(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Erscheinungsdatum</label>
                      <input
                        type="text"
                        value={publishDate}
                        onChange={e => setPublishDate(e.target.value)}
                        placeholder="z.B. 2014-10-21"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ISBN-13</label>
                      <input
                        type="text"
                        value={isbn13}
                        onChange={e => setIsbn13(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ISBN-10</label>
                      <input
                        type="text"
                        value={isbn10}
                        onChange={e => setIsbn10(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Anime-specific fields */}
                {showAnimeFields && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">EAN</label>
                    <input
                      type="text"
                      value={ean}
                      onChange={e => setEan(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Sonstiges fields */}
                {showSonstigesFields && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ISBN-13</label>
                      <input
                        type="text"
                        value={isbn13}
                        onChange={e => setIsbn13(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">ISBN-10</label>
                      <input
                        type="text"
                        value={isbn10}
                        onChange={e => setIsbn10(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Cover image URL */}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Cover URL</label>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={e => setCoverImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {coverImageUrl && (
                    <img
                      src={coverImageUrl}
                      alt="Cover preview"
                      className="mt-2 h-24 object-cover rounded"
                      onError={e => (e.currentTarget.style.display = "none")}
                    />
                  )}
                </div>

                {/* Form error */}
                {formError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Wird gespeichert..." : "Speichern"}
                </button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}