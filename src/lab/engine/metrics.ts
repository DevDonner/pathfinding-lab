/**
 * Per-algorithm results, computed from traces on the *same* grid.
 *
 * Optimality references:
 *  - cost reference  = Dijkstra's path cost on this grid (exact, weighted)
 *  - hops reference  = BFS's path hops (exact, unweighted)
 *
 * When no path exists every algorithm reports found=false and the
 * optimal flags are null (not false — there is nothing to be optimal to).
 */
import { cost, type Grid } from './grid.ts'
import type { AlgoId, Trace } from './algorithms.ts'

export interface AlgoMetrics {
  algo: AlgoId
  /** Cells expanded (steps.length). */
  visited: number
  found: boolean
  /** path.length - 1 (0 when not found). */
  pathHops: number
  /** Sum of enter-costs along the path (0 when not found). */
  pathCost: number
  /** vs the Dijkstra reference; null when not found. */
  costOptimal: boolean | null
  /** vs the BFS reference; null when not found. */
  hopsOptimal: boolean | null
}

/** Total enter-cost of a path (start cell excluded, by cost convention). */
export function pathCostOf(grid: Grid, path: number[]): number {
  let c = 0
  for (let i = 1; i < path.length; i++) c += cost(grid, path[i])
  return c
}

/** Metrics for each trace, in the given (lane) order. */
export function computeMetrics(grid: Grid, traces: Trace[]): AlgoMetrics[] {
  const bfsT = traces.find((t) => t.algo === 'bfs')
  const dijT = traces.find((t) => t.algo === 'dijkstra')
  const refHops = bfsT?.found && bfsT.path ? bfsT.path.length - 1 : null
  const refCost = dijT?.found && dijT.path ? pathCostOf(grid, dijT.path) : null

  return traces.map((t) => {
    const found = t.found && t.path !== null
    const hops = found && t.path ? t.path.length - 1 : 0
    const cost = found && t.path ? pathCostOf(grid, t.path) : 0
    return {
      algo: t.algo,
      visited: t.steps.length,
      found,
      pathHops: hops,
      pathCost: cost,
      costOptimal: found && refCost !== null ? cost === refCost : null,
      hopsOptimal: found && refHops !== null ? hops === refHops : null,
    }
  })
}
