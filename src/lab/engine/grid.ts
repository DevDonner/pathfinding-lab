/**
 * Grid model — row-major cells, walls + per-cell movement weights.
 *
 * Cost convention: `weights[i]` is the cost of *entering* cell i (open
 * cells cost 1, slow terrain costs more). The start cell costs nothing,
 * so a path's total cost is the sum of the weights of every cell after
 * the first. Walls are simply never entered.
 */
export interface Grid {
  w: number
  h: number
  /** 1 = wall, 0 = open. Row-major: index = y * w + x. */
  walls: Uint8Array
  /** Enter-cost per cell: 1 (open) or a slow-terrain weight (> 1). */
  weights: Float64Array
  /** Cell index of the start (column 0). */
  start: number
  /** Cell index of the goal (column w-1). */
  goal: number
}

export const idx = (grid: Grid, x: number, y: number): number => y * grid.w + x

export const toXY = (grid: Grid, i: number): { x: number; y: number } => ({
  x: i % grid.w,
  y: (i / grid.w) | 0,
})

export const inBounds = (grid: Grid, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < grid.w && y < grid.h

export const isWall = (grid: Grid, i: number): boolean => grid.walls[i] === 1

/** Enter-cost of a cell (callers must not call this on walls). */
export const cost = (grid: Grid, i: number): number => grid.weights[i]

/**
 * Neighbor order is fixed (N, E, S, W) so every algorithm's expansion
 * order — and therefore every trace — is fully deterministic.
 */
export const NEIGHBOR_DELTAS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: -1 }, // N
  { x: 1, y: 0 }, // E
  { x: 0, y: 1 }, // S
  { x: -1, y: 0 }, // W
]

/** In-bounds neighbors of a cell, in fixed N-E-S-W order (walls included — callers filter). */
export function neighbors(grid: Grid, i: number): number[] {
  const { x, y } = toXY(grid, i)
  const out: number[] = []
  for (const d of NEIGHBOR_DELTAS) {
    if (inBounds(grid, x + d.x, y + d.y)) out.push(idx(grid, x + d.x, y + d.y))
  }
  return out
}

/** Manhattan distance between two cells. */
export function manhattan(grid: Grid, a: number, b: number): number {
  const ax = a % grid.w
  const ay = (a / grid.w) | 0
  const bx = b % grid.w
  const by = (b / grid.w) | 0
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/** Cheap deep-ish clone for mutable edits (copies both arrays). */
export function cloneGrid(grid: Grid): Grid {
  return {
    w: grid.w,
    h: grid.h,
    walls: grid.walls.slice(),
    weights: grid.weights.slice(),
    start: grid.start,
    goal: grid.goal,
  }
}
