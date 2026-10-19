/**
 * Results table — rows light up as lanes finish.
 *
 * Verdicts: NO PATH (red) / OPTIMAL (accent, ⚡ on the fewest-visited
 * optimal runner) / suboptimal (amber, with the cost penalty Δ).
 */
import { ALGO_LABELS, ALGO_NOTES, type AlgoId } from '../engine/algorithms.ts'
import type { AlgoMetrics } from '../engine/metrics.ts'

interface ResultsTableProps {
  metrics: AlgoMetrics[]
  /** Per-lane completion, aligned with `metrics`. */
  done: boolean[]
  /** Dijkstra reference cost on this grid (null when no path exists). */
  refCost: number | null
  /** The cost-optimal lane with the fewest visits, if any. */
  winner: AlgoId | null
}

export function ResultsTable({ metrics, done, refCost, winner }: ResultsTableProps) {
  return (
    <section className="rounded-lg border border-edge bg-surface">
      <h2 className="border-b border-edge px-3 py-2 font-mono text-xs uppercase tracking-widest text-mute">results</h2>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-left text-mute">
              <th className="px-3 py-2 font-normal">algorithm</th>
              <th className="px-3 py-2 font-normal">visited</th>
              <th className="px-3 py-2 font-normal">hops</th>
              <th className="px-3 py-2 font-normal">cost</th>
              <th className="px-3 py-2 font-normal">verdict</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => {
              const isDone = done[i]
              const dPenalty = refCost !== null && m.pathCost > refCost ? m.pathCost - refCost : 0
              return (
                <tr key={m.algo} className={`border-t border-edge/60 ${winner === m.algo ? 'bg-accent/5' : ''}`}>
                  <td className="px-3 py-2">
                    <span className="font-bold text-slate-100">{ALGO_LABELS[m.algo]}</span>
                    <span className="ml-2 hidden text-mute sm:inline">{ALGO_NOTES[m.algo]}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{isDone ? m.visited : '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{isDone && m.found ? m.pathHops : '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{isDone && m.found ? m.pathCost : '—'}</td>
                  <td className="px-3 py-2">
                    {!isDone ? (
                      <span className="text-mute">…</span>
                    ) : !m.found ? (
                      <span className="text-red-400">NO PATH</span>
                    ) : m.costOptimal ? (
                      <span className="text-accent">
                        OPTIMAL{winner === m.algo ? ' ⚡' : ''}
                      </span>
                    ) : (
                      <span className="text-amber-300">suboptimal +{dPenalty}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
