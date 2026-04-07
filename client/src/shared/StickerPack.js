/**
 * StickerPack — curated sticker registry for SUPERBUCIN.
 *
 * 15 stickers hand-picked from the pricy-sticker WhatsApp pack.
 * Source files live in client/public/stickers/ (committed, served as static assets).
 * The original 300-file pricy-sticker/ folder is gitignored.
 *
 * Use-case map:
 *   loading    → mochiHappy (mascot, bounce)
 *   lobby      → mochiHeart, coupleBlob (floaters) + pricyRocket (drift)
 *   waitRoom   → pricyLaughing (ambient) + virtualHug (call-to-action)
 *   sideSelect → pigChickGame (pig-vs-chick context)
 *   victory    → coupleSelfie, jonathanPhotographing, pricyWine (rain pool)
 *   easter egg → sayangilahPricy (5-loss streak) + overthinking (11:11)
 */
export const STICKERS = {
  // Cartoon mascots
  mochiHappy:           '/stickers/STK-20260401-WA0177.webp',
  mochiHeart:           '/stickers/STK-20260405-WA0019.webp',
  coupleBlob:           '/stickers/STK-20260202-WA0032.webp',

  // Photo stickers — Pricylia
  pricyRocket:          '/stickers/STK-20260406-WA0160.webp',
  pricyLaughing:        '/stickers/STK-20260403-WA0068.webp',
  pricyWine:            '/stickers/STK-20260404-WA0105.webp',

  // Photo stickers — couple
  coupleSelfie:         '/stickers/STK-20260407-WA0008.webp',
  jonathanPhotographing:'/stickers/STK-20260325-WA0005.webp',
  virtualHug:           '/stickers/STK-20260325-WA0004.webp',

  // Text / quote stickers (also usable as image props)
  kangenKamu:           '/stickers/STK-20260402-WA0039.webp',
  tanganBerat:          '/stickers/STK-20260403-WA0069.webp',
  janganSenyum:         '/stickers/STK-20260403-WA0070.webp',
  overthinking:         '/stickers/STK-20260405-WA0136.webp',

  // Easter egg
  sayangilahPricy:      '/stickers/STK-20260407-WA0022.webp',

  // Game crossover
  pigChickGame:         '/stickers/STK-20260405-WA0065.webp',
};

/** Stickers used in victory rain. Winner gets pricyWine added to the pool. */
export const VICTORY_POOL_BASE = [
  STICKERS.coupleSelfie,
  STICKERS.jonathanPhotographing,
];
export const VICTORY_POOL_WINNER = [
  ...VICTORY_POOL_BASE,
  STICKERS.pricyWine,
];

/**
 * Quotes extracted from sticker text — used as styled UI copy so they
 * read clearly on small screens without relying on image readability.
 */
export const QUOTES = {
  kangenKamu:    'Kangen kamu sedikit.\nSedikit berlebihan maksudnya.',
  janganSenyum:  'Jangan senyum-senyum kaya gitu dong,\nkalo aku makin naksir gimana? 😅',
  overthinking:  'males overthinking\njadi overloving you aja gimana? 💞',
  tanganBerat:   'Tangan kamu berat? Sini aku pegangin. 🤝',
};

/** Updates the loss streak counter in localStorage. Called from VictoryScreen. */
export function recordMatchResult(isWinner) {
  if (isWinner) {
    localStorage.removeItem('superbucin_loss_streak');
  } else {
    const prev = Number(localStorage.getItem('superbucin_loss_streak') || 0);
    localStorage.setItem('superbucin_loss_streak', String(prev + 1));
  }
}
