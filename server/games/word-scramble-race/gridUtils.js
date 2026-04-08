// Weighted letters — slightly more vowels for playable boards
const LETTERS =
  'EEEEEEEEAAAAAAAIIIIIOOOOOUUUUNNNNRRRRSSTTTTTLLLDDGGGBBCCMMPPFFHHVVWWYYKKJJQQXXZZ';

const GUARANTEED_WORD_BANK = [
  'LOVE',
  'HEART',
  'HUG',
  'KISS',
  'SMILE',
  'SPARK',
  'BLOOM',
  'SWEET',
];

export function randomGridSize() {
  return Math.random() < 0.5 ? 4 : 6;
}

export function generateGrid(size) {
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    }
    grid.push(row);
  }
  embedGuaranteedWords(grid, size);
  return grid;
}

function neighbors(size, r, c, blocked) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const key = `${nr},${nc}`;
      if (blocked.has(key)) continue;
      out.push({ r: nr, c: nc });
    }
  }
  // Shuffle for better variety.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function findPath(size, len, occupied) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const start = { r: Math.floor(Math.random() * size), c: Math.floor(Math.random() * size) };
    const startKey = `${start.r},${start.c}`;
    if (occupied.has(startKey)) continue;

    const path = [start];
    const used = new Set([startKey]);

    const dfs = () => {
      if (path.length === len) return true;
      const cur = path[path.length - 1];
      const blocked = new Set([...occupied, ...used]);
      const nextCells = neighbors(size, cur.r, cur.c, blocked);
      for (const nxt of nextCells) {
        const key = `${nxt.r},${nxt.c}`;
        used.add(key);
        path.push(nxt);
        if (dfs()) return true;
        path.pop();
        used.delete(key);
      }
      return false;
    };
    if (dfs()) return path;
  }
  return null;
}

function embedGuaranteedWords(grid, size) {
  const occupied = new Set();
  const wordsNeeded = size >= 6 ? 3 : 2;
  const candidates = GUARANTEED_WORD_BANK.filter((w) => w.length <= size + 1);

  let placed = 0;
  while (placed < wordsNeeded && candidates.length) {
    const idx = Math.floor(Math.random() * candidates.length);
    const word = candidates.splice(idx, 1)[0];
    const path = findPath(size, word.length, occupied);
    if (!path) continue;
    path.forEach((p, i) => {
      grid[p.r][p.c] = word[i];
      occupied.add(`${p.r},${p.c}`);
    });
    placed += 1;
  }
}

/**
 * @param {string[][]} grid
 * @param {{ r: number, c: number }[]} path
 * @returns {{ ok: boolean, word?: string, reason?: string }}
 */
export function pathToWord(grid, path) {
  if (!path || path.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const { r, c } = path[i];
    if (!Number.isInteger(r) || !Number.isInteger(c)) {
      return { ok: false, reason: 'bad_cell' };
    }
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return { ok: false, reason: 'out_of_bounds' };
    }
    const key = `${r},${c}`;
    if (seen.has(key)) {
      return { ok: false, reason: 'reuse' };
    }
    seen.add(key);

    if (i > 0) {
      const pr = path[i - 1].r;
      const pc = path[i - 1].c;
      const dr = Math.abs(r - pr);
      const dc = Math.abs(c - pc);
      if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
        return { ok: false, reason: 'not_adjacent' };
      }
    }
  }

  const word = path.map((p) => grid[p.r][p.c]).join('').toLowerCase();
  return { ok: true, word };
}

export function basePointsForLength(len) {
  if (len <= 2) return 0;
  if (len === 3) return 1;
  if (len === 4) return 3;
  if (len === 5) return 5;
  return 10;
}
