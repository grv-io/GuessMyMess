// Curated word list for Skribbl game
const words = [
  // Animals
  "cat", "dog", "elephant", "giraffe", "penguin", "dolphin", "butterfly", "octopus",
  "kangaroo", "parrot", "turtle", "shark", "eagle", "snake", "rabbit", "lion",
  "monkey", "whale", "spider", "bear", "zebra", "fox", "owl", "frog", "dinosaur",

  // Food & Drinks
  "pizza", "hamburger", "sushi", "taco", "pancake", "donut", "ice cream", "watermelon",
  "banana", "cookie", "chocolate", "popcorn", "sandwich", "cupcake", "spaghetti",
  "french fries", "coffee", "lemonade", "cheese", "birthday cake",

  // Objects
  "umbrella", "guitar", "telescope", "microphone", "headphones", "camera", "balloon",
  "diamond", "crystal ball", "treasure chest", "compass", "hourglass", "lantern",
  "candle", "mirror", "key", "crown", "sword", "shield", "trophy",

  // Places & Nature
  "volcano", "waterfall", "lighthouse", "castle", "pyramid", "igloo", "island",
  "rainbow", "tornado", "mountain", "beach", "forest", "desert", "cave", "bridge",

  // Activities & Sports
  "surfing", "skateboarding", "basketball", "swimming", "fishing", "camping",
  "skiing", "bowling", "yoga", "karate", "dancing", "painting", "cycling",
  "skydiving", "archery",

  // Transportation
  "airplane", "helicopter", "submarine", "rocket", "sailboat", "motorcycle",
  "train", "hot air balloon", "spaceship", "school bus",

  // Household
  "television", "refrigerator", "washing machine", "bathtub", "alarm clock",
  "toaster", "lamp", "pillow", "bookshelf", "ladder",

  // Clothing & Accessories
  "sunglasses", "backpack", "boots", "scarf", "gloves", "helmet", "necktie",
  "dress", "sneakers", "wizard hat",

  // Fantasy & Fun
  "unicorn", "dragon", "ghost", "vampire", "mermaid", "alien", "robot",
  "pirate", "ninja", "superhero", "fairy", "zombie", "werewolf",

  // Body & People
  "brain", "skeleton", "muscle", "astronaut", "clown", "detective",
  "firefighter", "chef", "scientist", "artist",

  // Miscellaneous
  "boomerang", "trampoline", "fireworks", "puzzle", "magnet", "parachute",
  "snowflake", "tornado", "earthquake", "eclipse", "quicksand", "maze",
  "slingshot", "catapult", "anchor", "chain", "bubble", "kite", "dice",
  "domino", "yo-yo", "rubik's cube", "kaleidoscope", "dreamcatcher",

  // Technology
  "laptop", "smartphone", "satellite", "wifi", "battery", "keyboard",
  "printer", "drone", "virtual reality", "hologram",

  // Music
  "drums", "piano", "violin", "trumpet", "saxophone", "flute",
  "harmonica", "xylophone", "accordion", "banjo"
];

/**
 * Get N random unique words from the list
 * @param {number} count - Number of words to return
 * @returns {string[]} Array of random words
 */
function getRandomWords(count = 3) {
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Check if a guess is close to the actual word
 * @param {string} guess
 * @param {string} answer
 * @returns {boolean}
 */
function isCloseGuess(guess, answer) {
  const g = guess.toLowerCase().trim();
  const a = answer.toLowerCase().trim();

  if (g === a) return false; // exact match, not "close"
  if (g.length < 2) return false;

  // Check if one is contained in the other
  if (a.includes(g) || g.includes(a)) return true;

  // Levenshtein distance check
  const distance = levenshtein(g, a);
  const threshold = Math.max(1, Math.floor(a.length * 0.3));
  return distance <= threshold && distance > 0;
}

/**
 * Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
}

module.exports = { words, getRandomWords, isCloseGuess };
