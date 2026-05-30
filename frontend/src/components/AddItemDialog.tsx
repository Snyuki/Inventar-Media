import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, AlertTriangle, Search } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import {
  fetchTitles,
  createTitle,
  createItem,
  fetchLanguageSuggestions,
  fetchMediaTagSuggestions,
  fetchMediaGenreSuggestions,
  anilistSearch,
  lookupBarcode,
} from "../lib/api";
import { Tag, Title, LookupResult } from "../types";
import { BOOK_TAGS, resolveLanguageCode, stripVolumeSuffix } from "../lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tags: Tag[];
  lockedTitle?: Title;
}

function isBookTag(tagName: string) {
  return BOOK_TAGS.includes(tagName);
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls     = "block text-sm text-gray-700 mb-1";
const labelReqCls  = "block text-sm text-gray-700 mb-1 after:content-['*'] after:ml-0.5 after:text-red-500";

// ---------------------------------------------------------------------------
// TagsGenresInput — comma-separated autocomplete input
// ---------------------------------------------------------------------------
interface TagsGenresInputProps {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  fetchSuggestions: (q: string) => Promise<string[]>;
}

function TagsGenresInput({ label, value, onChange, fetchSuggestions }: TagsGenresInputProps) {
  const [inputVal, setInputVal]         = useState("");
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // The last token being typed (after the last comma)
  const currentToken = inputVal.split(",").pop()?.trim() ?? "";

  useEffect(() => {
    if (currentToken.length > 0) {
      fetchSuggestions(currentToken)
        .then(s => {
          // Filter out already-selected values
          setSuggestions(s.filter(sv => !value.includes(sv)));
          setShowSuggestions(s.length > 0);
        })
        .catch(() => setShowSuggestions(false));
    } else {
      setShowSuggestions(false);
    }
  }, [currentToken]);

  // Sync inputVal with external value
  useEffect(() => {
    setInputVal(value.join(", "));
  }, [value]);

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 150);
    // Commit any typed tokens on blur
    const tokens = inputVal
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    onChange(tokens);
  };

  const handleSelect = (suggestion: string) => {
    const parts = inputVal.split(",").map(t => t.trim()).filter(Boolean);
    // Replace the last partial token with the suggestion
    if (parts.length > 0) {
      parts[parts.length - 1] = suggestion;
    } else {
      parts.push(suggestion);
    }
    // Rebuild from parts to keep order
    const ordered = parts.filter((p, i, arr) => arr.indexOf(p) === i);
    onChange(ordered);
    setInputVal(ordered.join(", ") + ", ");
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onBlur={handleBlur}
        placeholder="z.B. Seinen, Isekai"
        className={inputCls}
      />
      {showSuggestions && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
          {suggestions.map(s => (
            <li
              key={s}
              onMouseDown={() => handleSelect(s)}
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {value.map(v => (
            <span
              key={v}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs flex items-center gap-1"
            >
              {v}
              <button
                type="button"
                onMouseDown={() => onChange(value.filter(t => t !== v))}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
  // ---- Scanner + AniList ---------------------------------------------------
  const [scannerOpen, setScannerOpen]             = useState(true);
  const [tagMismatchWarning, setTagMismatchWarning] = useState<string | null>(null);
  const [anilistNotFound, setAnilistNotFound]     = useState(false);
  const [anilistQuery, setAnilistQuery]           = useState("");
  const [anilistLoading, setAnilistLoading]       = useState(false);
  const [isbnQuery, setIsbnQuery]       = useState("");
  const [isbnLoading, setIsbnLoading]   = useState(false);
  const [showIsbnSearch, setShowIsbnSearch] = useState(false);

  // ---- Title fields --------------------------------------------------------
  const [titles, setTitles]                       = useState<Title[]>([]);
  const [titleQuery, setTitleQuery]               = useState(lockedTitle?.name ?? "");
  const [titleSuggestions, setTitleSuggestions]   = useState<Title[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [selectedTitle, setSelectedTitle]         = useState<Title | null>(lockedTitle ?? null);
  const [selectedTagId, setSelectedTagId]         = useState<string>(lockedTitle?.tag.id ?? "");
  const [isExplicit, setIsExplicit]               = useState<boolean>(lockedTitle?.isExplicit ?? false);

  // ---- Title metadata fields (from API, stored on title) -------------------
  const [titleCoverImageUrl, setTitleCoverImageUrl] = useState("");
  const [volumeCount, setVolumeCount]             = useState<number | null>(null);
  const [chapterCount, setChapterCount]           = useState<number | null>(null);
  const [status, setStatus]                       = useState("");
  const [anilistId, setAnilistId]                 = useState<number | null>(null);
  const [mediaTags, setMediaTags]                 = useState<string[]>([]);
  const [mediaGenres, setMediaGenres]             = useState<string[]>([]);

  // ---- Item fields ---------------------------------------------------------
  const [name, setName]                           = useState("");
  const [nameRomaji, setNameRomaji]               = useState("");
  const [nameEnglish, setNameEnglish]             = useState("");
  const [volumeNumber, setVolumeNumber]           = useState("");
  const [language, setLanguage]                   = useState("");
  const [edition, setEdition]                     = useState("");
  const [coverImageUrl, setCoverImageUrl]         = useState("");
  const [isbn10, setIsbn10]                       = useState("");
  const [isbn13, setIsbn13]                       = useState("");
  const [publisher, setPublisher]                 = useState("");
  const [author, setAuthor]                       = useState("");
  const [publishDate, setPublishDate]             = useState("");
  const [pageCount, setPageCount]                 = useState<number | null>(null);
  const [ean, setEan]                             = useState("");

  // ---- Language autocomplete -----------------------------------------------
  const [langSuggestions, setLangSuggestions]     = useState<string[]>([]);
  const [showLangSuggestions, setShowLangSuggestions] = useState(false);

  // ---- Submit state --------------------------------------------------------
  const [loading, setLoading]                     = useState(false);
  const [formError, setFormError]                 = useState<string | null>(null);

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
      setAnilistNotFound(false);
      setAnilistQuery("");
      setTitleQuery(lockedTitle?.name ?? "");
      setSelectedTitle(lockedTitle ?? null);
      setSelectedTagId(lockedTitle?.tag.id ?? "");
      setIsExplicit(lockedTitle?.isExplicit ?? false);
      setTitleCoverImageUrl("");
      setVolumeCount(null);
      setChapterCount(null);
      setStatus("");
      setAnilistId(null);
      setMediaTags([]);
      setMediaGenres([]);
      setName("");
      setNameRomaji("");
      setNameEnglish("");
      setVolumeNumber("");
      setLanguage("");
      setEdition("");
      setCoverImageUrl("");
      setIsbn10("");
      setIsbn13("");
      setPublisher("");
      setAuthor("");
      setPublishDate("");
      setPageCount(null);
      setEan("");
      setFormError(null);
      setIsbnQuery("");
      setIsbnLoading(false);
      setShowIsbnSearch(false);
    }
  }, [open, lockedTitle]);

  // ---- Prefill from lookup result ------------------------------------------
  const prefillFromLookup = (result: Partial<LookupResult>) => {
    if (result.name) {
      let strippedTitle = stripVolumeSuffix(result.name);
      setName((strippedTitle ? strippedTitle : result.name));
      if (!lockedTitle && result.name) {
        setTitleQuery((strippedTitle ? strippedTitle : result.name));
      }
      // Try to extract volume number from the name
      const volMatch = result.name.match(/(\d+)$/);
      if (volMatch) setVolumeNumber(volMatch[1]);
    }
    if (result.name_romaji)          setNameRomaji(result.name_romaji);
    if (result.name_english)         setNameEnglish(result.name_english);
    if (result.author)               setAuthor(result.author);
    if (result.publisher)            setPublisher(result.publisher);
    if (result.publish_date)         setPublishDate(result.publish_date);
    if (result.cover_image_url)      setCoverImageUrl(result.cover_image_url);
    if (result.isbn_10)              setIsbn10(result.isbn_10);
    if (result.isbn_13)              setIsbn13(result.isbn_13);
    if (result.language)             setLanguage(resolveLanguageCode(result.language));
    if (result.page_count)           setPageCount(result.page_count);
    if (result.ean)                  setEan(result.ean);
    if (result.page_count)           setPageCount(result.page_count);
    if (result.title_cover_image_url) setTitleCoverImageUrl(result.title_cover_image_url);
    if (result.volume_count)         setVolumeCount(result.volume_count);
    if (result.chapter_count)        setChapterCount(result.chapter_count);
    if (result.status)               setStatus(result.status);
    if (result.anilist_id)           setAnilistId(result.anilist_id);
    if (result.tags?.length)         setMediaTags(result.tags);
    if (result.genres?.length)       setMediaGenres(result.genres);
    if (result.is_adult)             setIsExplicit(true);
  };

  // ---- Title autocomplete --------------------------------------------------
  const handleTitleQueryChange = (q: string) => {
    setTitleQuery(q);
    setSelectedTitle(null);
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
    setIsExplicit(title.isExplicit);
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
    prefillFromLookup(result);

  if (result.sources_used.length === 1 && result.sources_used[0] === "none") {
    setShowIsbnSearch(true);
  }

    // Resolve language code
    if (result.cover_image_url === undefined && (result as any).language) {
      setLanguage(resolveLanguageCode((result as any).language));
    }

    if (!result.anilist_found) {
      setAnilistNotFound(true);
      setAnilistQuery(result.name ?? "");
    }

    if (lockedTitle) {
      if (result.suggested_tag && result.suggested_tag !== lockedTitle.tag.name) {
        setTagMismatchWarning(
          `⚠️ Dieses Item wurde als "${result.suggested_tag}" erkannt, aber dieser Titel ist als "${lockedTitle.tag.name}" getaggt.`
        );
      }
    } else {
      if (result.suggested_tag) {
        const matchingTag = tags.find(t => t.name === result.suggested_tag);
        if (matchingTag) setSelectedTagId(matchingTag.id);
      }
    }
  };

  // ---- Manual AniList search -----------------------------------------------
  const handleAnilistSearch = async () => {
    if (!anilistQuery.trim()) return;
    setAnilistLoading(true);
    try {
      const selectedTag = tags.find(t => t.id === selectedTagId);
      const mediaType = selectedTag?.name === "Anime" ? "ANIME" : "MANGA";
      const result = await anilistSearch(anilistQuery.trim(), mediaType);
      if (result.found) {
        prefillFromLookup(result as Partial<LookupResult>);
        setAnilistNotFound(false);
      } else {
        setFormError("Kein AniList-Eintrag gefunden für: " + anilistQuery);
      }
    } catch {
      setFormError("AniList-Suche fehlgeschlagen.");
    } finally {
      setAnilistLoading(false);
    }
  };

  // ---- Manual ISBN search --------------------------------------------------
  const handleIsbnSearch = async () => {
    if (!isbnQuery.trim()) return;
    setIsbnLoading(true);
    setFormError(null);
    try {
      const result = await lookupBarcode(isbnQuery.trim());
      prefillFromLookup(result);
      if (result.sources_used.length === 1 && result.sources_used[0] === "none") {
        setFormError("Keine Ergebnisse für ISBN: " + isbnQuery);
      } else {
        setShowIsbnSearch(false);
        if (!result.anilist_found) {
          setAnilistNotFound(true);
          setAnilistQuery(result.name ?? "");
        }
      }
    } catch {
      setFormError("ISBN-Suche fehlgeschlagen.");
    } finally {
      setIsbnLoading(false);
    }
  };

  // ---- Derived state -------------------------------------------------------
  const selectedTag      = tags.find(t => t.id === selectedTagId);
  const showBookFields   = selectedTag ? isBookTag(selectedTag.name) : false;
  const showAnimeFields  = selectedTag?.name === "Anime";
  const showSonstigesFields = selectedTag?.name === "Sonstiges";
  const isJapanese       = language.toLowerCase() === "japanisch" || language.toLowerCase() === "ja";
  const isEnglish        = language.toLowerCase() === "englisch" || language.toLowerCase() === "en";
  const titleIsLocked    = !!lockedTitle;

  // ---- Submit --------------------------------------------------------------
  const handleSubmit = async () => {
    setFormError(null);

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
        titleId = selectedTitle.id;
      } else {
        const newTitle = await createTitle({
          name: titleQuery.trim(),
          tag_id: selectedTagId,
          is_explicit: isExplicit,
          volume_count: volumeCount,
          chapter_count: chapterCount,
          status: status || null,
          anilist_id: anilistId,
          title_cover_image_url: titleCoverImageUrl || null,
          tags: mediaTags,
          genres: mediaGenres,
        });
        titleId = newTitle.id;
      }

      await createItem(titleId, {
        name: name.trim(),
        name_romaji: (isJapanese && nameRomaji.trim()) ? nameRomaji.trim() : null,
        name_english: (!isEnglish && nameEnglish.trim()) ? nameEnglish.trim() : null,
        volume_number: volumeNumber.trim() || null,
        language: language.trim() || null,
        edition: edition.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        external_ids: [],
        isbn_10: isbn10.trim() || null,
        isbn_13: isbn13.trim() || null,
        publisher: publisher.trim() || null,
        author: author.trim() || null,
        publish_date: publishDate.trim() || null,
        page_count: pageCount,
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
        <div className="fixed inset-0 z-50 flex items-start justify-center px-2 sm:px-4 pt-[3.75rem] pb-2">
          <Dialog.Content className="bg-white rounded-2xl max-h-[92dvh] overflow-y-auto shadow-xl w-full max-w-[50rem]" aria-describedby={undefined}>

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
                  onSkip={() => { setScannerOpen(false); setShowIsbnSearch(true); }}
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

                  {/* AniList manual search — only when automatic lookup returned no AniList result */}
                  {anilistNotFound && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-blue-700 font-medium">
                        Kein AniList-Eintrag automatisch gefunden. Manuell suchen:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={anilistQuery}
                          onChange={e => setAnilistQuery(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleAnilistSearch()}
                          placeholder="Serienname..."
                          className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleAnilistSearch}
                          disabled={anilistLoading}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {anilistLoading
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Search className="w-3 h-3" />
                          }
                          Suchen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual ISBN search */}
                  {showIsbnSearch && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-gray-600 font-medium">
                        ISBN manuell eingeben:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={isbnQuery}
                          onChange={e => setIsbnQuery(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleIsbnSearch()}
                          placeholder="ISBN-10 oder ISBN-13..."
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleIsbnSearch}
                          disabled={isbnLoading}
                          className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
                        >
                          {isbnLoading
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Search className="w-3 h-3" />
                          }
                          Suchen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── TITLE SECTION ── */}
                  {titleIsLocked ? (
                    <div>
                      <label className={labelReqCls}>Titel</label>
                      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 flex items-center justify-between">
                        <span>{lockedTitle!.name}</span>
                        <span className="text-xs text-gray-400">{lockedTitle!.tag.name}</span>
                      </div>
                      {/* is_explicit — read-only when locked */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="is_explicit_locked"
                          checked={isExplicit}
                          disabled
                          className="w-4 h-4 opacity-50"
                        />
                        <label htmlFor="is_explicit_locked" className="text-sm text-gray-400">
                          Explicit (vom Titel übernommen)
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Tag selector */}
                      <div>
                        <label className={labelReqCls}>Tag</label>
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
                        <label className={labelReqCls}>Titel</label>
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={titleQuery}
                          onChange={e => handleTitleQueryChange(e.target.value)}
                          onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 150)}
                          placeholder="Titel suchen oder neu anlegen..."
                          className={inputCls}
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

                      {/* is_explicit — editable only when title is not locked */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_explicit"
                          checked={isExplicit}
                          onChange={e => setIsExplicit(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="is_explicit" className="text-sm text-gray-700">
                          Explicit
                        </label>
                      </div>
                    </>
                  )}

                  {/* ── ITEM SECTION ── */}

                  {/* Item name (native) */}
                  <div>
                    <label className={labelReqCls}>Item Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="z.B. ノーゲーム・ノーライフ"
                      className={inputCls}
                    />
                  </div>

                  {/* Romaji — only shown when language is Japanese */}
                  {isJapanese && (
                    <div>
                      <label className={labelCls}>Romaji Name</label>
                      <input
                        type="text"
                        value={nameRomaji}
                        onChange={e => setNameRomaji(e.target.value)}
                        placeholder="z.B. No Game No Life"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* English name — only shown when language is not English */}
                  {!isEnglish && (
                    <div>
                      <label className={labelCls}>Englischer Name</label>
                      <input
                        type="text"
                        value={nameEnglish}
                        onChange={e => setNameEnglish(e.target.value)}
                        placeholder="z.B. No Game, No Life"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Volume number */}
                  <div>
                    <label className={labelCls}>Band / Volume</label>
                    <input
                      type="text"
                      value={volumeNumber}
                      onChange={e => setVolumeNumber(e.target.value)}
                      placeholder={showAnimeFields ? "z.B. Box 1" : "z.B. 1"}
                      className={inputCls}
                    />
                  </div>

                  {/* Language */}
                  <div className="relative">
                    <label className={labelCls}>Sprache</label>
                    <input
                      type="text"
                      value={language}
                      onChange={e => handleLanguageChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowLangSuggestions(false), 150)}
                      placeholder="z.B. Deutsch"
                      className={inputCls}
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
                    <label className={labelCls}>Auflage</label>
                    <input
                      type="text"
                      value={edition}
                      onChange={e => setEdition(e.target.value)}
                      placeholder="z.B. 2"
                      className={inputCls}
                    />
                  </div>

                  {/* Book-specific fields */}
                  {showBookFields && (
                    <>
                      <div>
                        <label className={labelCls}>Autor</label>
                        <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Verlag</label>
                        <input type="text" value={publisher} onChange={e => setPublisher(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Erscheinungsdatum</label>
                        <input type="text" value={publishDate} onChange={e => setPublishDate(e.target.value)} placeholder="z.B. 2014-10-21" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Seitenanzahl</label>
                        <input
                          type="number"
                          value={pageCount ?? ""}
                          onChange={e => setPageCount(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="z.B. 192"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>ISBN-13</label>
                        <input type="text" value={isbn13} onChange={e => setIsbn13(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>ISBN-10</label>
                        <input type="text" value={isbn10} onChange={e => setIsbn10(e.target.value)} className={inputCls} />
                      </div>
                    </>
                  )}

                  {/* Anime-specific fields */}
                  {showAnimeFields && (
                    <div>
                      <label className={labelCls}>EAN</label>
                      <input type="text" value={ean} onChange={e => setEan(e.target.value)} className={inputCls} />
                    </div>
                  )}

                  {/* Sonstiges fields */}
                  {showSonstigesFields && (
                    <>
                      <div>
                        <label className={labelCls}>ISBN-13</label>
                        <input type="text" value={isbn13} onChange={e => setIsbn13(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>ISBN-10</label>
                        <input type="text" value={isbn10} onChange={e => setIsbn10(e.target.value)} className={inputCls} />
                      </div>
                    </>
                  )}

                  {/* Cover image URL */}
                  <div>
                    <label className={labelCls}>Volume Cover URL</label>
                    <input
                      type="text"
                      value={coverImageUrl}
                      onChange={e => setCoverImageUrl(e.target.value)}
                      placeholder="https://..."
                      className={inputCls}
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

                  {/* Tags + Genres (only for non-locked titles) */}
                  {!titleIsLocked && (
                    <>
                      <TagsGenresInput
                        label="Tags"
                        value={mediaTags}
                        onChange={setMediaTags}
                        fetchSuggestions={fetchMediaTagSuggestions}
                      />
                      <TagsGenresInput
                        label="Genres"
                        value={mediaGenres}
                        onChange={setMediaGenres}
                        fetchSuggestions={fetchMediaGenreSuggestions}
                      />
                    </>
                  )}

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
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}