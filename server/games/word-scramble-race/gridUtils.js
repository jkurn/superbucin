// Weighted letters — slightly more vowels for playable boards
const LETTERS =
  'EEEEEEEEAAAAAAAIIIIIOOOOOUUUUNNNNRRRRSSTTTTTLLLDDGGGBBCCMMPPFFHHVVWWYYKKJJQQXXZZ';

export function randomGridSize() {
  return Math.random() < 0.5 ? 4 : 5;
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
  return grid;
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
