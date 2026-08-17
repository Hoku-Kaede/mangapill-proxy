import { ExternalLink } from 'lucide-react';

export function MangaSection() {
  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-[#0d0d0d] border-b border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0a0]">Toonily</span>
        <a
          href="https://toonily.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 rounded-xs border border-white/20 hover:bg-white/10 text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
        >
          <ExternalLink className="w-3 h-3" /> Open in Tab
        </a>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          src="/api/toonily?path=/"
          title="Toonily"
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
