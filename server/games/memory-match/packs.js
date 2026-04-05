// Demo card packs — replace photo URLs with your own; faces are sent on flip from server only.

const PLACEHOLDER_SELFIE = 'https://picsum.photos/seed/superbucin-selfie/200/200';

export const PACKS = {
  photo: {
    id: 'photo',
    label: 'Photo pack',
    emoji: '📸',
    description: 'Match selfies to nicknames (demo uses placeholder photos)',
    pairsEasy: [
      { pairId: 0, a: { type: 'image', value: PLACEHOLDER_SELFIE, alt: 'Selfie A' }, b: { type: 'text', value: 'Sayang' } },
      { pairId: 1, a: { type: 'image', value: 'https://picsum.photos/seed/couple2/200/200', alt: 'Selfie B' }, b: { type: 'text', value: 'Bubu' } },
      { pairId: 2, a: { type: 'image', value: 'https://picsum.photos/seed/couple3/200/200', alt: 'Selfie C' }, b: { type: 'text', value: 'Cubit' } },
      { pairId: 3, a: { type: 'image', value: 'https://picsum.photos/seed/couple4/200/200', alt: 'Selfie D' }, b: { type: 'text', value: 'Honey' } },
      { pairId: 4, a: { type: 'image', value: 'https://picsum.photos/seed/couple5/200/200', alt: 'Selfie E' }, b: { type: 'text', value: 'Love' } },
      { pairId: 5, a: { type: 'image', value: 'https://picsum.photos/seed/couple6/200/200', alt: 'Selfie F' }, b: { type: 'text', value: 'Moon' } },
      { pairId: 6, a: { type: 'image', value: 'https://picsum.photos/seed/couple7/200/200', alt: 'Selfie G' }, b: { type: 'text', value: 'Star' } },
      { pairId: 7, a: { type: 'image', value: 'https://picsum.photos/seed/couple8/200/200', alt: 'Selfie H' }, b: { type: 'text', value: 'Sunshine' } },
    ],
    pairsHard: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        pairId: i,
        a: { type: 'image', value: `https://picsum.photos/seed/mm-h-${i}a/200/200`, alt: `Pic ${i}a` },
        b: { type: 'text', value: `Nickname ${i + 1}` },
      })),
      ...[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => ({
        pairId: i,
        a: { type: 'image', value: `https://picsum.photos/seed/mm-h-${i}b/200/200`, alt: `Pic ${i}b` },
        b: { type: 'text', value: `Name ${i + 1}` },
      })),
    ],
  },

  nickname: {
    id: 'nickname',
    label: 'Nickname pack',
    emoji: '🤏',
    description: 'Match the nickname to its vibe',
    pairsEasy: [
      { pairId: 0, a: { type: 'text', value: 'Little Miss Cubit' }, b: { type: 'emoji', value: '🤏' } },
      { pairId: 1, a: { type: 'text', value: 'Big Boss Sayang' }, b: { type: 'emoji', value: '👑' } },
      { pairId: 2, a: { type: 'text', value: 'Bubu kecil' }, b: { type: 'emoji', value: '🐣' } },
      { pairId: 3, a: { type: 'text', value: 'My favourite human' }, b: { type: 'emoji', value: '💕' } },
      { pairId: 4, a: { type: 'text', value: 'Chaos gremlin' }, b: { type: 'emoji', value: '😈' } },
      { pairId: 5, a: { type: 'text', value: 'Soft potato' }, b: { type: 'emoji', value: '🥔' } },
      { pairId: 6, a: { type: 'text', value: 'CEO of cuddles' }, b: { type: 'emoji', value: '🧸' } },
      { pairId: 7, a: { type: 'text', value: 'Captain Snack' }, b: { type: 'emoji', value: '🍿' } },
    ],
    pairsHard: [
      { pairId: 0, a: { type: 'text', value: 'Little Miss Cubit' }, b: { type: 'emoji', value: '🤏' } },
      { pairId: 1, a: { type: 'text', value: 'Sir Sleepyhead' }, b: { type: 'emoji', value: '😴' } },
      { pairId: 2, a: { type: 'text', value: 'Drama llama' }, b: { type: 'emoji', value: '🦙' } },
      { pairId: 3, a: { type: 'text', value: 'Main character' }, b: { type: 'emoji', value: '🎬' } },
      { pairId: 4, a: { type: 'text', value: 'Human heater' }, b: { type: 'emoji', value: '🔥' } },
      { pairId: 5, a: { type: 'text', value: 'Snack dealer' }, b: { type: 'emoji', value: '🍫' } },
      { pairId: 6, a: { type: 'text', value: 'Chaos CEO' }, b: { type: 'emoji', value: '📎' } },
      { pairId: 7, a: { type: 'text', value: 'Soft launch energy' }, b: { type: 'emoji', value: '☁️' } },
      { pairId: 8, a: { type: 'text', value: 'Tiny tornado' }, b: { type: 'emoji', value: '🌪️' } },
      { pairId: 9, a: { type: 'text', value: 'Professional overthinker' }, b: { type: 'emoji', value: '🧠' } },
      { pairId: 10, a: { type: 'text', value: 'Chief of "one more episode"' }, b: { type: 'emoji', value: '📺' } },
      { pairId: 11, a: { type: 'text', value: 'Hug accountant' }, b: { type: 'emoji', value: '📒' } },
      { pairId: 12, a: { type: 'text', value: 'Spicy marshmallow' }, b: { type: 'emoji', value: '🔥' } },
      { pairId: 13, a: { type: 'text', value: 'Baby duck energy' }, b: { type: 'emoji', value: '🦆' } },
      { pairId: 14, a: { type: 'text', value: 'Midnight philosopher' }, b: { type: 'emoji', value: '🌙' } },
      { pairId: 15, a: { type: 'text', value: 'Champion of "5 more minutes"' }, b: { type: 'emoji', value: '⏰' } },
      { pairId: 16, a: { type: 'text', value: 'Human sunshine tax' }, b: { type: 'emoji', value: '☀️' } },
      { pairId: 17, a: { type: 'text', value: 'CEO of "I forgot"' }, b: { type: 'emoji', value: '📝' } },
    ],
  },

  'inside-joke': {
    id: 'inside-joke',
    label: 'Inside joke pack',
    emoji: '🍩',
    description: 'Only you two get these',
    pairsEasy: [
      { pairId: 0, a: { type: 'text', value: 'Donat' }, b: { type: 'text', value: 'Jonathan' } },
      { pairId: 1, a: { type: 'text', value: 'That one bench' }, b: { type: 'text', value: 'First date' } },
      { pairId: 2, a: { type: 'text', value: 'Emergency ramen' }, b: { type: 'text', value: '2am craving' } },
      { pairId: 3, a: { type: 'text', value: 'The playlist' }, b: { type: 'text', value: 'Car karaoke' } },
      { pairId: 4, a: { type: 'text', value: 'Wrong exit' }, b: { type: 'text', value: 'Adventure' } },
      { pairId: 5, a: { type: 'text', value: 'Coupon never used' }, b: { type: 'text', value: 'Next week' } },
      { pairId: 6, a: { type: 'text', value: 'The look™' }, b: { type: 'text', value: 'You know' } },
      { pairId: 7, a: { type: 'text', value: 'Our song' }, b: { type: 'text', value: 'Skip intro' } },
    ],
    pairsHard: [
      { pairId: 0, a: { type: 'text', value: 'Donat' }, b: { type: 'text', value: 'Jonathan' } },
      { pairId: 1, a: { type: 'text', value: 'Plot twist dinner' }, b: { type: 'text', value: 'Spicy level 0' } },
      { pairId: 2, a: { type: 'text', value: 'Lost keys saga' }, b: { type: 'text', value: 'Couch cushions' } },
      { pairId: 3, a: { type: 'text', value: 'Airport sprint' }, b: { type: 'text', value: 'Gate changed' } },
      { pairId: 4, a: { type: 'text', value: 'Mystery bruise' }, b: { type: 'text', value: 'No idea' } },
      { pairId: 5, a: { type: 'text', value: 'Shared brain cell' }, b: { type: 'text', value: 'On loan' } },
      { pairId: 6, a: { type: 'text', value: 'Pizza math' }, b: { type: 'text', value: 'Always 8 slices' } },
      { pairId: 7, a: { type: 'text', value: 'Thermostat wars' }, b: { type: 'text', value: 'Sweater mode' } },
      { pairId: 8, a: { type: 'text', value: 'Backup alarm' }, b: { type: 'text', value: 'You snooze' } },
      { pairId: 9, a: { type: 'text', value: 'Grocery detour' }, b: { type: 'text', value: 'Aisle 7' } },
      { pairId: 10, a: { type: 'text', value: 'Pet name veto' }, b: { type: 'text', value: 'Round 3' } },
      { pairId: 11, a: { type: 'text', value: 'Photo retake' }, b: { type: 'text', value: 'One more' } },
      { pairId: 12, a: { type: 'text', value: 'Secret handshake' }, b: { type: 'text', value: 'Version 7' } },
      { pairId: 13, a: { type: 'text', value: 'Inside voice' }, b: { type: 'text', value: 'Not that inside' } },
      { pairId: 14, a: { type: 'text', value: 'Holiday tradition' }, b: { type: 'text', value: 'Chaos edition' } },
      { pairId: 15, a: { type: 'text', value: 'The receipt' }, b: { type: 'text', value: 'Proof' } },
      { pairId: 16, a: { type: 'text', value: 'Rain plan' }, b: { type: 'text', value: 'No plan' } },
      { pairId: 17, a: { type: 'text', value: 'Forever bit' }, b: { type: 'text', value: 'Still funny' } },
    ],
  },

  emoji: {
    id: 'emoji',
    label: 'Emoji pack',
    emoji: '🦐',
    description: 'Match the emoji to what it means for you two',
    pairsEasy: [
      { pairId: 0, a: { type: 'emoji', value: '🦐' }, b: { type: 'text', value: 'Tiny but mighty' } },
      { pairId: 1, a: { type: 'emoji', value: '🍩' }, b: { type: 'text', value: 'Sweet loop' } },
      { pairId: 2, a: { type: 'emoji', value: '💌' }, b: { type: 'text', value: 'Love note' } },
      { pairId: 3, a: { type: 'emoji', value: '🧋' }, b: { type: 'text', value: 'Date default' } },
      { pairId: 4, a: { type: 'emoji', value: '🎧' }, b: { type: 'text', value: 'Our vibe' } },
      { pairId: 5, a: { type: 'emoji', value: '🛋️' }, b: { type: 'text', value: 'Home' } },
      { pairId: 6, a: { type: 'emoji', value: '🌧️' }, b: { type: 'text', value: 'Cuddle weather' } },
      { pairId: 7, a: { type: 'emoji', value: '✈️' }, b: { type: 'text', value: 'Next trip' } },
    ],
    pairsHard: [
      { pairId: 0, a: { type: 'emoji', value: '🦐' }, b: { type: 'text', value: 'Shrimp era' } },
      { pairId: 1, a: { type: 'emoji', value: '🍩' }, b: { type: 'text', value: 'Donut pact' } },
      { pairId: 2, a: { type: 'emoji', value: '🦄' }, b: { type: 'text', value: 'Rare find' } },
      { pairId: 3, a: { type: 'emoji', value: '🧃' }, b: { type: 'text', value: 'Juice break' } },
      { pairId: 4, a: { type: 'emoji', value: '🎮' }, b: { type: 'text', value: 'Co-op life' } },
      { pairId: 5, a: { type: 'emoji', value: '🌮' }, b: { type: 'text', value: 'Taco Tuesday' } },
      { pairId: 6, a: { type: 'emoji', value: '🐧' }, b: { type: 'text', value: 'Waddle squad' } },
      { pairId: 7, a: { type: 'emoji', value: '🎟️' }, b: { type: 'text', value: 'Surprise tickets' } },
      { pairId: 8, a: { type: 'emoji', value: '🧦' }, b: { type: 'text', value: 'Matching socks' } },
      { pairId: 9, a: { type: 'emoji', value: '🍉' }, b: { type: 'text', value: 'Summer brain' } },
      { pairId: 10, a: { type: 'emoji', value: '🕯️' }, b: { type: 'text', value: 'Cozy night' } },
      { pairId: 11, a: { type: 'emoji', value: '🎡' }, b: { type: 'text', value: 'Fair date' } },
      { pairId: 12, a: { type: 'emoji', value: '🧭' }, b: { type: 'text', value: 'We got lost' } },
      { pairId: 13, a: { type: 'emoji', value: '🎂' }, b: { type: 'text', value: 'Candles wish' } },
      { pairId: 14, a: { type: 'emoji', value: '🛼' }, b: { type: 'text', value: 'Wobbly fun' } },
      { pairId: 15, a: { type: 'emoji', value: '🫧' }, b: { type: 'text', value: 'Bubble bath' } },
      { pairId: 16, a: { type: 'emoji', value: '🎸' }, b: { type: 'text', value: 'Serenade attempt' } },
      { pairId: 17, a: { type: 'emoji', value: '🧩' }, b: { type: 'text', value: 'We fit' } },
    ],
  },
};

export function getPackListForClient() {
  return Object.values(PACKS).map((p) => ({
    id: p.id,
    label: p.label,
    emoji: p.emoji,
    description: p.description,
  }));
}

export function getPairs(packId, gridSize) {
  const pack = PACKS[packId] || PACKS.nickname;
  const list = gridSize >= 6 ? pack.pairsHard : pack.pairsEasy;
  return list;
}
