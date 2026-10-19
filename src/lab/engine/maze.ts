/**
 * Seeded maze generation.
 *
 * Start sits on the left edge, goal on the right. Walls are random cells
 * (never in the first/last column, so the endpoints are always reachable)
 * plus, optionally, a few slow-terrain rectangles (weight 4). If the
 * drawn maze turns out unreachable, the seed is bumped by 1 and it is
 * redrawn — deterministic from the original seed, bounded at 64 tries
 * (which is not reachable in practice at these densities).
 */
import { mulberry32 } from './rng.ts'
import { isWall, neighbors, type Grid } from './grid.ts'

export const TERRAIN_WEIGHT = 4
const MAX_RETRIES = 64

export interface MazeOptions {
  seed: number
  w: number
  h: number
  /** Fraction of interior cells drawn as walls (0..0.5). */
  wallDensity: number
  /** Draw a few slow-terrain rectangles (weight TERRAIN_WEIGHT). */
  terrain: boolean
}

export function makeMaze(opts: MazeOptions): Grid {
  let grid = draw({ ...opts, seed: opts.seed })
  for (let attempt = 1; attempt < MAX_RETRIES; attempt++) {
    if (reachable(grid, grid.start, grid.goal)) return grid
    grid = draw({ ...opts, seed: opts.seed + attempt })
  }
  return grid
}

/** True if `to` is reachable from `from` (plain unweighted BFS). */
export function reachable(grid: Grid, from: number, to: number): boolean {
  if (isWall(grid, from) || isWall(grid, to)) return false
  const seen = new Uint8Array(grid.w * grid.h)
  const queue: number[] = [from]
  seen[from] = 1
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    if (cur === to) return true
    for (const n of neighbors(grid, cur)) {
      if (!seen[n] && !isWall(grid, n)) {
        seen[n] = 1
        queue.push(n)
      }
    }
  }
  return false
}

function draw(opts: MazeOptions): Grid {
  const { w, h } = opts
  const rng = mulberry32(opts.seed >>> 0)
  const walls = new Uint8Array(w * h)
  const weights = new Float64Array(w * h).fill(1)

  const start = Math.floor(rng() * h) * w + 0
  const goal = Math.floor(rng() * h) * w + (w - 1)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || x === w - 1) continue // keep the endpoint columns open
      if (rng() < opts.wallDensity) walls[y * w + x] = 1
    }
  }

  if (opts.terrain) {
    const blobs = 2 + Math.floor(rng() * 2) // 2–3 rectangles
    for (let b = 0; b < blobs; b++) {
      const bw = 3 + Math.floor(rng() * 5) // 3..7 wide
      const bh = 2 + Math.floor(rng() * 4) // 2..5 tall
      const bx = 1 + Math.floor(rng() * Math.max(1, w - bw - 1))
      const by = Math.floor(rng() * Math.max(1, h - bh))
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const i = y * w + x
          if (!walls[i] && i !== start && i !== goal) weights[i] = TERRAIN_WEIGHT
        }
      }
    }
  }

  return { w, h, walls, weights, start, goal }
}
