/**
 * mulberry32 — tiny deterministic PRNG (32-bit state, ~uniform doubles).
 * Same seed, same sequence, every environment. Used so a maze is
 * shareable via `?seed=N`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fresh seed from wall-clock ms, squeezed into a 31-bit positive int. */
export function randomSeed(): number {
  return (Date.now() ^ (Math.random() * 0x7fffffff)) & 0x7fffffff
}
