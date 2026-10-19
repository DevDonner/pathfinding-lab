/**
 * The five search algorithms, each a pure function:
 *
 *     run(algo, grid) → Trace { steps, path, found }
 *
 * A Trace contains the *full* expansion order (`steps`, unique cells,
 * always starting at the start) and the final path (or null). The UI is
 * a playback machine over these arrays; nothing here touches a clock or
 * the DOM.
 *
 * Determinism contract: fixed neighbor order (N-E-S-W, see grid.ts),
 * mark-on-visit so every cell is expanded at most once, and stable
 * tie-breaks (insertion order) inside the heap. Same grid ⇒ identical
 * trace, always.
 *
 * Weight convention: BFS and DFS are unweighted (they count hops).
 * Greedy expands by Manhattan distance only, but still reports the
 * weighted cost of whatever path it found. Dijkstra and A* accumulate
 * weighted enter-costs (grid.weights).
 */
import { cost, isWall, manhattan, neighbors, type Grid } from './grid.ts'

export type AlgoId = 'bfs' | 'dfs' | 'greedy' | 'dijkstra' | 'astar'

/** Canonical lane order — this is the display order. */
export const ALGO_IDS: readonly AlgoId[] = ['bfs', 'dfs', 'greedy', 'dijkstra', 'astar']

export const ALGO_LABELS: Record<AlgoId, string> = {
  bfs: 'BFS',
  dfs: 'DFS',
  greedy: 'Greedy',
  dijkstra: 'Dijkstra',
  astar: 'A*',
}

export const ALGO_NOTES: Record<AlgoId, string> = {
  bfs: 'unweighted · wavefront in hops',
  dfs: 'unweighted · depth-first, blind',
  greedy: 'heuristic only · chases the goal',
  dijkstra: 'weighted · exact, no heuristic',
  astar: 'weighted · cost + Manhattan',
}

export interface Trace {
  algo: AlgoId
  /** Unique expansion order, starts with the start cell. */
  steps: number[]
  /** Path cells from start to goal, or null when not found. */
  path: number[] | null
  found: boolean
}

/**
 * Binary min-heap over (key, insertion order, cell). Ties break on
 * insertion order, which is what makes the expansion sequence
 * deterministic.
 */
class Heap {
  private keys: number[] = []
  private ties: number[] = []
  private cells: number[] = []
  private n = 0

  get size(): number {
    return this.n
  }

  push(key: number, cell: number): void {
    const tie = this.n++
    let i = this.n - 1
    this.keys.push(key)
    this.ties.push(tie)
    this.cells.push(cell)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (less(this.keys[i], this.ties[i], this.keys[p], this.ties[p])) {
        swapAll(this.keys, this.ties, this.cells, i, p)
        i = p
      } else break
    }
  }

  pop(): number | null {
    if (this.n === 0) return null
    const top = this.cells[0]
    this.n--
    if (this.n > 0) {
      this.keys[0] = this.keys[this.n]
      this.ties[0] = this.ties[this.n]
      this.cells[0] = this.cells[this.n]
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < this.n && less(this.keys[l], this.ties[l], this.keys[m], this.ties[m])) m = l
        if (r < this.n && less(this.keys[r], this.ties[r], this.keys[m], this.ties[m])) m = r
        if (m === i) break
        swapAll(this.keys, this.ties, this.cells, i, m)
        i = m
      }
    }
    this.keys.pop()
    this.ties.pop()
    this.cells.pop()
    return top
  }
}

function less(aKey: number, aTie: number, bKey: number, bTie: number): boolean {
  return aKey < bKey || (aKey === bKey && aTie < bTie)
}

function swapAll(a: number[], b: number[], c: number[], i: number, j: number): void {
  const t = a[i]
  a[i] = a[j]
  a[j] = t
  const u = b[i]
  b[i] = b[j]
  b[j] = u
  const v = c[i]
  c[i] = c[j]
  c[j] = v
}

/** Walk cameFrom back from the goal; null when the goal was never reached. */
function reconstruct(cameFrom: Int32Array, start: number, goal: number): number[] | null {
  if (cameFrom[goal] < 0) return null
  const path: number[] = []
  let cur = goal
  while (cur !== start) {
    path.push(cur)
    cur = cameFrom[cur]
  }
  path.push(start)
  path.reverse()
  return path
}

interface HeapResult {
  found: boolean
  steps: number[]
  cameFrom: Int32Array
}

/**
 * Shared loop for the priority-queue searches (greedy / dijkstra /
 * astar). `mode: 'first'` relaxes a neighbor only on first sighting
 * (greedy — the heuristic is static, so a re-relax could never help);
 * `mode: 'best'` relaxes whenever the new g is strictly better
 * (dijkstra / astar).
 */
function runHeapSearch(
  grid: Grid,
  mode: 'first' | 'best',
  score: (cell: number, g: number) => number,
): HeapResult {
  const size = grid.w * grid.h
  const cameFrom = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)
  const g = new Float64Array(size).fill(Infinity)
  const steps: number[] = []
  cameFrom[grid.start] = grid.start
  g[grid.start] = 0
  const heap = new Heap()
  heap.push(score(grid.start, 0), grid.start)

  while (heap.size > 0) {
    const cur = heap.pop()!
    if (closed[cur]) continue
    closed[cur] = 1
    steps.push(cur)
    if (cur === grid.goal) break

    for (const n of neighbors(grid, cur)) {
      if (isWall(grid, n) || closed[n]) continue
      const ng = g[cur] + cost(grid, n)
      const better = mode === 'first' ? cameFrom[n] === -1 : ng < g[n]
      if (!better) continue
      if (mode === 'best') g[n] = ng
      cameFrom[n] = cur
      heap.push(score(n, ng), n)
    }
  }
  return { found: closed[grid.goal] === 1, steps, cameFrom }
}

function toTrace(algo: AlgoId, grid: Grid, r: HeapResult): Trace {
  return {
    algo,
    steps: r.steps,
    path: r.found ? reconstruct(r.cameFrom, grid.start, grid.goal) : null,
    found: r.found,
  }
}

function bfs(grid: Grid): Trace {
  const size = grid.w * grid.h
  const cameFrom = new Int32Array(size).fill(-1)
  const queue: number[] = [grid.start]
  cameFrom[grid.start] = grid.start
  const steps: number[] = []
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    steps.push(cur)
    if (cur === grid.goal) break
    for (const n of neighbors(grid, cur)) {
      if (isWall(grid, n) || cameFrom[n] !== -1) continue
      cameFrom[n] = cur
      queue.push(n)
    }
  }
  const found = cameFrom[grid.goal] !== -1
  return { algo: 'bfs', steps, path: found ? reconstruct(cameFrom, grid.start, grid.goal) : null, found }
}

function dfs(grid: Grid): Trace {
  const size = grid.w * grid.h
  const cameFrom = new Int32Array(size).fill(-1)
  cameFrom[grid.start] = grid.start
  // Mark-on-push ⇒ every cell is pushed (and expanded) at most once.
  const stack: number[] = [grid.start]
  const steps: number[] = []
  while (stack.length > 0) {
    const cur = stack.pop()!
    steps.push(cur)
    if (cur === grid.goal) break
    const ns = neighbors(grid, cur)
    // Push in reverse so the first N-E-S-W neighbor is popped first.
    for (let k = ns.length - 1; k >= 0; k--) {
      const n = ns[k]
      if (isWall(grid, n) || cameFrom[n] !== -1) continue
      cameFrom[n] = cur
      stack.push(n)
    }
  }
  const found = cameFrom[grid.goal] !== -1
  return { algo: 'dfs', steps, path: found ? reconstruct(cameFrom, grid.start, grid.goal) : null, found }
}

function greedy(grid: Grid): Trace {
  const r = runHeapSearch(grid, 'first', (cell) => manhattan(grid, cell, grid.goal))
  return toTrace('greedy', grid, r)
}

function dijkstra(grid: Grid): Trace {
  const r = runHeapSearch(grid, 'best', (_cell, g) => g)
  return toTrace('dijkstra', grid, r)
}

function astar(grid: Grid): Trace {
  const r = runHeapSearch(grid, 'best', (cell, g) => g + manhattan(grid, cell, grid.goal))
  return toTrace('astar', grid, r)
}

export function run(algo: AlgoId, grid: Grid): Trace {
  switch (algo) {
    case 'bfs':
      return bfs(grid)
    case 'dfs':
      return dfs(grid)
    case 'greedy':
      return greedy(grid)
    case 'dijkstra':
      return dijkstra(grid)
    case 'astar':
      return astar(grid)
  }
}
