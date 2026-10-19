/**
 * One race lane: a canvas that plays back a precomputed Trace.
 *
 * The lane is a pure function of (grid, trace, progress) — it redraws
 * when any of them change and owns no animation state. Playback cadence
 * is driven by the parent's global progress counter, so all lanes stay
 * in lockstep.
 */
import { useEffect, useRef, type PointerEvent } from 'react'
import { ALGO_LABELS, ALGO_NOTES, type AlgoId, type Trace } from '../engine/algorithms.ts'
import type { Grid } from '../engine/grid.ts'
import { isWall } from '../engine/grid.ts'
import type { AlgoMetrics } from '../engine/metrics.ts'
import type { SizeId } from '../engine/urlState.ts'

// Logical canvas pixel size per grid size.
const CELL: Record<SizeId, number> = { s: 22, m: 13, l: 9 }

// Drawn palette (canvas-only — never referenced from CSS, so nothing
// leaks into the host theme).
const C = {
  open: '#0e1622',
  wall: '#3b4f6b',
  terrain: '#4a3a22',
  visited: 'rgba(94, 234, 212, 0.16)',
  head: '#fbbf24',
  path: '#5eead4',
  start: '#4ade80',
  goal: '#f472b6',
}

interface LaneProps {
  algo: AlgoId
  grid: Grid
  trace: Trace
  /** Global playback counter (steps played). */
  progress: number
  size: SizeId
  playing: boolean
  done: boolean
  metrics: AlgoMetrics | null
  onCell: (x: number, y: number, phase: 'down' | 'move') => void
}

export function Lane({ algo, grid, trace, progress, size, playing, done, metrics, onCell }: LaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellPx = CELL[size]
  const w = grid.w
  const h = grid.h

  const visitedCount = Math.min(progress, trace.steps.length)
  const pathReveal = trace.path ? Math.max(0, Math.min(progress - trace.steps.length, trace.path.length)) : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = w * cellPx
    const H = h * cellPx
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const inset = Math.max(0.75, cellPx * 0.09)
    const px = (x: number) => x * cellPx + inset
    const pxs = cellPx - inset * 2

    // Base cells.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        ctx.fillStyle = isWall(grid, i) ? C.wall : grid.weights[i] > 1 ? C.terrain : C.open
        ctx.fillRect(px(x), px(y), pxs, pxs)
      }
    }

    // Visited wavefront.
    if (visitedCount > 0) {
      ctx.fillStyle = C.visited
      for (let k = 0; k < visitedCount; k++) {
        const i = trace.steps[k]
        ctx.fillRect(px(i % w), px((i / w) | 0), pxs, pxs)
      }
    }

    // Revealed path.
    if (pathReveal > 0 && trace.path) {
      ctx.fillStyle = C.path
      for (let k = 0; k < pathReveal; k++) {
        const i = trace.path[k]
        ctx.fillRect(px(i % w), px((i / w) | 0), pxs, pxs)
      }
    }

    // The head — the most recently expanded cell (the goal while the
    // path reveals, which reads as "arrived").
    if (!done && visitedCount > 0) {
      const head = trace.steps[visitedCount - 1]
      ctx.fillStyle = C.head
      ctx.fillRect(px(head % w), px((head / w) | 0), pxs, pxs)
    }

    // Endpoints on top.
    const dot = (i: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc((i % w) * cellPx + cellPx / 2, ((i / w) | 0) * cellPx + cellPx / 2, cellPx * 0.32, 0, Math.PI * 2)
      ctx.fill()
    }
    dot(grid.start, C.start)
    dot(grid.goal, C.goal)
  }, [grid, trace, visitedCount, pathReveal, done, cellPx, w, h])

  const cellFromEvent = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * w)))
    const y = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * h)))
    return { x, y }
  }

  return (
    <section className="rounded-lg border border-edge bg-surface p-2 sm:p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-xs">
        <span className="text-sm font-bold tracking-wide text-accent">{ALGO_LABELS[algo]}</span>
        <span className="hidden text-mute sm:inline">{ALGO_NOTES[algo]}</span>
        <span className={done ? (metrics?.found ? 'text-accent' : 'text-red-400') : playing ? 'text-amber-300' : 'text-mute'}>
          {done
            ? metrics?.found
              ? `${metrics.visited} visited · ${metrics.pathHops} hops · cost ${metrics.pathCost} · ${metrics.costOptimal ? 'OPTIMAL' : 'suboptimal'}`
              : 'NO PATH'
            : playing
              ? `expanding… ${visitedCount}/${trace.steps.length}`
              : `paused at ${visitedCount}`}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${ALGO_LABELS[algo]} search on the shared maze`}
        className="block w-full cursor-crosshair touch-none rounded"
        style={{ maxWidth: w * cellPx }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const { x, y } = cellFromEvent(e)
          onCell(x, y, 'down')
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          const { x, y } = cellFromEvent(e)
          onCell(x, y, 'move')
        }}
      />
    </section>
  )
}
