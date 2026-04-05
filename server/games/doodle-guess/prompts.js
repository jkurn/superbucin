// Word packs (Draw Something–style). Host picks one in lobby; custom lines merge on top (except "custom only").

/** @type {Record<string, { name: string, emoji: string, prompts: string[] }>} */
export const DOODLE_PACKS_BY_ID = {
  couples: {
    name: 'Love & us',
    emoji: '💕',
    prompts: [
      'First date spot',
      'Our song',
      'Favorite shared meal',
      'Inside joke (no words!)',
      'Where we met',
      'Dream vacation together',
      'Movie night snack',
      'Anniversary tradition',
      'Pet name for you',
      'Your laugh',
      'Coffee order',
      'Comfort food',
      'Lazy Sunday',
      'Beach day',
      'Rainy day cuddles',
      'Birthday surprise',
      'Valentine memory',
      'Road trip',
      'Sunset spot',
      'Dance move',
      'Selfie pose',
      'Good morning text vibe',
      'Good night ritual',
      'Favorite emoji energy',
      'Our aesthetic',
      'Couple hobby',
      'Picnic',
      'Stargazing',
      'Sayang',
      'Bubu',
      'Babe',
      'Honey',
      'Sweetheart',
      'Lovebug',
      'Sunshine',
      'Moonbeam',
      'Pumpkin',
      'Muffin',
      'Snuggle bear',
      'Cutie pie',
      'Starshine',
      'Buttercup',
      'Jellybean',
      'Cuddle muffin',
      'Dreamboat',
      'Heart stealer',
      'Little spoon',
      'Big spoon',
      'Chaos gremlin',
      'Soft potato',
      'Noodle',
      'Bean',
      'Peach',
      'Cherry',
      'Gem',
      'Treasure',
    ],
  },

  animals: {
    name: 'Animals',
    emoji: '🐾',
    prompts: [
      'Cat', 'Dog', 'Elephant', 'Penguin', 'Octopus', 'Butterfly',
      'Dinosaur', 'Fish', 'Bird', 'Rabbit', 'Frog', 'Tiger',
      'Giraffe', 'Whale', 'Snail', 'Bee', 'Owl', 'Koala',
      'Fox', 'Pig', 'Chicken', 'Horse', 'Monkey', 'Turtle',
      'Crab', 'Duck', 'Sheep', 'Lion', 'Panda', 'Shark',
      'Flamingo', 'Sloth', 'Hedgehog', 'Peacock', 'Bat', 'Mouse',
      'Seal', 'Crocodile', 'Kangaroo', 'Llama', 'Raccoon', 'Swan',
    ],
  },

  food: {
    name: 'Food & drinks',
    emoji: '🍕',
    prompts: [
      'Pizza', 'Sushi', 'Burger', 'Ice cream', 'Ramen', 'Taco',
      'Coffee', 'Bubble tea', 'Birthday cake', 'Hot dog', 'Donut',
      'Spaghetti', 'Salad', 'Fried rice', 'Steak', 'Soup', 'Sandwich',
      'Pancakes', 'Waffle', 'Popcorn', 'Chocolate', 'Fruit bowl',
      'Noodles', 'Curry', 'Dim sum', 'Croissant', 'Pie', 'Milkshake',
      'BBQ', 'Corn on the cob', 'Avocado toast', 'Cereal', 'Omelette',
      'French fries', 'Apple', 'Banana', 'Watermelon', 'Coconut drink',
    ],
  },

  actions: {
    name: 'Actions & verbs',
    emoji: '🏃',
    prompts: [
      'Running', 'Sleeping', 'Dancing', 'Swimming', 'Cooking', 'Reading',
      'Singing', 'Crying', 'Laughing', 'Hugging', 'Kissing', 'Fighting',
      'Flying', 'Falling', 'Jumping', 'Climbing', 'Driving', 'Shopping',
      'Studying', 'Gaming', 'Yoga', 'Skating', 'Skiing', 'Surfing',
      'Fishing', 'Camping', 'Painting', 'Photographing', 'Texting',
      'Calling', 'Waiting', 'Hiding', 'Surprise party', 'Proposing',
      'Wedding dance', 'Birthday blow', 'Thumb war', 'Arm wrestling',
    ],
  },

  places: {
    name: 'Places',
    emoji: '🌍',
    prompts: [
      'Beach', 'Mountain', 'Desert', 'Forest', 'City skyline', 'Castle',
      'Airport', 'Hospital', 'School', 'Library', 'Museum', 'Zoo',
      'Farm', 'Island', 'Volcano', 'Waterfall', 'Bridge', 'Tunnel',
      'Carnival', 'Haunted house', 'Igloo', 'Lighthouse', 'Pyramid',
      'Space station', 'Submarine', 'Treehouse', 'Camping tent',
      'Amusement park', 'Skating rink', 'Stadium', 'Temple', 'Cafe',
      'Bookstore', 'Gym', 'Spa', 'Rooftop', 'Highway', 'Harbor',
    ],
  },

  movies_vibes: {
    name: 'Movies & vibes',
    emoji: '🎬',
    prompts: [
      'Superhero', 'Wizard', 'Zombie', 'Robot', 'Princess', 'Knight',
      'Detective', 'Alien', 'Ghost', 'Vampire', 'Pirate', 'Ninja',
      'Time travel', 'Car chase', 'Heist', 'Horror night', 'Romcom moment',
      'Cartoon character', 'Sci-fi city', 'Wild west', 'Medieval battle',
      'Red carpet', 'Oscar speech', 'Popcorn bucket', '3D glasses',
      'Cliffhanger', 'Plot twist', 'End credits', 'Movie marathon',
      'Karaoke scene', 'Concert crowd', 'Music video', 'Stage fright',
    ],
  },

  objects: {
    name: 'Random objects',
    emoji: '🎲',
    prompts: [
      'Umbrella', 'Bicycle', 'Guitar', 'Phone', 'Laptop', 'Camera',
      'Clock', 'Mirror', 'Key', 'Light bulb', 'Rocket', 'Diamond',
      'Crown', 'Sword', 'Shield', 'Treasure chest', 'Balloon', 'Gift box',
      'Rocket ship', 'Telescope', 'Microscope', 'Paintbrush', 'Pencil',
      'Scissors', 'Hammer', 'Wrench', 'Plant pot', 'Candle', 'Fireworks',
      'Snowman', 'Kite', 'Yo-yo', 'Dice', 'Jigsaw puzzle', 'Rubiks cube',
      'Headphones', 'Suitcase', 'Backpack', 'Helmet', 'Skateboard',
    ],
  },

  /** Only lines from the host textarea; if empty, server falls back to Love & us prompts */
  custom: {
    name: 'Custom only',
    emoji: '✨',
    prompts: [],
  },
};

export const DEFAULT_DOODLE_PACK_ID = 'couples';

export function resolveDoodlePackId(packId) {
  if (packId && DOODLE_PACKS_BY_ID[packId]) return packId;
  return DEFAULT_DOODLE_PACK_ID;
}

export function getDoodlePackPrompts(packId) {
  const id = resolveDoodlePackId(packId);
  const prompts = DOODLE_PACKS_BY_ID[id]?.prompts;
  if (!prompts || prompts.length === 0) return [];
  return [...prompts];
}

export function getDoodlePacksMeta() {
  return Object.entries(DOODLE_PACKS_BY_ID).map(([id, v]) => ({
    id,
    name: v.name,
    emoji: v.emoji,
  }));
}

/** @deprecated use getDoodlePackPrompts(DEFAULT_DOODLE_PACK_ID) */
export const DEFAULT_DOODLE_PROMPTS = DOODLE_PACKS_BY_ID.couples.prompts;
