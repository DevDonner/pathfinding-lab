import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ALGO_IDS, run, type Trace } from '../src/lab/engine/algorithms.ts'
import { isWall, neighbors, type Grid } from '../src/lab/engine/grid.ts'
import { makeMaze } from '../src/lab/engine/maze.ts'
import { pathCostOf } from '../src/lab/engine/metrics.ts'

/** Build a small hand-made grid. Coordinates are (x, y). */
function craft(
  w: number,
  h: number,
  start: number,
  goal: number,
  wallCoords: Array<[number, number]> = [],
  terrainCoords: Array<[number, number]> = [],
): Grid {
  const walls = new Uint8Array(w * h)
  const weights = new Float64Array(w * h).fill(1)
  for (const [x, y] of wallCoords) walls[y * w + x] = 1
  for (const [x, y] of terrainCoords) weights[y * w + x] = 4
  return { w, h, walls, weights, start, goal }
}

function assertValidPath(grid: Grid, path: number[]): void {
  assert.ok(path.length >= 2, 'path too short')
  assert.equal(path[0], grid.start)
  assert.equal(path[path.length - 1], grid.goal)
  for (const i of path) {
    assert.ok(i >= 0 && i < grid.w * grid.h, `path out of bounds: ${i}`)
    assert.equal(isWall(grid, i), false, `path crosses wall at ${i}`)
  }
  for (let k = 1; k < path.length; k++) {
    assert.ok(neighbors(grid, path[k - 1]).includes(path[k]), `step ${k} not adjacent: ${path[k - 1]} → ${path[k]}`)
  }
  assert.equal(new Set(path).size, path.length, 'path revisits a cell')
}

function assertTraceShape(grid: Grid, t: Trace): void {
  assert.ok(t.steps.length > 0)
  assert.equal(t.steps[0], grid.start, 'first step must be the start')
  assert.equal(new Set(t.steps).size, t.steps.length, 'duplicate visits in steps')
  for (const s of t.steps) {
    assert.ok(s >= 0 && s < grid.w * grid.h, `step out of bounds: ${s}`)
    assert.equal(isWall(grid, s), false, `expanded a wall at ${s}`)
  }
  if (t.found) {
    assert.ok(t.path, 'found but no path')
    assertValidPath(grid, t.path)
    assert.equal(t.steps[t.steps.length - 1], grid.goal, 'expansion should end at the goal')
  } else {
    assert.equal(t.path, null)
  }
}

const randomMazes = (n: number, terrain: boolean): Grid[] =>
  Array.from({ length: n }, (_, i) =>
    makeMaze({ seed: i * 101 + 3, w: 27, h: 15, wallDensity: 0.25, terrain }),
  )

const pathHops = (t: Trace): number => t.path!.length - 1

test('trace shape invariants hold on random mazes (all algorithms)', () => {
  for (const g of randomMazes(10, true)) {
    for (const algo of ALGO_IDS) {
      assertTraceShape(g, run(algo, g))
    }
  }
})

test('all five find the path when one exists', () => {
  for (const g of randomMazes(15, true)) {
    for (const algo of ALGO_IDS) {
      const t = run(algo, g)
      assert.equal(t.found, true, `${algo} failed to find an existing path`)
    }
  }
})

test('determinism: same grid produces identical traces', () => {
  const g = makeMaze({ seed: 77, w: 27, h: 15, wallDensity: 0.3, terrain: true })
  for (const algo of ALGO_IDS) {
    assert.deepEqual(run(algo, g), run(algo, g))
  }
})

test('determinism: same seed produces the same trace', () => {
  const a = makeMaze({ seed: 42, w: 17, h: 11, wallDensity: 0.2, terrain: false })
  const b = makeMaze({ seed: 42, w: 17, h: 11, wallDensity: 0.2, terrain: false })
  for (const algo of ALGO_IDS) {
    assert.deepEqual(run(algo, a), run(algo, b))
  }
})

test('on unweighted mazes BFS, Dijkstra and A* all agree (hops and cost)', () => {
  for (const g of randomMazes(10, false)) {
    const bfs = run('bfs', g)
    const dij = run('dijkstra', g)
    const ast = run('astar', g)
    const bfsHops = bfs.path!.length - 1
    assert.equal(pathHops(dij), bfsHops, 'dijkstra hops ≠ bfs hops')
    assert.equal(pathHops(ast), bfsHops, 'a* hops ≠ bfs hops')
    assert.equal(pathCostOf(g, dij.path!), bfsHops)
    assert.equal(pathCostOf(g, ast.path!), bfsHops)
  }
})

test('A* is cost-optimal on weighted (terrain) mazes', () => {
  for (const g of randomMazes(10, true)) {
    const dij = run('dijkstra', g)
    const ast = run('astar', g)
    assert.equal(pathCostOf(g, ast.path!), pathCostOf(g, dij.path!), 'a* cost ≠ dijkstra cost')
  }
})

const noPath = craft(
  5,
  5,
  10, // (0,2)
  14, // (4,2)
  [
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
  ],
)

test('no path: every algorithm reports not found', () => {
  for (const algo of ALGO_IDS) {
    const t = run(algo, noPath)
    assert.equal(t.found, false, `${algo} should not find a path`)
    assert.equal(t.path, null)
    // each still explored its whole reachable component
    assert.ok(t.steps.length > 0)
  }
})

// 4×3 U-shape: start (0,0), goal (0,2), wall at (0,1).
// Optimal: over the top via column 1 — 4 hops. DFS wanders the far
// corner first and only reaches the goal on the long way around.
const uShape = craft(
  4,
  3,
  0, // (0,0)
  8, // (0,2)
  [[0, 1]],
)

test('DFS is valid but suboptimal on the U-shape', () => {
  const bfs = run('bfs', uShape)
  const dfs = run('dfs', uShape)
  assert.equal(bfs.found, true)
  assert.equal(dfs.found, true)
  assertValidPath(uShape, dfs.path!)
  assert.equal(pathHops(bfs), 4)
  assert.ok(pathHops(dfs) > pathHops(bfs), `dfs hops ${pathHops(dfs)} should beat bfs ${pathHops(bfs)}`)
})

// 7×3: start (0,1), goal (6,1), one slow cell (weight 4) at (3,1).
// Straight across: 6 hops but cost 9. Around the top: 8 hops, cost 8.
const terrainStraight = craft(
  7,
  3,
  7, // (0,1)
  13, // (6,1)
  [],
  [[3, 1]],
)

test('terrain: BFS hugs the hops, Dijkstra/A* pay hops to save cost', () => {
  const bfs = run('bfs', terrainStraight)
  const dij = run('dijkstra', terrainStraight)
  const ast = run('astar', terrainStraight)
  assert.equal(pathHops(bfs), 6)
  assert.equal(pathCostOf(terrainStraight, bfs.path!), 9) // cuts through
  assert.equal(pathCostOf(terrainStraight, dij.path!), 8) // routes around
  assert.ok(pathHops(dij) > pathHops(bfs))
  assert.equal(pathCostOf(terrainStraight, ast.path!), 8)
})

test('greedy is cost-suboptimal across the terrain column', () => {
  const greedy = run('greedy', terrainStraight)
  const dij = run('dijkstra', terrainStraight)
  assert.equal(greedy.found, true)
  assertValidPath(terrainStraight, greedy.path!)
  const gCost = pathCostOf(terrainStraight, greedy.path!)
  const dCost = pathCostOf(terrainStraight, dij.path!)
  assert.ok(gCost > dCost, `greedy cost ${gCost} should exceed dijkstra cost ${dCost}`)
})
