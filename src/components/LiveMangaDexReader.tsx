import { useState, useEffect, useId, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import { MangaItem, ChapterItem, ChapterPagesData } from '../types';
import { searchManga, getMangaChapters, getChapterPages, mangaHasEnglishChapters, getMangaSuggestions, getGenreTags } from '../services/mangadex';
import type { MangaTag } from '../services/mangadex';
import { searchMangaPill, getMangaPillInfo, getMangaPillChapterPages, resolveMangaPillByTitle } from '../services/consumet';
import type { MangaOrigin } from '../services/mangadex';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { 
  Search, 
  BookOpen, 
  Bookmark, 
  BookmarkCheck, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  RefreshCw, 
  Sliders, 
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  History,
  Languages,
  Clock,
  ExternalLink
} from 'lucide-react';

// Reading-progress entries persisted so the home screen can offer "Continue Reading".
interface ReadingHistoryEntry {
  mangaId: string;
  mangaTitle: string;
  mangaCoverUrl: string;
  chapterId: string;
  chapterNumber: string;
  pageIndex: number;
  totalPages: number;
  updatedAt: number;
  source?: 'mangadex' | 'mangapill';
}

const HISTORY_KEY = 'mangadex_reading_history';

function loadHistory(): ReadingHistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  'en-gb': 'English (UK)',
  'pt-br': 'Português (Brasil)',
  'pt': 'Português',
  'es-la': 'Español (LatAm)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  id: 'Bahasa Indonesia',
  ja: '日本語',
  'ja-ro': 'Japanese (Romanized)',
  ko: '한국어',
  'ko-ro': 'Korean (Romanized)',
  ru: 'Русский',
  'zh': '中文',
  'zh-hk': '中文 (香港)',
  'th': 'ไทย',
  vi: 'Tiếng Việt',
  ar: 'العربية',
  tr: 'Türkçe',
  pl: 'Polski',
  nl: 'Nederlands',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  tl: 'Filipino',
  mn: 'Монгол',
  fa: 'فارسی',
  ne: 'नेपाली',
  uk: 'Українська',
  sr: 'Srpski',
  he: 'עברית',
  sv: 'Svenska',
  fil: 'Filipino',
};

function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] || code;
}

// MangaDex chapter pages are served from uploads.mangadex.org. If an ad blocker
// or privacy browser strips the Referer and a specific image still fails, the
// onerror handler logs a diagnostic fetch so the status is visible in the
// console.
const logPageImageError = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const url = img.src;
  console.error('[Reader] Failed to load page image:', url, e);

  // The <img> onerror event does not expose the HTTP status, so run a
  // diagnostic fetch to surface it in the console.
  fetch(url, { referrerPolicy: 'no-referrer-when-downgrade', mode: 'cors' })
    .then((res) => {
      console.error(
        '[Reader] Page image diagnostic fetch (status):',
        res.status,
        res.statusText,
        url
      );
    })
    .catch((err) => {
      console.error('[Reader] Page image diagnostic fetch failed:', url, err);
    });
};

export function LiveMangaDexReader({ defaultOrigin = 'all' }: { defaultOrigin?: MangaOrigin }) {
  const searchInputId = useId();
  const [query, setQuery] = useState('');
  const [mangaList, setMangaList] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [translatedSearch, setTranslatedSearch] = useState<boolean>(true);
  const [originFilter, setOriginFilter] = useState<MangaOrigin>(defaultOrigin);
  const [searchSource, setSearchSource] = useState<'mangadex' | 'mangapill'>('mangadex');
  const [chapterSource, setChapterSource] = useState<'mangadex' | 'mangapill'>('mangadex');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const verifyTokenRef = useRef(0);
  const [genreTags, setGenreTags] = useState<MangaTag[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedManga, setSelectedManga] = useState<MangaItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [chapterLang, setChapterLang] = useState<string>('all');
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chaptersError, setChaptersError] = useState('');
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);
  const [chapterPages, setChapterPages] = useState<ChapterPagesData | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pagesError, setPagesError] = useState('');

  // Reader Settings
  const [readerMode, setReaderMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [dataSaver, setDataSaver] = useState<boolean>(false);

  // Local Favorites
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mangadex_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Continue Reading history
  const [history, setHistory] = useState<ReadingHistoryEntry[]>(loadHistory);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const resumePageTargetRef = useRef<number | null>(null);
  const lastSavedPageRef = useRef<number>(-1);

  // Load the Suggestions feed when the app opens (most-followed series).
  useEffect(() => {
    (async () => {
      try {
        const suggestions = await getMangaSuggestions(18, 0, defaultOrigin, selectedGenres);
        setMangaList(suggestions);
      } catch (err) {
        console.error('[Reader] Failed to load suggestions:', err);
        setSearchError('Could not load suggestions. Check your connection and try again.');
      }
    })();
  }, [defaultOrigin]);

  // Load genre tags once.
  useEffect(() => {
    getGenreTags().then(setGenreTags).catch(() => {});
  }, []);

  // Re-run the current view when the translated-search toggle, origin filter,
  // source toggle, or genre filter changes.
  useEffect(() => {
    void handleSearch(query, translatedSearch, originFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translatedSearch, originFilter, searchSource, selectedGenres]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('mangadex_favorites', JSON.stringify(next));
      return next;
    });
  };

  const verifyChapterAvailability = (list: MangaItem[]) => {
    const token = ++verifyTokenRef.current;
    (async () => {
      const map: Record<string, boolean> = {};
      for (const m of list) {
        if (token !== verifyTokenRef.current) return;
        try {
          const has = await mangaHasEnglishChapters(m.id);
          map[m.id] = has;
          setAvailability((prev) => ({ ...prev, ...map }));
        } catch {
          // skip on failure; manga stays unlabeled
        }
      }
    })();
  };

  const handleSearch = async (
    searchTerm: string = query,
    translated: boolean = translatedSearch,
    origin: MangaOrigin = originFilter,
    loadMore: boolean = false
  ) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasMore(false);
    }
    setSearchError('');
    const pageSize = 18;
    const currentList = mangaList;
    const tagIds = selectedGenres;
    try {
      if (searchSource === 'mangapill') {
        if (!searchTerm.trim()) {
          setMangaList([]);
          setHasMore(false);
          return;
        }
        const results = await searchMangaPill(searchTerm);
        if (loadMore) {
          setMangaList([...currentList, ...results]);
        } else {
          setMangaList(results);
          setAvailability({});
        }
        setHasMore(false);
        return;
      }
      const nextOffset = loadMore ? currentList.length : 0;
      const results = searchTerm.trim()
        ? await searchManga(searchTerm, pageSize, translated, nextOffset, origin, tagIds)
        : await getMangaSuggestions(pageSize, nextOffset, origin, tagIds);
      if (loadMore) {
        setMangaList([...currentList, ...results]);
        verifyChapterAvailability(results);
      } else {
        setMangaList(results);
        setAvailability({});
        verifyChapterAvailability(results);
      }
      setHasMore(results.length === pageSize);
    } catch (err) {
      console.error(err);
      if (!loadMore) {
        setSearchError(
          searchSource === 'mangapill'
            ? 'Could not reach MangaPill. The free mirror may be sleeping — retry in a moment.'
            : 'Could not reach MangaDex. Check your connection and try again.'
        );
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSelectManga = async (manga: MangaItem) => {
    setSelectedManga(manga);
    setActiveChapter(null);
    setChapterPages(null);
    setLoadingChapters(true);
    setChaptersError('');
    setChapterSource(manga.source === 'mangapill' ? 'mangapill' : 'mangadex');
    try {
      if (manga.source === 'mangapill') {
        const chaps = await getMangaPillInfo(manga.id);
        setChapters(chaps);
        setAvailableLanguages(['en']);
        setChapterLang('en');
        return;
      }
      const res = await getMangaChapters(manga.id);
      setChapters(res.chapters);
      setAvailableLanguages(res.languages);
      const readableLangs = [...new Set(res.chapters.filter((c) => !c.externalUrl).map((c) => c.language))];
      setChapterLang(readableLangs.includes('en') ? 'en' : 'all');
      // Licensed series are usually absent from MangaDex's readable feed. If
      // nothing here is readable in-app, fall back to MangaPill so the series
      // still opens in the reader.
      if (res.chapters.length > 0 && readableLangs.length === 0) {
        const mp = await resolveMangaPillByTitle(manga.title);
        if (mp) {
          const chaps = await getMangaPillInfo(mp.id);
          setSelectedManga(mp);
          setChapters(chaps);
          setAvailableLanguages(['en']);
          setChapterLang('en');
          setChapterSource('mangapill');
        }
      }
    } catch (err) {
      console.error(err);
      setChaptersError('Failed to load chapters. Please try again.');
    } finally {
      setLoadingChapters(false);
    }
  };

  const saveProgress = (manga: MangaItem | null, chapter: ChapterItem | null, page: number, total: number) => {
    if (!manga || !chapter) return;
    const entry: ReadingHistoryEntry = {
      mangaId: manga.id,
      mangaTitle: manga.title,
      mangaCoverUrl: manga.coverUrl,
      chapterId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      pageIndex: page,
      totalPages: total,
      updatedAt: Date.now(),
      source: manga.source ?? chapter.source ?? undefined,
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((e) => e.mangaId !== manga.id)].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  const openExternalChapter = async (chapter: ChapterItem) => {
    const url = chapter.externalUrl || '';
    if (!url) return;
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const openChapter = async (manga: MangaItem | null, chapter: ChapterItem, startPage = 0) => {
    setActiveChapter(chapter);
    setCurrentPageIndex(startPage);
    resumePageTargetRef.current = startPage > 0 ? startPage : null;
    setLoadingPages(true);
    setPagesError('');
    try {
      const pages = chapter.source === 'mangapill'
        ? await getMangaPillChapterPages(chapter.id)
        : await getChapterPages(chapter.id);
      setChapterPages(pages);
      saveProgress(manga, chapter, startPage, pages.pages.length);
    } catch (err) {
      console.error(err);
      setPagesError('Could not load this chapter. It may be unavailable or you may be offline.');
    } finally {
      setLoadingPages(false);
    }
  };

  const handleOpenChapter = async (chapter: ChapterItem) => {
    if (chapter.externalUrl) {
      await openExternalChapter(chapter);
    } else {
      await openChapter(selectedManga, chapter);
    }
  };

  const handleResume = async (entry: ReadingHistoryEntry) => {
    const manga: MangaItem = {
      id: entry.mangaId,
      title: entry.mangaTitle,
      translatedTitle: undefined,
      description: '',
      coverUrl: entry.mangaCoverUrl,
      status: 'ongoing',
      tags: [],
      source: entry.source ?? 'mangadex',
    };
    setSelectedManga(manga);
    setActiveChapter(null);
    setChapterPages(null);
    setLoadingChapters(true);
    setChaptersError('');
    setChapterSource(manga.source === 'mangapill' ? 'mangapill' : 'mangadex');
    try {
      let chaps: ChapterItem[] = [];
      if (manga.source === 'mangapill') {
        chaps = await getMangaPillInfo(entry.mangaId);
        setAvailableLanguages(['en']);
        setChapterLang('en');
      } else {
        const res = await getMangaChapters(entry.mangaId);
        chaps = res.chapters;
        setAvailableLanguages(res.languages);
        setChapterLang('all');
      }
      setChapters(chaps);
      const chapter = chaps.find((c) => c.id === entry.chapterId) || chaps[chaps.length - 1];
      if (chapter) {
        if (chapter.externalUrl) {
          await openExternalChapter(chapter);
        } else {
          await openChapter(manga, chapter, entry.pageIndex);
        }
      } else {
        setActiveChapter(null);
        setSelectedManga(null);
      }
    } catch (err) {
      console.error(err);
      setChaptersError('Failed to load chapters. Please try again.');
    } finally {
      setLoadingChapters(false);
    }
  };

  const goToPage = (delta: number) => {
    const total = (chapterPages?.pages.length || 1) - 1;
    const next = Math.max(0, Math.min(total, currentPageIndex + delta));
    setCurrentPageIndex(next);
    if (activeChapter && selectedManga && chapterPages) {
      saveProgress(selectedManga, activeChapter, next, chapterPages.pages.length);
    }
  };

  // Track the page the reader is on in vertical (scroll) mode and persist progress.
  const handleReaderScroll = () => {
    if (readerMode !== 'vertical') return;
    const container = readerScrollRef.current;
    if (!container || !chapterPages || !activeChapter || !selectedManga) return;
    const pages = container.querySelectorAll<HTMLElement>('[data-page-index]');
    const containerTop = container.getBoundingClientRect().top;
    let current = 0;
    pages.forEach((el) => {
      if (el.getBoundingClientRect().top - containerTop < container.clientHeight * 0.4) {
        current = Number(el.dataset.pageIndex) || 0;
      }
    });
    if (current !== currentPageIndex) setCurrentPageIndex(current);
    if (current !== lastSavedPageRef.current) {
      lastSavedPageRef.current = current;
      saveProgress(selectedManga, activeChapter, current, chapterPages.pages.length);
    }
  };

  // After a chapter's pages load, jump to the page we resumed at (vertical mode).
  useEffect(() => {
    if (!activeChapter || !chapterPages || resumePageTargetRef.current === null) return;
    const target = resumePageTargetRef.current;
    resumePageTargetRef.current = null;
    const container = readerScrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-page-index="${target}"]`);
    if (el && container) {
      container.scrollTop = Math.max(
        0,
        el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8
      );
    }
  }, [activeChapter, chapterPages]);

  // Render Reader View
  if (activeChapter && chapterPages) {
    const rawPages = (dataSaver && chapterPages.dataSaverPages.length > 0)
      ? chapterPages.dataSaverPages 
      : chapterPages.pages;

    return (
      <div id="manga-reader-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        {/* Top Control Bar - Editorial */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0d0d0d] border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveChapter(null)}
              className="px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Manga
            </button>
            <span className="font-serif italic text-sm text-white truncate max-w-[140px] sm:max-w-md">
              {selectedManga?.title} • Ch. {activeChapter.chapterNumber}
            </span>
          </div>

          {/* Reader Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xs p-0.5 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setReaderMode('vertical')}
                className={`px-2.5 py-1 rounded-xs transition-colors ${readerMode === 'vertical' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'}`}
              >
                Vertical
              </button>
              <button
                onClick={() => setReaderMode('horizontal')}
                className={`px-2.5 py-1 rounded-xs transition-colors ${readerMode === 'horizontal' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'}`}
              >
                Paged
              </button>
            </div>

            {/* Data Saver Toggle */}
            <button
              onClick={() => setDataSaver(!dataSaver)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors ${dataSaver ? 'bg-red-600/20 border-red-500 text-red-400' : 'border-white/10 text-[#a0a0a0] hover:text-white'}`}
            >
              Data Saver: {dataSaver ? 'ON' : 'OFF'}
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-xs text-[10px]">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                className="p-0.5 text-[#a0a0a0] hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-mono text-[10px] text-white">{zoomLevel}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(180, prev + 15))}
                className="p-0.5 text-[#a0a0a0] hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Reader Canvas Area */}
        <div
          ref={readerScrollRef}
          onScroll={handleReaderScroll}
          className="flex-1 overflow-auto bg-[#050505] flex justify-center p-4 sm:p-6"
        >
          {loadingPages ? (
            <div className="flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
              <RefreshCw className="w-7 h-7 animate-spin text-red-500" />
              <span className="text-xs uppercase tracking-widest font-mono">Fetching chapter pages...</span>
            </div>
          ) : pagesError ? (
            <div className="flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
              <AlertTriangle className="w-7 h-7 text-red-500" />
              <span className="text-xs uppercase tracking-widest max-w-sm text-center">{pagesError}</span>
              <button
                onClick={() => handleOpenChapter(activeChapter!)}
                className="mt-2 px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
              >
                Retry
              </button>
            </div>
          ) : rawPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-[#a0a0a0]">
              <span className="text-xs uppercase tracking-widest">No page images found for this chapter.</span>
            </div>
          ) : readerMode === 'vertical' ? (
            /* Continuous Vertical Webtoon */
            <div 
              className="flex flex-col items-center gap-3 max-w-2xl w-full transition-all duration-150"
              style={{ width: `${zoomLevel}%` }}
            >
              {rawPages.map((url, idx) => (
                <div key={idx} data-page-index={idx} className="relative w-full shadow-2xl border border-white/5">
                  <img
                    src={url}
                    alt={`Page ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-auto object-contain"
                    referrerPolicy="no-referrer-when-downgrade"
                    onError={logPageImageError}
                  />
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 text-[9px] font-mono font-bold bg-black/80 text-white rounded-xs border border-white/10 backdrop-blur">
                    {idx + 1} / {rawPages.length}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* Horizontal Single Page Mode */
            <div className="flex flex-col items-center justify-center max-w-3xl w-full h-full relative">
              <div 
                className="relative max-h-[80vh] flex items-center justify-center"
                style={{ width: `${zoomLevel}%` }}
              >
                <img
                  src={rawPages[currentPageIndex]}
                  alt={`Page ${currentPageIndex + 1}`}
                  className="max-h-[75vh] w-auto object-contain border border-white/10 shadow-2xl"
                  referrerPolicy="no-referrer-when-downgrade"
                  onError={logPageImageError}
                />
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-4 mt-5 bg-[#0d0d0d] px-5 py-2 rounded-xs border border-white/20">
                <button
                  onClick={() => goToPage(-1)}
                  disabled={currentPageIndex === 0}
                  className="p-1.5 rounded-xs hover:bg-white/10 text-white disabled:opacity-20 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-mono tracking-widest text-white">
                  PAGE {currentPageIndex + 1} / {rawPages.length}
                </span>
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPageIndex === rawPages.length - 1}
                  className="p-1.5 rounded-xs hover:bg-white/10 text-white disabled:opacity-20 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Manga Details View - Editorial Masterpiece matching Design HTML
  if (selectedManga) {
    const isFav = favorites.includes(selectedManga.id);
    const filteredChapters = chapterLang === 'all'
      ? chapters
      : chapters.filter((c) => c.language === chapterLang);
    const firstChapter = filteredChapters.length > 0 ? filteredChapters[0] : null;

    return (
      <div id="manga-detail-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
        {/* Header Back & Action Bar */}
        <header className="h-14 flex items-center justify-between px-6 sm:px-8 border-b border-white/5 bg-[#0a0a0a]">
          <button
            onClick={() => setSelectedManga(null)}
            className="flex items-center gap-3 text-white/80 hover:text-white transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-bold tracking-widest uppercase opacity-70 group-hover:opacity-100">
              Manga Details
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleFavorite(selectedManga.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors ${
                isFav 
                  ? 'bg-red-600/20 border-red-500 text-red-400' 
                  : 'border-white/20 text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              {isFav ? <BookmarkCheck className="w-3.5 h-3.5 text-red-500" /> : <Bookmark className="w-3.5 h-3.5" />}
              {isFav ? 'Bookmarked' : 'Add to Library'}
            </button>
          </div>
        </header>

        {/* Main Content Split (Left Aside Cover + Right Detail/Chapters) */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column / Aside */}
          <aside className="w-full md:w-[380px] p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 bg-[#0d0d0d]/40 overflow-y-auto">
            <div>
              {/* Cover Card with Gradient & Title overlay */}
              <div className="relative w-full aspect-[2/3] max-w-[280px] mx-auto md:max-w-none rounded-xs overflow-hidden shadow-2xl border border-white/10 bg-[#1a1a1a]">
                {selectedManga.coverUrl ? (
                  <img
                    src={selectedManga.coverUrl}
                    alt={selectedManga.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#808080] text-xs">
                    No Cover Available
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                
                <div className="absolute bottom-5 left-5 right-5">
                  <div className="flex gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-red-600 text-[10px] font-bold uppercase tracking-tighter text-white rounded-xs">
                      Hot
                    </span>
                    <span className="px-2 py-0.5 bg-white/10 text-[10px] font-bold uppercase tracking-tighter text-white rounded-xs backdrop-blur">
                      {selectedManga.status || 'Ongoing'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif italic text-white leading-tight line-clamp-2">
                    {selectedManga.title}
                  </h2>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-3">
                {firstChapter && (
                  <button
                    onClick={() => handleOpenChapter(firstChapter)}
                    className="w-full py-3.5 bg-white text-black font-bold uppercase text-xs tracking-[0.2em] hover:bg-red-500 hover:text-white transition-colors rounded-xs shadow-lg"
                  >
                    Read Chapter {firstChapter.chapterNumber || '1'}
                  </button>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => toggleFavorite(selectedManga.id)}
                    className="flex-1 py-2.5 border border-white/20 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 text-white transition-colors rounded-xs text-center"
                  >
                    {isFav ? 'In Library' : 'Add to Library'}
                  </button>
                  <button
                    onClick={() => {
                      if (filteredChapters.length > 0) handleOpenChapter(filteredChapters[filteredChapters.length - 1]);
                    }}
                    className="flex-1 py-2.5 border border-white/20 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 text-white transition-colors rounded-xs text-center"
                  >
                    Latest Ch.
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Metadata Footer */}
            <div className="pt-6 mt-6 border-t border-white/10 text-[11px] text-[#a0a0a0] space-y-1">
              {selectedManga.author && (
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest opacity-60">Author</span>
                  <span className="text-white font-medium">{selectedManga.author}</span>
                </div>
              )}
              {selectedManga.year && (
                <div className="flex justify-between">
                  <span className="uppercase tracking-widest opacity-60">Release Year</span>
                  <span className="text-white font-medium">{selectedManga.year}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="uppercase tracking-widest opacity-60">Status</span>
                <span className="text-red-400 uppercase font-semibold">{selectedManga.status}</span>
              </div>
            </div>
          </aside>

          {/* Right Section: Title, Synopsis, and Chapter List */}
          <section className="flex-1 flex flex-col p-6 sm:p-8 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-3xl sm:text-5xl font-serif italic mb-4 text-white leading-tight">
                {selectedManga.title}
              </h1>

              {/* Tag Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedManga.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2.5 py-1 border border-white/10 rounded-full opacity-70 uppercase tracking-wider text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              <p className="text-xs sm:text-sm leading-relaxed text-[#a0a0a0] max-w-2xl">
                {selectedManga.description || 'No description available for this title.'}
              </p>
            </div>

            {/* Chapter List Feed */}
            <div className="flex-1 flex flex-col border-t border-white/10 pt-6">
              <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                    Chapter List
                  </h3>
                  {chapterSource === 'mangapill' && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest bg-purple-500/15 border border-purple-500/40 text-purple-300 rounded-xs">
                      via MangaPill
                    </span>
                  )}
                </div>
                <span className="text-[10px] opacity-40 uppercase tracking-widest">
                  Showing {filteredChapters.length}{availableLanguages.length > 1 ? ` / ${chapters.length}` : ''} Chapters
                </span>
              </div>

              {/* Language Selector */}
              {availableLanguages.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span className="text-[9px] uppercase tracking-widest opacity-40 mr-1 flex items-center gap-1">
                    <Languages className="w-3 h-3" /> Language
                  </span>
                  <button
                    onClick={() => setChapterLang('all')}
                    className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-xs border transition-colors ${
                      chapterLang === 'all'
                        ? 'bg-white text-black'
                        : 'border-white/10 text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    All ({chapters.length})
                  </button>
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setChapterLang(lang)}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-xs border transition-colors ${
                        chapterLang === lang
                          ? 'bg-white text-black'
                          : 'border-white/10 text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      {languageLabel(lang)} ({chapters.filter((c) => c.language === lang).length})
                    </button>
                  ))}
                </div>
              )}

              {loadingChapters ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
                  <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
                  <span className="text-xs uppercase tracking-widest">Loading chapters from {chapterSource === 'mangapill' ? 'MangaPill' : 'MangaDex'}...</span>
                </div>
              ) : chaptersError ? (
                <div className="p-8 flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-xs uppercase tracking-widest text-center">{chaptersError}</span>
                  <button
                    onClick={() => handleSelectManga(selectedManga!)}
                    className="mt-1 px-3 py-1.5 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredChapters.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#a0a0a0] py-10 px-6">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-center max-w-md">
                    {chapters.length === 0
                      ? 'No chapters available'
                      : `No chapters in ${languageLabel(chapterLang)}`}
                  </span>
                  <span className="text-[11px] text-center max-w-sm leading-relaxed opacity-70">
                    {chapters.length === 0
                      ? 'This series has no readable chapters on this source.'
                      : availableLanguages.length > 1
                        ? 'Try a different language above.'
                        : 'This series has no readable chapters on this source.'}
                  </span>
                  <button
                    onClick={() => setSelectedManga(null)}
                    className="mt-3 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
                  >
                    Back to Search
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredChapters.map((chapter, idx) => (
                    <div
                      key={chapter.id}
                      onClick={() => handleOpenChapter(chapter)}
                      className={`flex items-center justify-between p-4 rounded-xs transition-colors cursor-pointer group ${
                        idx === 0
                          ? 'bg-white/5 border-l-2 border-red-500'
                          : 'hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-medium transition-colors ${idx === 0 ? 'text-white' : 'text-[#c0c0c0] group-hover:text-white'}`}>
                          {chapter.volume ? `Vol. ${chapter.volume} ` : ''}Chapter {chapter.chapterNumber}
                          {chapter.title ? ` - ${chapter.title}` : ''}
                        </span>
                        {(chapter.scanlationGroup || (chapter.language && chapter.language !== 'en')) && (
                          <span className="text-[10px] opacity-40 uppercase tracking-widest mt-0.5 truncate">
                            {chapter.language && chapter.language !== 'en' && chapterLang === 'all' ? `${languageLabel(chapter.language)} • ` : ''}
                            {chapter.scanlationGroup}
                          </span>
                        )}
                      </div>
                      {chapter.externalUrl ? (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-bold uppercase tracking-wider rounded-xs shrink-0 ml-3">
                          <ExternalLink className="w-3 h-3" /> External
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // Default: Search & Browse Grid - Editorial Style
  return (
    <div id="manga-search-view" className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      {/* Search Bar Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-[#0d0d0d] flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-0 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#808080]" />
          <input
            id={searchInputId}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query, translatedSearch, originFilter)}
            placeholder="Search manga, manhwa, webtoons (e.g. Frieren, Apothecary Diaries, Solo Leveling)..."
            className="w-full pl-10 pr-48 py-2.5 text-xs rounded-xs border border-white/10 bg-[#141414] text-[#e0e0e0] placeholder-[#606060] focus:outline-none focus:border-red-500 transition-colors"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchSource === 'mangadex' && (
              <button
                onClick={() => setTranslatedSearch(!translatedSearch)}
                title="Translated search also matches translated and alternate titles (e.g. 'na honjaman' finds Solo Leveling)"
                className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border transition-colors flex items-center gap-1 ${
                  translatedSearch
                    ? 'bg-red-600/20 border-red-500 text-red-400'
                    : 'border-white/10 text-[#808080] hover:text-white'
                }`}
              >
                <Languages className="w-3 h-3" /> Translated
              </button>
            )}
            <button
              onClick={() => handleSearch(query, translatedSearch, originFilter)}
              className="px-3.5 py-1.5 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Quick Filter Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
          {['Frieren', 'Apothecary Diaries', 'Solo Leveling', 'Chainsaw Man', 'One Piece', 'Jujutsu Kaisen'].map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setQuery(preset);
                handleSearch(preset, translatedSearch, originFilter);
              }}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500 rounded-xs transition-colors whitespace-nowrap"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Source Toggle: MangaDex | MangaPill */}
        <div className="w-full flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
            <BookOpen className="w-3 h-3 text-red-500" /> Source
          </span>
          {(['mangadex', 'mangapill'] as const).map((src) => (
            <button
              key={src}
              onClick={() => setSearchSource(src)}
              title={
                src === 'mangapill'
                  ? 'MangaPill (via Consumet) covers licensed series missing from MangaDex'
                  : 'Official MangaDex API'
              }
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap ${
                searchSource === src
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500'
              }`}
            >
              {src === 'mangadex' ? 'MangaDex' : 'MangaPill'}
            </button>
          ))}
        </div>
      </div>

      {/* Manga Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Origin Filter (Manga / Manhwa / Manhua / Webtoon) - MangaDex only */}
        {searchSource === 'mangadex' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
            <Sliders className="w-3 h-3 text-red-500" /> Origin
          </span>
          {(
            [
              ['all', 'All'],
              ['manga', 'Manga'],
              ['manhwa', 'Manhwa'],
              ['manhua', 'Manhua'],
              ['webtoon', 'Webtoon'],
            ] as [MangaOrigin, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOriginFilter(key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap ${
                originFilter === key
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        )}

        {/* Genre Filter - MangaDex only */}
        {searchSource === 'mangadex' && genreTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#808080] flex items-center gap-1 mr-1 whitespace-nowrap">
            <Layers className="w-3 h-3 text-red-500" /> Genre
          </span>
          {selectedGenres.length > 0 && (
            <button
              onClick={() => setSelectedGenres([])}
              className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap bg-red-600/20 border-red-500/40 text-red-400"
            >
              Clear
            </button>
          )}
          {genreTags.slice(0, 20).map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                setSelectedGenres((prev) =>
                  prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                );
              }}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xs border transition-colors whitespace-nowrap ${
                selectedGenres.includes(tag.id)
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-white/5 border-white/10 text-[#a0a0a0] hover:text-white hover:border-red-500'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
        )}

        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0]">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs uppercase tracking-widest font-mono">Searching {searchSource === 'mangapill' ? 'MangaPill' : 'MangaDex'}...</span>
          </div>
        ) : searchError ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] px-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-xs uppercase tracking-widest text-center">{searchError}</span>
            <button
              onClick={() => handleSearch(query, translatedSearch, originFilter)}
              className="mt-2 px-4 py-2 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Continue Reading */}
            {history.length > 0 && !query && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Continue Reading</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
                  {history.map((entry) => (
                    <button
                      key={`${entry.mangaId}-${entry.chapterId}`}
                      onClick={() => handleResume(entry)}
                      className="group flex flex-col text-left rounded-xs overflow-hidden border border-white/10 bg-[#121212] hover:border-red-500/60 transition-all shadow-xl"
                    >
                      <div className="w-full aspect-[2/3] bg-[#1a1a1a] overflow-hidden relative">
                        {entry.mangaCoverUrl ? (
                          <img
                            src={entry.mangaCoverUrl}
                            alt={entry.mangaTitle}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-[#808080] uppercase tracking-widest">
                            No Cover
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter bg-red-600 text-white rounded-xs">
                          Resume
                        </span>
                      </div>
                      <div className="p-3 flex flex-col flex-1 justify-between bg-[#121212]">
                        <h4 className="font-serif italic text-sm text-white group-hover:text-red-400 line-clamp-2 leading-snug transition-colors">
                          {entry.mangaTitle}
                        </h4>
                        <span className="text-[10px] uppercase tracking-widest text-[#a0a0a0] mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-red-500" />
                          Ch. {entry.chapterNumber}
                          {entry.pageIndex > 0 ? ` • Page ${entry.pageIndex + 1}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Section Heading */}
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                {query ? `Results for "${query}"` : 'Suggestions'}
              </h3>
              <span className="text-[10px] opacity-40 uppercase tracking-widest">{mangaList.length} titles</span>
            </div>

            {mangaList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[#a0a0a0] text-xs uppercase tracking-widest px-6">
                <Search className="w-8 h-8 text-red-500/60" />
                <span className="text-center">
                  {query
                    ? 'No manga found. Try another query or keyword.'
                    : 'No suggestions available. Try a search.'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
                {mangaList.map((manga) => (
                  <button
                    key={manga.id}
                    onClick={() => handleSelectManga(manga)}
                    className="group flex flex-col text-left rounded-xs overflow-hidden border border-white/10 bg-[#121212] hover:border-white/30 transition-all shadow-xl"
                  >
                    {/* Cover Image */}
                    <div className="w-full aspect-[2/3] bg-[#1a1a1a] overflow-hidden relative">
                      {manga.coverUrl ? (
                        <img
                          src={manga.coverUrl}
                          alt={manga.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-[#808080] uppercase tracking-widest">
                          No Cover
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>

                      <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tighter bg-red-600 text-white rounded-xs">
                        {manga.status}
                      </span>

                      {manga.origin && manga.origin !== 'manga' && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter bg-black/85 text-red-400 border border-red-500/50 rounded-xs backdrop-blur">
                          {manga.origin}
                        </span>
                      )}

                      {availability[manga.id] === false && (
                        <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter bg-black/85 text-red-400 border border-red-500/50 rounded-xs backdrop-blur">
                          No English
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-3 flex flex-col flex-1 justify-between bg-[#121212]">
                      <div>
                        <h4 className="font-serif italic text-sm text-white group-hover:text-red-400 line-clamp-2 leading-snug transition-colors">
                          {manga.title}
                        </h4>
                        {manga.translatedTitle && manga.translatedTitle !== manga.title && (
                          <span className="text-[9px] italic text-[#808080] line-clamp-1 mt-0.5">
                            {manga.translatedTitle}
                          </span>
                        )}
                        {manga.tags.length > 0 && (
                          <span className="text-[9px] uppercase tracking-wider text-[#808080] line-clamp-1 mt-1">
                            {manga.tags.slice(0, 2).join(' • ')}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a0a0a0] group-hover:text-white mt-3 flex items-center gap-1 transition-colors">
                        Explore <ChevronRight className="w-3 h-3 text-red-500" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => handleSearch(query, translatedSearch, originFilter, true)}
                  disabled={loadingMore}
                  className="px-5 py-2.5 bg-white text-black font-bold uppercase text-[10px] tracking-[0.15em] hover:bg-red-500 hover:text-white rounded-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMore ? 'animate-spin' : ''}`} />
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
