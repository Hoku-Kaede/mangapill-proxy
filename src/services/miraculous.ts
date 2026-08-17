// On Vercel (or local dev), /api/page proxies miraculous.to pages.
// On Android (standalone), the local Node proxy at port 3001 is used.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_CAPACITOR = typeof (globalThis as any).window !== 'undefined' && !!(globalThis as any).window?.Capacitor;
const LOCAL_PROXY = 'http://127.0.0.1:3001';

export interface MiraculousEpisode {
  season: number;
  episode: number;
  title: string;
  slug: string;
  pageUrl: string;
  thumbnail: string;
}

export interface MiraculousVideoSource {
  src: string;
  type: string;
  server: number;
}

// Hardcoded episode list — the show has a fixed, known catalog.
// Thumbnails are fetched lazily from the episode pages.
const EPISODE_DATA: Omit<MiraculousEpisode, 'thumbnail'>[] = [
  // Season 1
  { season: 1, episode: 1, title: 'Stormy Weather', slug: 'stormy-weather', pageUrl: '/en/season-1/episode-1-stormy-weather.html' },
  { season: 1, episode: 2, title: 'The Bubbler', slug: 'the-bubbler', pageUrl: '/en/season-1/episode-2-the-bubbler.html' },
  { season: 1, episode: 3, title: 'The Pharaoh', slug: 'the-pharaoh', pageUrl: '/en/season-1/episode-3-the-pharaoh.html' },
  { season: 1, episode: 4, title: 'Lady WiFi', slug: 'lady-wifi', pageUrl: '/en/season-1/episode-4-lady-wifi.html' },
  { season: 1, episode: 5, title: 'Timebreaker', slug: 'timebreaker', pageUrl: '/en/season-1/episode-5-timebreaker.html' },
  { season: 1, episode: 6, title: 'Mr. Pigeon', slug: 'mr-pigeon', pageUrl: '/en/season-1/episode-6-mr-pigeon.html' },
  { season: 1, episode: 7, title: 'The Evilustrator', slug: 'the-evilustrator', pageUrl: '/en/season-1/episode-7-the-evilustrator.html' },
  { season: 1, episode: 8, title: 'Rogercop', slug: 'rogercop', pageUrl: '/en/season-1/episode-8-rogercop.html' },
  { season: 1, episode: 9, title: 'Copy Cat', slug: 'copy-cat', pageUrl: '/en/season-1/episode-9-copy-cat.html' },
  { season: 1, episode: 10, title: 'Dark Cupid', slug: 'dark-cupid', pageUrl: '/en/season-1/episode-10-dark-cupid.html' },
  { season: 1, episode: 11, title: 'Horrificator', slug: 'horrificator', pageUrl: '/en/season-1/episode-11-horrificator.html' },
  { season: 1, episode: 12, title: 'Darkblade', slug: 'darkblade', pageUrl: '/en/season-1/episode-12-darkblade.html' },
  { season: 1, episode: 13, title: 'The Mime', slug: 'the-mime', pageUrl: '/en/season-1/episode-13-the-mime.html' },
  { season: 1, episode: 14, title: 'Kung Food', slug: 'kung-food', pageUrl: '/en/season-1/episode-14-kung-food.html' },
  { season: 1, episode: 15, title: 'The Gamer', slug: 'the-gamer', pageUrl: '/en/season-1/episode-15-the-gamer.html' },
  { season: 1, episode: 16, title: 'Animan', slug: 'animan', pageUrl: '/en/season-1/episode-16-animan.html' },
  { season: 1, episode: 17, title: 'Antibug', slug: 'antibug', pageUrl: '/en/season-1/episode-17-antibug.html' },
  { season: 1, episode: 18, title: 'Puppeteer', slug: 'puppeteer', pageUrl: '/en/season-1/episode-18-puppeteer.html' },
  { season: 1, episode: 19, title: 'Reflekta', slug: 'reflekta', pageUrl: '/en/season-1/episode-19-reflekta.html' },
  { season: 1, episode: 20, title: 'Pixelator', slug: 'pixelator', pageUrl: '/en/season-1/episode-20-pixelator.html' },
  { season: 1, episode: 21, title: 'Guitar Villain', slug: 'guitar-villain', pageUrl: '/en/season-1/episode-21-guitar-villain.html' },
  { season: 1, episode: 22, title: 'Princess Fragrance', slug: 'princess-fragrance', pageUrl: '/en/season-1/episode-22-princess-fragrance.html' },
  { season: 1, episode: 23, title: 'Simon Says', slug: 'simon-says', pageUrl: '/en/season-1/episode-23-simon-says.html' },
  { season: 1, episode: 24, title: 'Volpina', slug: 'volpina', pageUrl: '/en/season-1/episode-24-volpina.html' },
  { season: 1, episode: 25, title: 'The Origins - Part 1', slug: 'the-origins-part-1', pageUrl: '/en/season-1/episode-25-the-origins-part-1.html' },
  { season: 1, episode: 26, title: 'The Origins - Part 2', slug: 'the-origins-part-2', pageUrl: '/en/season-1/episode-26-the-origins-part-2.html' },
  // Season 2
  { season: 2, episode: 1, title: 'The Collector', slug: 'the-collector', pageUrl: '/en/season-2/episode-1-the-collector.html' },
  { season: 2, episode: 2, title: 'Despair Bear', slug: 'despair-bear', pageUrl: '/en/season-2/episode-2-despair-bear.html' },
  { season: 2, episode: 3, title: 'Prime Queen', slug: 'prime-queen', pageUrl: '/en/season-2/episode-3-prime-queen.html' },
  { season: 2, episode: 4, title: 'Befana', slug: 'befana', pageUrl: '/en/season-2/episode-4-befana.html' },
  { season: 2, episode: 5, title: 'Riposte', slug: 'riposte', pageUrl: '/en/season-2/episode-5-riposte.html' },
  { season: 2, episode: 6, title: 'Robostus', slug: 'robostus', pageUrl: '/en/season-2/episode-6-robostus.html' },
  { season: 2, episode: 7, title: 'Gigantitan', slug: 'gigantitan', pageUrl: '/en/season-2/episode-7-gigantitan.html' },
  { season: 2, episode: 8, title: 'Dark Owl', slug: 'dark-owl', pageUrl: '/en/season-2/episode-8-dark-owl.html' },
  { season: 2, episode: 9, title: 'Glaciator', slug: 'glaciator', pageUrl: '/en/season-2/episode-9-glaciator.html' },
  { season: 2, episode: 10, title: 'Sapotis', slug: 'sapotis', pageUrl: '/en/season-2/episode-10-sapotis.html' },
  { season: 2, episode: 11, title: 'Gorizilla', slug: 'gorizilla', pageUrl: '/en/season-2/episode-11-gorizilla.html' },
  { season: 2, episode: 12, title: 'Captain Hardrock', slug: 'captain-hardrock', pageUrl: '/en/season-2/episode-12-captain-hardrock.html' },
  { season: 2, episode: 13, title: 'Zombizou', slug: 'zombizou', pageUrl: '/en/season-2/episode-13-zombizou.html' },
  { season: 2, episode: 14, title: 'Syren', slug: 'syren', pageUrl: '/en/season-2/episode-14-syren.html' },
  { season: 2, episode: 15, title: 'Frightningale', slug: 'frightningale', pageUrl: '/en/season-2/episode-15-frightningale.html' },
  { season: 2, episode: 16, title: 'Troublemaker', slug: 'troublemaker', pageUrl: '/en/season-2/episode-16-troublemaker.html' },
  { season: 2, episode: 17, title: 'Reverser', slug: 'reverser', pageUrl: '/en/season-2/episode-17-reverser.html' },
  { season: 2, episode: 18, title: 'Anansi', slug: 'anansi', pageUrl: '/en/season-2/episode-18-anansi.html' },
  { season: 2, episode: 19, title: 'Sandboy', slug: 'sandboy', pageUrl: '/en/season-2/episode-19-sandboy.html' },
  { season: 2, episode: 20, title: "Style Queen (Queen's Battle - Part 1)", slug: 'style-queen-queens-battle-part-1', pageUrl: '/en/season-2/episode-20-style-queen-queens-battle-part-1.html' },
  { season: 2, episode: 21, title: "Queen Wasp (Queen's Battle - Part 2)", slug: 'queen-wasp-queens-battle-part-2', pageUrl: '/en/season-2/episode-21-queen-wasp-queens-battle-part-2.html' },
  { season: 2, episode: 22, title: 'Malediktator', slug: 'malediktator', pageUrl: '/en/season-2/episode-22-malediktator.html' },
  { season: 2, episode: 23, title: 'Frozer', slug: 'frozer', pageUrl: '/en/season-2/episode-23-frozer.html' },
  { season: 2, episode: 24, title: 'Catalyst (The Heroes Day - Part 1)', slug: 'catalyst-the-heroes-day-part-1', pageUrl: '/en/season-2/episode-24-catalyst-the-heroes-day-part-1.html' },
  { season: 2, episode: 25, title: 'Mayura (The Heroes Day - Part 2)', slug: 'mayura-the-heroes-day-part-2', pageUrl: '/en/season-2/episode-25-mayura-the-heroes-day-part-2.html' },
  { season: 2, episode: 26, title: 'A Christmas Special', slug: 'a-christmas-special', pageUrl: '/en/season-2/episode-26-a-christmas-special.html' },
  // Season 3
  { season: 3, episode: 1, title: 'Chameleon', slug: 'chameleon', pageUrl: '/en/season-3/episode-1-chameleon.html' },
  { season: 3, episode: 2, title: 'Animaestro', slug: 'animaestro', pageUrl: '/en/season-3/episode-2-animaestro.html' },
  { season: 3, episode: 3, title: 'Bakerix', slug: 'bakerix', pageUrl: '/en/season-3/episode-3-bakerix.html' },
  { season: 3, episode: 4, title: 'Backwarder', slug: 'backwarder', pageUrl: '/en/season-3/episode-4-backwarder.html' },
  { season: 3, episode: 5, title: 'Reflekdoll', slug: 'reflekdoll', pageUrl: '/en/season-3/episode-5-reflekdoll.html' },
  { season: 3, episode: 6, title: 'Weredad', slug: 'weredad', pageUrl: '/en/season-3/episode-6-weredad.html' },
  { season: 3, episode: 7, title: 'Silencer', slug: 'silencer', pageUrl: '/en/season-3/episode-7-silencer.html' },
  { season: 3, episode: 8, title: 'Onichan', slug: 'onichan', pageUrl: '/en/season-3/episode-8-onichan.html' },
  { season: 3, episode: 9, title: 'Miraculer', slug: 'miraculer', pageUrl: '/en/season-3/episode-9-miraculer.html' },
  { season: 3, episode: 10, title: 'Oblivio', slug: 'oblivio', pageUrl: '/en/season-3/episode-10-oblivio.html' },
  { season: 3, episode: 11, title: 'Desperada', slug: 'desperada', pageUrl: '/en/season-3/episode-11-desperada.html' },
  { season: 3, episode: 12, title: 'Chris Master', slug: 'chris-master', pageUrl: '/en/season-3/episode-12-chris-master.html' },
  { season: 3, episode: 13, title: 'Startrain', slug: 'startrain', pageUrl: '/en/season-3/episode-13-startrain.html' },
  { season: 3, episode: 14, title: 'Kwami Buster', slug: 'kwami-buster', pageUrl: '/en/season-3/episode-14-kwami-buster.html' },
  { season: 3, episode: 15, title: 'Feast', slug: 'feast', pageUrl: '/en/season-3/episode-15-feast.html' },
  { season: 3, episode: 16, title: 'Gamer 2.0', slug: 'gamer-20', pageUrl: '/en/season-3/episode-16-gamer-20.html' },
  { season: 3, episode: 17, title: 'Stormy Weather 2', slug: 'stormy-weather-2', pageUrl: '/en/season-3/episode-17-stormy-weather-2.html' },
  { season: 3, episode: 18, title: 'Ikari Gozen', slug: 'ikari-gozen', pageUrl: '/en/season-3/episode-18-ikari-gozen.html' },
  { season: 3, episode: 19, title: 'Timetagger', slug: 'timetagger', pageUrl: '/en/season-3/episode-19-timetagger.html' },
  { season: 3, episode: 20, title: 'Party Crasher', slug: 'party-crasher', pageUrl: '/en/season-3/episode-20-party-crasher.html' },
  { season: 3, episode: 21, title: 'The Puppeteer 2', slug: 'the-puppeteer-2', pageUrl: '/en/season-3/episode-21-the-puppeteer-2.html' },
  { season: 3, episode: 22, title: 'Cat Blanc', slug: 'cat-blanc', pageUrl: '/en/season-3/episode-22-cat-blanc.html' },
  { season: 3, episode: 23, title: 'Felix', slug: 'felix', pageUrl: '/en/season-3/episode-23-felix.html' },
  { season: 3, episode: 24, title: 'Ladybug', slug: 'ladybug', pageUrl: '/en/season-3/episode-24-ladybug.html' },
  { season: 3, episode: 25, title: 'Heart Hunter (The Battle of the Miraculous - Part 1)', slug: 'heart-hunter-the-battle-of-the-miraculous-part-1', pageUrl: '/en/season-3/episode-25-heart-hunter-the-battle-of-the-miraculous-part-1.html' },
  { season: 3, episode: 26, title: 'Miracle Queen (The Battle of the Miraculous - Part 2)', slug: 'miracle-queen-the-battle-of-the-miraculous-part-2', pageUrl: '/en/season-3/episode-26-miracle-queen-the-battle-of-the-miraculous-part-2.html' },
  // Season 4
  { season: 4, episode: 1, title: 'Truth', slug: 'truth', pageUrl: '/en/season-4/episode-1-truth.html' },
  { season: 4, episode: 2, title: 'Lies', slug: 'lies', pageUrl: '/en/season-4/episode-2-lies.html' },
  { season: 4, episode: 3, title: 'Gang of Secrets', slug: 'gang-of-secrets', pageUrl: '/en/season-4/episode-3-gang-of-secrets.html' },
  { season: 4, episode: 4, title: 'Mr Pigeon 72', slug: 'mr-pigeon-72', pageUrl: '/en/season-4/episode-4-mr-pigeon-72.html' },
  { season: 4, episode: 5, title: 'Psycomedian', slug: 'psycomedian', pageUrl: '/en/season-4/episode-5-psycomedian.html' },
  { season: 4, episode: 6, title: 'Furious Fu', slug: 'furious-fu', pageUrl: '/en/season-4/episode-6-furious-fu.html' },
  { season: 4, episode: 7, title: 'Sole Crusher', slug: 'sole-crusher', pageUrl: '/en/season-4/episode-7-sole-crusher.html' },
  { season: 4, episode: 8, title: 'Queen Banana', slug: 'queen-banana', pageUrl: '/en/season-4/episode-8-queen-banana.html' },
  { season: 4, episode: 9, title: 'Gabriel Agreste', slug: 'gabriel-agreste', pageUrl: '/en/season-4/episode-9-gabriel-agreste.html' },
  { season: 4, episode: 10, title: 'Mega Leech', slug: 'mega-leech', pageUrl: '/en/season-4/episode-10-mega-leech.html' },
  { season: 4, episode: 11, title: 'Guiltrip', slug: 'guiltrip', pageUrl: '/en/season-4/episode-11-guiltrip.html' },
  { season: 4, episode: 12, title: 'Crocoduel', slug: 'crocoduel', pageUrl: '/en/season-4/episode-12-crocoduel.html' },
  { season: 4, episode: 13, title: 'Optigami', slug: 'optigami', pageUrl: '/en/season-4/episode-13-optigami.html' },
  { season: 4, episode: 14, title: 'Sentibubbler', slug: 'sentibubbler', pageUrl: '/en/season-4/episode-14-sentibubbler.html' },
  { season: 4, episode: 15, title: 'Glaciator 2', slug: 'glaciator-2', pageUrl: '/en/season-4/episode-15-glaciator-2.html' },
  { season: 4, episode: 16, title: 'Hack-San', slug: 'hack-san', pageUrl: '/en/season-4/episode-16-hack-san.html' },
  { season: 4, episode: 17, title: 'Rocketear', slug: 'rocketear', pageUrl: '/en/season-4/episode-17-rocketear.html' },
  { season: 4, episode: 18, title: 'Wishmaker', slug: 'wishmaker', pageUrl: '/en/season-4/episode-18-wishmaker.html' },
  { season: 4, episode: 19, title: 'Simpleman', slug: 'simpleman', pageUrl: '/en/season-4/episode-19-simpleman.html' },
  { season: 4, episode: 20, title: 'Qilin', slug: 'qilin', pageUrl: '/en/season-4/episode-20-qilin.html' },
  { season: 4, episode: 21, title: 'Dearest Family', slug: 'dearest-family', pageUrl: '/en/season-4/episode-21-dearest-family.html' },
  { season: 4, episode: 22, title: 'Ephemeral', slug: 'ephemeral', pageUrl: '/en/season-4/episode-22-ephemeral.html' },
  { season: 4, episode: 23, title: 'Kuro Neko', slug: 'kuro-neko', pageUrl: '/en/season-4/episode-23-kuro-neko.html' },
  { season: 4, episode: 24, title: 'Penalteam', slug: 'penalteam', pageUrl: '/en/season-4/episode-24-penalteam.html' },
  { season: 4, episode: 25, title: "Risk (Shadow Moth's Final Attack - Part 1)", slug: 'risk-shadow-moths-final-attack-part-1', pageUrl: '/en/season-4/episode-25-risk-shadow-moths-final-attack-part-1.html' },
  { season: 4, episode: 26, title: "Strike Back (Shadow Moth's Final Attack - Part 2)", slug: 'strike-back-shadow-moths-final-attack-part-2', pageUrl: '/en/season-4/episode-26-strike-back-shadow-moths-final-attack-part-2.html' },
  // Season 5
  { season: 5, episode: 1, title: 'Evolution', slug: 'evolution', pageUrl: '/en/season-5/episode-1-evolution.html' },
  { season: 5, episode: 2, title: 'Multiplication', slug: 'multiplication', pageUrl: '/en/season-5/episode-2-multiplication.html' },
  { season: 5, episode: 3, title: 'Destruction', slug: 'destruction', pageUrl: '/en/season-5/episode-3-destruction.html' },
  { season: 5, episode: 4, title: 'Jubilation', slug: 'jubilation', pageUrl: '/en/season-5/episode-4-jubilation.html' },
  { season: 5, episode: 5, title: 'Illusion', slug: 'illusion', pageUrl: '/en/season-5/episode-5-illusion.html' },
  { season: 5, episode: 6, title: 'Determination', slug: 'determination', pageUrl: '/en/season-5/episode-6-determination.html' },
  { season: 5, episode: 7, title: 'Passion', slug: 'passion', pageUrl: '/en/season-5/episode-7-passion.html' },
  { season: 5, episode: 8, title: 'Reunion', slug: 'reunion', pageUrl: '/en/season-5/episode-8-reunion.html' },
  { season: 5, episode: 9, title: 'Elation', slug: 'elation', pageUrl: '/en/season-5/episode-9-elation.html' },
  { season: 5, episode: 10, title: "Transmission (The Kwamis' Choice - Part 1)", slug: 'transmission-the-kwamis-choice-part-1', pageUrl: '/en/season-5/episode-10-transmission-the-kwamis-choice-part-1.html' },
  { season: 5, episode: 11, title: "Deflagration (The Kwamis' Choice - Part 2)", slug: 'deflagration-the-kwamis-choice-part-2', pageUrl: '/en/season-5/episode-11-deflagration-the-kwamis-choice-part-2.html' },
  { season: 5, episode: 12, title: 'Perfection', slug: 'perfection', pageUrl: '/en/season-5/episode-12-perfection.html' },
  { season: 5, episode: 13, title: 'Migration', slug: 'migration', pageUrl: '/en/season-5/episode-13-migration.html' },
  { season: 5, episode: 14, title: 'Derision', slug: 'derision', pageUrl: '/en/season-5/episode-14-derision.html' },
  { season: 5, episode: 15, title: 'Intuition', slug: 'intuition', pageUrl: '/en/season-5/episode-15-intuition.html' },
  { season: 5, episode: 16, title: 'Protection', slug: 'protection', pageUrl: '/en/season-5/episode-16-protection.html' },
  { season: 5, episode: 17, title: 'Adoration', slug: 'adoration', pageUrl: '/en/season-5/episode-17-adoration.html' },
  { season: 5, episode: 18, title: 'Emotion', slug: 'emotion', pageUrl: '/en/season-5/episode-18-emotion.html' },
  { season: 5, episode: 19, title: 'Pretension', slug: 'pretension', pageUrl: '/en/season-5/episode-19-pretension.html' },
  { season: 5, episode: 20, title: 'Revelation', slug: 'revelation', pageUrl: '/en/season-5/episode-20-revelation.html' },
  { season: 5, episode: 21, title: 'Confrontation', slug: 'confrontation', pageUrl: '/en/season-5/episode-21-confrontation.html' },
  { season: 5, episode: 22, title: 'Collusion', slug: 'collusion', pageUrl: '/en/season-5/episode-22-collusion.html' },
  { season: 5, episode: 23, title: 'Revolution', slug: 'revolution', pageUrl: '/en/season-5/episode-23-revolution.html' },
  { season: 5, episode: 24, title: 'Representation', slug: 'representation', pageUrl: '/en/season-5/episode-24-representation.html' },
  { season: 5, episode: 25, title: 'Conformation (The Last Day - Part 1)', slug: 'conformation-the-last-day-part-1', pageUrl: '/en/season-5/episode-25-conformation-the-last-day-part-1.html' },
  { season: 5, episode: 26, title: 'Re-Creation (The Last Day - Part 2)', slug: 're-creation-the-last-day-part-2', pageUrl: '/en/season-5/episode-26-re-creation-the-last-day-part-2.html' },
  // Season 6
  { season: 6, episode: 1, title: 'The Illustrhater', slug: 'the-illustrhater', pageUrl: '/en/season-6/episode-1-the-illustrhater.html' },
  { season: 6, episode: 2, title: 'Sublimation', slug: 'sublimation', pageUrl: '/en/season-6/episode-2-sublimation.html' },
  { season: 6, episode: 3, title: 'Werepapas', slug: 'werepapas', pageUrl: '/en/season-6/episode-3-werepapas.html' },
  { season: 6, episode: 4, title: 'Daddycop', slug: 'daddycop', pageUrl: '/en/season-6/episode-4-daddycop.html' },
  { season: 6, episode: 5, title: 'Revelator', slug: 'revelator', pageUrl: '/en/season-6/episode-5-revelator.html' },
  { season: 6, episode: 6, title: 'Climatiqueen', slug: 'climatiqueen', pageUrl: '/en/season-6/episode-6-climatiqueen.html' },
  { season: 6, episode: 7, title: 'El Toro de Piedra', slug: 'el-toro-de-piedra', pageUrl: '/en/season-6/episode-7-el-toro-de-piedra.html' },
  { season: 6, episode: 8, title: 'The Ruler', slug: 'the-ruler', pageUrl: '/en/season-6/episode-8-the-ruler.html' },
  { season: 6, episode: 9, title: 'Mister Agreste', slug: 'mister-agreste', pageUrl: '/en/season-6/episode-9-mister-agreste.html' },
  { season: 6, episode: 10, title: 'Sleeping Syren', slug: 'sleeping-syren', pageUrl: '/en/season-6/episode-10-sleeping-syren.html' },
  { season: 6, episode: 11, title: 'Wreckless Driver', slug: 'wreckless-driver', pageUrl: '/en/season-6/episode-11-wreckless-driver.html' },
  { season: 6, episode: 12, title: 'The Dark Castle', slug: 'the-dark-castle', pageUrl: '/en/season-6/episode-12-the-dark-castle.html' },
  { season: 6, episode: 13, title: 'Yaksi Gozen', slug: 'yaksi-gozen', pageUrl: '/en/season-6/episode-13-yaksi-gozen.html' },
  { season: 6, episode: 14, title: 'Noe', slug: 'noe', pageUrl: '/en/season-6/episode-14-noe.html' },
  { season: 6, episode: 15, title: 'Grendiaper', slug: 'grendiaper', pageUrl: '/en/season-6/episode-15-grendiaper.html' },
  { season: 6, episode: 16, title: 'Vampigami', slug: 'vampigami', pageUrl: '/en/season-6/episode-16-vampigami.html' },
  { season: 6, episode: 17, title: 'A Fairy Good Night', slug: 'a-fairy-good-night', pageUrl: '/en/season-6/episode-17-a-fairy-good-night.html' },
  { season: 6, episode: 18, title: 'Heartfixer', slug: 'heartfixer', pageUrl: '/en/season-6/episode-18-heartfixer.html' },
  { season: 6, episode: 19, title: 'Lady Chaos', slug: 'lady-chaos', pageUrl: '/en/season-6/episode-19-lady-chaos.html' },
  { season: 6, episode: 20, title: 'Sadnansi', slug: 'sadnansi', pageUrl: '/en/season-6/episode-20-sadnansi.html' },
  { season: 6, episode: 21, title: 'Riginarazione', slug: 'riginarazione', pageUrl: '/en/season-6/episode-21-riginarazione.html' },
  { season: 6, episode: 22, title: 'The Chained Titans', slug: 'the-chained-titans', pageUrl: '/en/season-6/episode-22-the-chained-titans.html' },
  { season: 6, episode: 23, title: 'The Dirtifiers', slug: 'the-dirtifiers', pageUrl: '/en/season-6/episode-23-the-dirtifiers.html' },
  { season: 6, episode: 24, title: 'Queen of the Dreadzone', slug: 'queen-of-the-dreadzone', pageUrl: '/en/season-6/episode-24-queen-of-the-dreadzone.html' },
  { season: 6, episode: 25, title: 'Secret Protocol', slug: 'secret-protocol', pageUrl: '/en/season-6/episode-25-secret-protocol.html' },
  { season: 6, episode: 26, title: 'Nemesis', slug: 'nemesis', pageUrl: '/en/season-6/episode-26-nemesis.html' },
];

export function getMiraculousEpisodes(): MiraculousEpisode[] {
  return EPISODE_DATA.map((ep) => ({
    ...ep,
    thumbnail: `https://miraculous.to/global_data/img/${String(ep.season * 26 + ep.episode).padStart(3, '0')}_default.webp`,
  }));
}

export function getMiraculousSeasons(): number[] {
  const seasons = new Set(EPISODE_DATA.map((e) => e.season));
  return [...seasons].sort((a, b) => a - b);
}

export async function fetchMiraculousSources(
  season: number,
  episode: number
): Promise<MiraculousVideoSource[]> {
  const ep = EPISODE_DATA.find((e) => e.season === season && e.episode === episode);
  if (!ep) throw new Error(`Episode S${season}E${episode} not found`);

  const pageUrl = `https://miraculous.to${ep.pageUrl}`;
  const fetchUrl = IS_CAPACITOR
    ? `${LOCAL_PROXY}/page?url=${encodeURIComponent(pageUrl)}`
    : `/api/page?url=${encodeURIComponent(pageUrl)}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch episode page: ${res.status}`);
  const html = await res.text();

  // Extract initialSources JSON array from the HTML
  const match = html.match(/var\s+initialSources\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not find video sources in page');

  try {
    const sources: MiraculousVideoSource[] = JSON.parse(match[1]);
    return sources.filter((s) => s.src && s.src.includes('.m3u8'));
  } catch {
    throw new Error('Failed to parse video sources');
  }
}
