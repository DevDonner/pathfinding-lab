import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cloneGrid,
  inBounds,
  idx,
  isWall,
  manhattan,
  neighbors,
  toXY,
  type Grid,
} from '../src/lab/engine/grid.ts'

function blank(w: number, h: number): Grid {
  return {
    w,
    h,
    walls: new Uint8Array(w * h),
    weights: new Float64Array(w * h).fill(1),
    start: 0,
    goal: w * h - 1,
  }
}

test('idx / toXY round-trip', () => {
  const g = blank(7, 5)
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = idx(g, x, y)
      assert.equal(i, y * g.w + x)
      assert.deepEqual(toXY(g, i), { x, y })
    }
  }
})

test('inBounds is strict', () => {
  const g = blank(4, 3)
  assert.ok(inBounds(g, 0, 0))
  assert.ok(inBounds(g, 3, 2))
  assert.ok(!inBounds(g, -1, 0))
  assert.ok(!inBounds(g, 4, 0))
  assert.ok(!inBounds(g, 0, -1))
  assert.ok(!inBounds(g, 0, 3))
})

test('neighbors of a center cell are N, E, S, W', () => {
  const g = blank(3, 3)
  assert.deepEqual(neighbors(g, idx(g, 1, 1)), [1, 5, 7, 3])
})

test('neighbors of a corner cell are exactly the two in-bounds options', () => {
  const g = blank(4, 4)
  // top-left corner: only E and S
  assert.deepEqual(neighbors(g, 0), [1, 4])
  // bottom-right corner: only N and W
  const br = idx(g, 3, 3)
  assert.deepEqual(neighbors(g, br), [br - g.w, br - 1])
})

test('manhattan distance', () => {
  const g = blank(10, 10)
  assert.equal(manhattan(g, 0, 0), 0)
  assert.equal(manhattan(g, 0, 19), 10) // (0,0) → (9,1)
  assert.equal(manhattan(g, idx(g, 2, 3), idx(g, 5, 1)), 5)
})

test('isWall and weights', () => {
  const g = blank(3, 3)
  g.walls[4] = 1
  g.weights[4] = 4
  assert.ok(isWall(g, 4))
  assert.ok(!isWall(g, 0))
  assert.equal(g.weights[4], 4)
  assert.equal(g.weights[0], 1)
})

test('cloneGrid copies both arrays', () => {
  const g = blank(4, 4)
  const c = cloneGrid(g)
  c.walls[3] = 1
  c.weights[5] = 9
  c.start = 9
  assert.equal(g.walls[3], 0)
  assert.equal(g.weights[5], 1)
  assert.equal(g.start, 0)
  assert.equal(c.start, 9)
})
