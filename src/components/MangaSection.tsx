export function MangaSection() {
  return (
    <div className="flex flex-col h-full rounded-xs border border-white/10 bg-[#0a0a0a] text-[#e0e0e0] overflow-hidden shadow-2xl">
      <iframe
        src="https://mangafire.to"
        title="MangaFire"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
