import { useState } from 'react';
import { LiveMangaDexReader } from './components/LiveMangaDexReader';
import { AnimeSection } from './components/AnimeSection';
import { MoviesSection } from './components/MoviesSection';
import { SeriesSection } from './components/SeriesSection';
import { BookOpen, Clapperboard, Film, MonitorPlay, Moon, ScrollText, Sun } from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [section, setSection] = useState<'manga' | 'manhwa' | 'anime' | 'movies' | 'series'>('manga');

  return (
    <div className={`h-dvh flex flex-col overflow-hidden ${isDark ? 'dark bg-[#0a0a0a] text-[#e0e0e0]' : 'bg-[#f4f4f5] text-[#18181b]'} transition-colors font-sans antialiased`}>
      {/* Top Application Header - Editorial Style */}
      <header className="flex-shrink-0 z-50 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md dark:border-white/10 light:bg-white/95 light:border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xs bg-red-600 flex items-center justify-center overflow-hidden shadow-lg shadow-red-600/20">
              <img src="/icon.png" alt="ComicK Reader logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif italic text-base sm:text-lg text-white dark:text-white light:text-neutral-900 tracking-tight leading-none truncate">
                  ComicK Reader
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] bg-red-600/10 text-red-500 rounded-xs border border-red-600/30">
                  Browse • Read • Discover
                </span>
              </div>
              <p className="text-[11px] text-[#a0a0a0] font-sans tracking-wide mt-0.5 hidden xs:block sm:block">
                Manga & anime, all in one place
              </p>
            </div>
          </div>

          {/* Section Switcher */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xs p-0.5 text-[10px] font-bold uppercase tracking-wider">
            <button
              onClick={() => setSection('manga')}
              className={`px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1.5 ${
                section === 'manga' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manga</span>
            </button>
            <button
              onClick={() => setSection('manhwa')}
              className={`px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1.5 ${
                section === 'manhwa' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manhwa</span>
            </button>
            <button
              onClick={() => setSection('anime')}
              className={`px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1.5 ${
                section === 'anime' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anime</span>
            </button>
            <button
              onClick={() => setSection('movies')}
              className={`px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1.5 ${
                section === 'movies' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Movies</span>
            </button>
            <button
              onClick={() => setSection('series')}
              className={`px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1.5 ${
                section === 'series' ? 'bg-white text-black font-bold' : 'text-[#a0a0a0] hover:text-white'
              }`}
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Series</span>
            </button>
          </div>

          {/* Dark / Light Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xs border border-white/10 hover:bg-white/5 text-[#a0a0a0] hover:text-white transition-colors"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-red-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {section === 'manga' ? (
          <LiveMangaDexReader />
        ) : section === 'manhwa' ? (
          <LiveMangaDexReader defaultOrigin="manhwa" />
        ) : section === 'anime' ? (
          <AnimeSection />
        ) : section === 'movies' ? (
          <MoviesSection />
        ) : (
          <SeriesSection />
        )}
      </main>
    </div>
  );
}
