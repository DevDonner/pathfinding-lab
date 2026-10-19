import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSearch, defaultParams, DEFAULTS, parseUrl, type UrlParams } from '../src/lab/engine/urlState.ts'
import type { AlgoId } from '../src/lab/engine/algorithms.ts'

test('empty search yields defaults', () => {
  assert.deepEqual(parseUrl(''), defaultParams())
})

test('parses a full parameter set', () => {
  const p = parseUrl('?seed=42&size=s&wall=30&terrain=0&speed=5&algs=bfs,astar')
  assert.equal(p.seed, 42)
  assert.equal(p.size, 's')
  assert.equal(p.wall, 30)
  assert.equal(p.terrain, false)
  assert.equal(p.speed, 5)
  assert.deepEqual(p.algs, ['bfs', 'astar'])
})

test('invalid fields are dropped individually, never fatal', () => {
  const p = parseUrl('?seed=abc&size=x&wall=99&terrain=2&speed=0&algs=bogus')
  assert.deepEqual(p, defaultParams())
})

test('seed accepts only safe non-negative ints', () => {
  assert.equal(parseUrl('?seed=0').seed, 0)
  assert.equal(parseUrl('?seed=1048575').seed, 1048575)
  assert.equal(parseUrl('?seed=-1').seed, null)
  assert.equal(parseUrl('?seed=1.5').seed, null)
  assert.equal(parseUrl('?seed=99999999999999999999').seed, null)
})

test('algs keep canonical order and drop duplicates', () => {
  const p = parseUrl('?algs=astar,bfs,astar,greedy')
  assert.deepEqual(p.algs, ['bfs', 'greedy', 'astar'])
})

test('wall and speed are range-checked', () => {
  assert.equal(parseUrl('?wall=10').wall, 10)
  assert.equal(parseUrl('?wall=40').wall, 40)
  assert.equal(parseUrl('?wall=9').wall, DEFAULTS.wall)
  assert.equal(parseUrl('?wall=41').wall, DEFAULTS.wall)
  assert.equal(parseUrl('?speed=1').speed, 1)
  assert.equal(parseUrl('?speed=40').speed, 40)
  assert.equal(parseUrl('?speed=41').speed, DEFAULTS.speed)
})

test('buildSearch omits defaults (canonical form)', () => {
  assert.equal(buildSearch(defaultParams()), '')
  assert.equal(buildSearch({ ...defaultParams(), seed: 42 }), '?seed=42')
})

test('buildSearch includes only non-default fields', () => {
  const s = buildSearch({ ...defaultParams(), size: 'l', wall: 33, terrain: false, speed: 7 })
  assert.equal(s, '?size=l&wall=33&terrain=0&speed=7')
})

test('round-trip: parse(build(p)) === p', () => {
  const p: UrlParams = { ...defaultParams(), seed: 7, size: 's', wall: 12, terrain: false, speed: 3, algs: ['dfs', 'astar'] as AlgoId[] }
  assert.deepEqual(parseUrl(buildSearch(p)), p)
})
