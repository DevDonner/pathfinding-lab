import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ALGO_IDS, run, type Trace } from '../src/lab/engine/algorithms.ts'
import { computeMetrics, pathCostOf } from '../src/lab/engine/metrics.ts'
import type { Grid } from '../src/lab/engine/grid.ts'
import { makeMaze } from '../src/lab/engine/maze.ts'

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

test('pathCostOf excludes the start cell and sums enter-costs', () => {
  // 3×1: start → terrain(4) → open
  const g = craft(3, 1, 0, 2, [], [[1, 0]])
  assert.equal(pathCostOf(g, [0, 1, 2]), 5) // 4 + 1
  assert.equal(pathCostOf(g, [0, 1]), 4)
})

// 7×3 with one slow cell (weight 4) at (3,1): straight = 6 hops /
// cost 9, around = 8 hops / cost 8.
const terrainGrid = craft(
  7,
  3,
  7,
  13,
  [],
  [[3, 1]],
)

function metricsFor(grid: Grid, algs = ALGO_IDS) {
  const traces = algs.map((a) => run(a, grid)) as Trace[]
  return { traces, m: computeMetrics(grid, traces) }
}

test('computeMetrics matches the reference implementations', () => {
  const { m } = metricsFor(terrainGrid)
  const by = (a: string) => m.find((x) => x.algo === a)!
  const dij = by('dijkstra')
  const bfs = by('bfs')
  const ast = by('astar')
  const greedy = by('greedy')
  const dfs = by('dfs')

  assert.equal(dij.pathCost, 8)
  assert.equal(bfs.pathHops, 6)
  assert.equal(bfs.pathCost, 9)
  assert.equal(ast.costOptimal, true)
  assert.equal(dij.costOptimal, true)
  assert.equal(bfs.costOptimal, false) // 9 > 8: BFS is unweighted
  assert.equal(greedy.costOptimal, false)
  assert.ok(dfs.costOptimal === false || dfs.costOptimal === true) // either, but computed
  for (const row of m) {
    assert.ok(row.visited > 0)
    assert.equal(row.found, true)
  }
})

test('metrics on a plain random maze: the optimal finders are all optimal', () => {
  const g = makeMaze({ seed: 9, w: 17, h: 11, wallDensity: 0.2, terrain: false })
  const { m } = metricsFor(g)
  for (const row of m) {
    if (row.algo === 'bfs' || row.algo === 'dijkstra' || row.algo === 'astar') {
      assert.equal(row.costOptimal, true, `${row.algo} should be cost-optimal without terrain`)
      assert.equal(row.hopsOptimal, true, `${row.algo} should be hop-optimal without terrain`)
    } else {
      // dfs/greedy: must still compute a boolean verdict, not null
      assert.ok(row.costOptimal === true || row.costOptimal === false)
    }
  }
})

const noPath = craft(
  5,
  5,
  10,
  14,
  [
    [2, 0],
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
  ],
)

test('no path: found=false, costs zero, optimal flags null', () => {
  const { m } = metricsFor(noPath)
  for (const row of m) {
    assert.equal(row.found, false)
    assert.equal(row.pathHops, 0)
    assert.equal(row.pathCost, 0)
    assert.equal(row.costOptimal, null)
    assert.equal(row.hopsOptimal, null)
    assert.ok(row.visited > 0)
  }
})

test('metrics keep the given (lane) order', () => {
  const g = makeMaze({ seed: 3, w: 17, h: 11, wallDensity: 0.2, terrain: true })
  const { m } = metricsFor(g, ['astar', 'bfs'])
  assert.deepEqual(m.map((r) => r.algo), ['astar', 'bfs'])
})
