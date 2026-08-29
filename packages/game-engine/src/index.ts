export type Cell = { x: number; y: number };

export type GridRound = {
  seed: number;
  color: "red" | "blue" | "green" | "yellow";
  start: Cell;
  target: Cell;
  hazards: Cell[];
};

function nextRandom(state: number): number {
  return (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
}

export function createRound(seed: number, round: number, cols = 8, rows = 5): GridRound {
  let state = (seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;
  const colors = ["red", "blue", "green", "yellow"] as const;
  const targetY = round % rows;
  const hazards: Cell[] = [];

  while (hazards.length < 5) {
    state = nextRandom(state);
    const x = 2 + (state % Math.max(1, cols - 3));
    state = nextRandom(state);
    const y = state % rows;
    if (y === targetY || hazards.some((cell) => cell.x === x && cell.y === y)) continue;
    hazards.push({ x, y });
  }

  return {
    seed,
    color: colors[round % colors.length],
    start: { x: 0, y: Math.floor(rows / 2) },
    target: { x: cols - 1, y: targetY },
    hazards,
  };
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function scorePath(path: Cell[], elapsedMs: number, combo: number): number {
  const efficiency = Math.max(0, 24 - path.length) * 25;
  const speed = Math.max(0, 20_000 - elapsedMs) / 40;
  return Math.round((500 + efficiency + speed) * Math.max(1, combo));
}

export function validatePath(path: Cell[], round: GridRound): boolean {
  if (path.length < 2) return false;
  if (path[0].x !== round.start.x || path[0].y !== round.start.y) return false;
  const end = path[path.length - 1];
  if (end.x !== round.target.x || end.y !== round.target.y) return false;

  const seen = new Set<string>();
  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    const key = `${cell.x}:${cell.y}`;
    if (seen.has(key)) return false;
    if (round.hazards.some((hazard) => hazard.x === cell.x && hazard.y === cell.y)) return false;
    if (index > 0 && !isAdjacent(path[index - 1], cell)) return false;
    seen.add(key);
  }
  return true;
}
