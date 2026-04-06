// Built-in question packs for Quiz Race
// Host can also supply custom questions via room creation

const PACKS = {
  couples: [
    { q: 'What would sayang rather eat for dinner?', a: ['Sushi', 'Pizza', 'Noodles', 'Salad'], correct: 0, category: 'food' },
    { q: 'Where would you most like to travel together?', a: ['Japan', 'Italy', 'Bali', 'Iceland'], correct: 0, category: 'travel' },
    { q: 'What is the best date night activity?', a: ['Movie', 'Cooking together', 'Stargazing', 'Board games'], correct: 1, category: 'dates' },
    { q: 'Which animal best represents your relationship?', a: ['Penguins', 'Otters', 'Swans', 'Cats'], correct: 1, category: 'fun' },
    { q: 'What song makes you think of each other?', a: ['A love ballad', 'An upbeat pop song', 'A classic rock anthem', 'Our inside joke song'], correct: 0, category: 'music' },
    { q: 'Best way to spend a rainy day?', a: ['Netflix & blankets', 'Cook something fancy', 'Read together', 'Nap all day'], correct: 0, category: 'dates' },
    { q: 'What superpower would help your relationship most?', a: ['Mind reading', 'Teleportation', 'Time control', 'Cooking mastery'], correct: 1, category: 'fun' },
    { q: 'Favorite shared snack?', a: ['Popcorn', 'Ice cream', 'Chips', 'Fruit'], correct: 1, category: 'food' },
    { q: 'Dream pet together?', a: ['Golden retriever', 'Cat', 'Bunny', 'No pets'], correct: 0, category: 'fun' },
    { q: 'Who falls asleep first?', a: ['Me', 'Sayang', 'Same time', 'Neither (insomnia gang)'], correct: 1, category: 'habits' },
    { q: 'Best couple Halloween costume?', a: ['Ketchup & Mustard', 'Mario & Luigi', 'Salt & Pepper', 'Matching pajamas'], correct: 0, category: 'fun' },
    { q: 'Ideal weekend morning?', a: ['Sleep in', 'Brunch out', 'Morning walk', 'Coffee & cuddles'], correct: 3, category: 'habits' },
    { q: 'What movie genre for movie night?', a: ['Comedy', 'Horror', 'Romance', 'Action'], correct: 0, category: 'dates' },
    { q: 'Most romantic gesture?', a: ['Surprise flowers', 'Handwritten letter', 'Cook their fav meal', 'Plan a trip'], correct: 2, category: 'dates' },
    { q: 'Who is the better cook?', a: ['Me obviously', 'Sayang for sure', 'We are equally bad', 'We order delivery'], correct: 1, category: 'food' },
  ],
  general: [
    { q: 'Which planet is closest to the Sun?', a: ['Mercury', 'Venus', 'Mars', 'Earth'], correct: 0, category: 'science' },
    { q: 'How many continents are there?', a: ['5', '6', '7', '8'], correct: 2, category: 'geography' },
    { q: 'What year did the iPhone first launch?', a: ['2005', '2006', '2007', '2008'], correct: 2, category: 'tech' },
    { q: 'Which ocean is the largest?', a: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correct: 2, category: 'geography' },
    { q: 'How many bones in the adult human body?', a: ['186', '196', '206', '216'], correct: 2, category: 'science' },
    { q: 'What is the capital of Australia?', a: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correct: 2, category: 'geography' },
    { q: 'Who painted the Mona Lisa?', a: ['Michelangelo', 'Da Vinci', 'Raphael', 'Donatello'], correct: 1, category: 'art' },
    { q: 'What is the smallest country in the world?', a: ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], correct: 1, category: 'geography' },
    { q: 'How many strings does a standard guitar have?', a: ['4', '5', '6', '7'], correct: 2, category: 'music' },
    { q: 'What element does O represent?', a: ['Gold', 'Oxygen', 'Osmium', 'Oganesson'], correct: 1, category: 'science' },
    { q: 'In what year did World War II end?', a: ['1943', '1944', '1945', '1946'], correct: 2, category: 'history' },
    { q: 'What is sushi traditionally wrapped in?', a: ['Rice paper', 'Seaweed', 'Banana leaf', 'Lettuce'], correct: 1, category: 'food' },
    { q: 'Which company created Android?', a: ['Apple', 'Google', 'Samsung', 'Microsoft'], correct: 1, category: 'tech' },
    { q: 'How many players on a soccer team?', a: ['9', '10', '11', '12'], correct: 2, category: 'sports' },
    { q: 'What is the hardest natural substance?', a: ['Gold', 'Iron', 'Diamond', 'Titanium'], correct: 2, category: 'science' },
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick questions for a quiz round.
 * @param {number} count
 * @param {object[]} [customQuestions] - Host-supplied questions
 * @param {string} [packId] - 'couples' or 'general'
 * @returns {object[]}
 */
export function pickQuestions(count, customQuestions, packId = 'couples') {
  let pool;

  if (customQuestions && customQuestions.length > 0) {
    pool = customQuestions.map((cq, i) => ({
      text: cq.q || cq.question || `Question ${i + 1}`,
      options: cq.a || cq.answers || ['A', 'B', 'C', 'D'],
      correct: typeof cq.correct === 'number' ? cq.correct : 0,
      category: cq.category || 'custom',
    }));
  } else {
    const pack = PACKS[packId] || PACKS.couples;
    pool = pack.map((q) => ({
      text: q.q,
      options: q.a,
      correct: q.correct,
      category: q.category,
    }));
  }

  return shuffle(pool).slice(0, count);
}

export const PACK_IDS = Object.keys(PACKS);
