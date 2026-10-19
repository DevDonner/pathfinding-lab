/**
 * Shareable URL state — pure parse/build over `location.search`.
 *
 * Contract (same as the other labs): invalid fields are dropped
 * individually, never fatal. Canonical form omits every default, so a
 * plain share looks like `?seed=8241`.
 *
 *   ?seed=N & size=s|m|l & wall=10..40 & terrain=0|1 & speed=1..40
 *   & algs=bfs,dfs,greedy,dijkstra,astar   (canonical order, subset)
 */
import { ALGO_IDS, type AlgoId } from './algorithms.ts'

export const SIZES = {
  s: { w: 17, h: 11 },
  m: { w: 27, h: 15 },
  l: { w: 37, h: 21 },
} as const
export type SizeId = keyof typeof SIZES

export interface UrlParams {
  /** Shared seed, or null for "generate a new one". */
  seed: number | null
  size: SizeId
  /** Wall density in percent (10..40). */
  wall: number
  /** Slow-terrain rectangles on/off. */
  terrain: boolean
  /** Playback speed in steps per frame (1..40). */
  speed: number
  /** Enabled algorithms in lane order. */
  algs: AlgoId[]
}

export const DEFAULTS = {
  size: 'm' as SizeId,
  wall: 24,
  terrain: true,
  speed: 12,
}

export function defaultParams(): UrlParams {
  return { ...DEFAULTS, seed: null, algs: [...ALGO_IDS] as AlgoId[] }
}

export function parseUrl(search: string): UrlParams {
  const p = defaultParams()
  const q = new URLSearchParams(search)

  const s = q.get('seed')
  if (s !== null && /^\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isSafeInteger(n) && n >= 0 && n < 2 ** 31) p.seed = n
  }

  const size = q.get('size')
  if (size === 's' || size === 'm' || size === 'l') p.size = size

  const wall = Number(q.get('wall'))
  if (Number.isInteger(wall) && wall >= 10 && wall <= 40) p.wall = wall

  const terrain = q.get('terrain')
  if (terrain === '0') p.terrain = false
  else if (terrain === '1') p.terrain = true

  const speed = Number(q.get('speed'))
  if (Number.isInteger(speed) && speed >= 1 && speed <= 40) p.speed = speed

  const algsRaw = q.get('algs')
  if (algsRaw !== null) {
    const set = new Set(algsRaw.split(',').filter((a): a is AlgoId => (ALGO_IDS as readonly string[]).includes(a)))
    const algs = (ALGO_IDS.filter((a) => set.has(a)) as AlgoId[])
    if (algs.length > 0) p.algs = algs
  }
  return p
}

/** Canonical search string for the params (no trailing `?`). */
export function buildSearch(p: UrlParams): string {
  const q = new URLSearchParams()
  if (p.seed !== null) q.set('seed', String(p.seed))
  if (p.size !== DEFAULTS.size) q.set('size', p.size)
  if (p.wall !== DEFAULTS.wall) q.set('wall', String(p.wall))
  if (p.terrain !== DEFAULTS.terrain) q.set('terrain', p.terrain ? '1' : '0')
  if (p.speed !== DEFAULTS.speed) q.set('speed', String(p.speed))
  const canonicalAlgs = ALGO_IDS.every((a, i) => p.algs[i] === a)
  if (p.algs.length > 0 && !canonicalAlgs) q.set('algs', p.algs.join(','))
  const s = q.toString()
  return s ? `?${s}` : ''
}
