import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeMaze, reachable, TERRAIN_WEIGHT, type MazeOptions } from '../src/lab/engine/maze.ts'
import { toXY } from '../src/lab/engine/grid.ts'

const base: MazeOptions = { seed: 7, w: 27, h: 15, wallDensity: 0.25, terrain: true }

test('same seed produces an identical maze', () => {
  const a = makeMaze(base)
  const b = makeMaze(base)
  assert.deepEqual(Array.from(a.walls), Array.from(b.walls))
  assert.deepEqual(Array.from(a.weights), Array.from(b.weights))
  assert.equal(a.start, b.start)
  assert.equal(a.goal, b.goal)
})

test('start is in column 0, goal in the last column, neither is a wall', () => {
  for (const seed of [1, 2, 3, 99, 1234]) {
    const g = makeMaze({ ...base, seed, terrain: false })
    assert.equal(toXY(g, g.start).x, 0)
    assert.equal(toXY(g, g.goal).x, g.w - 1)
    assert.equal(g.walls[g.start], 0)
    assert.equal(g.walls[g.goal], 0)
  }
})

test('the endpoint columns are always fully open', () => {
  const g = makeMaze({ ...base, wallDensity: 0.45 })
  for (let y = 0; y < g.h; y++) {
    assert.equal(g.walls[y * g.w + 0], 0)
    assert.equal(g.walls[y * g.w + (g.w - 1)], 0)
  }
})

test('zero density draws no walls (terrain aside)', () => {
  const g = makeMaze({ ...base, wallDensity: 0 })
  assert.equal(Array.from(g.walls).reduce((a, b) => a + b, 0), 0)
  for (let i = 0; i < g.w * g.h; i++) {
    assert.ok(g.weights[i] === 1 || g.weights[i] === TERRAIN_WEIGHT)
  }
})

test('makeMaze always yields a reachable maze across seeds and settings', () => {
  const sizes = [
    { w: 17, h: 11 },
    { w: 27, h: 15 },
    { w: 37, h: 21 },
  ]
  const densities = [0.1, 0.25, 0.4, 0.45]
  let count = 0
  for (const s of sizes) {
    for (const d of densities) {
      for (const terrain of [true, false]) {
        for (let seed = 0; seed < 8; seed++) {
          const g = makeMaze({ seed, w: s.w, h: s.h, wallDensity: d, terrain })
          assert.ok(reachable(g, g.start, g.goal), `unreachable: seed=${seed} ${s.w}x${s.h} d=${d}`)
          count++
        }
      }
    }
  }
  assert.equal(count, sizes.length * densities.length * 2 * 8)
})

test('different seeds give different mazes (almost surely)', () => {
  const a = makeMaze(base)
  const b = makeMaze({ ...base, seed: 8 })
  assert.notDeepEqual(Array.from(a.walls), Array.from(b.walls))
})

test('terrain weights never land on walls or the endpoints', () => {
  for (const seed of [1, 5, 42]) {
    const g = makeMaze({ ...base, seed, terrain: true })
    for (let i = 0; i < g.w * g.h; i++) {
      if (g.weights[i] === TERRAIN_WEIGHT) {
        assert.equal(g.walls[i], 0)
        assert.notEqual(i, g.start)
        assert.notEqual(i, g.goal)
      }
    }
  }
})

test('reachable() is false across a full wall line', () => {
  const w = 5
  const h = 5
  const walls = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) walls[y * w + 2] = 1
  const g = {
    w,
    h,
    walls,
    weights: new Float64Array(w * h).fill(1),
    start: 2 * w + 0,
    goal: 2 * w + 4,
  }
  assert.ok(!reachable(g, g.start, g.goal))
  assert.ok(reachable(g, g.start, 2 * w + 1))
})
