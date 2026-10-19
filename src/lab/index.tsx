import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { meta } from './meta.ts'
import { run, type AlgoId, type Trace } from './engine/algorithms.ts'
import { cloneGrid, type Grid } from './engine/grid.ts'
import { makeMaze, TERRAIN_WEIGHT } from './engine/maze.ts'
import { computeMetrics } from './engine/metrics.ts'
import { randomSeed } from './engine/rng.ts'
import { buildSearch, parseUrl, SIZES, type UrlParams } from './engine/urlState.ts'
import { Controls, type PaintMode } from './ui/Controls.tsx'
import { Lane } from './ui/Lane.tsx'
import { ResultsTable } from './ui/ResultsTable.tsx'

/**
 * Pathfinding Lab root.
 *
 * Contract (portfolio LABS.md): default export, no props, fills its
 * container, imports only react + files in this folder.
 *
 * Playback model: every lane's full Trace is precomputed (pure engine),
 * and a single global `progress` counter is advanced by requestAnimationFrame
 * at `params.speed` steps/frame. Each lane renders steps[0..progress] plus
 * the path revealed afterwards — so all lanes stay in perfect lockstep and
 * the UI holds no per-lane animation state.
 *
 * Editing model: painting walls/terrain or dragging start/goal replaces the
 * grid (new object ⇒ traces recompute), resets progress, and pauses.
 */

export interface PathLabDebug {
  getState(): unknown
  setProgress(n: number): void
  play(): void
  pause(): void
  rerun(): void
  paint(x: number, y: number): void
}

declare global {
  interface Window {
    __PATHLAB__?: PathLabDebug
  }
}

export default function PathfindingLab() {
  // Canonicalize the URL on load: a shared seed is kept, otherwise a fresh
  // one is minted and written back so every load is shareable.
  const [params, setParams] = useState<UrlParams>(() => {
    const p = parseUrl(window.location.search)
    if (p.seed === null) {
      const np = { ...p, seed: randomSeed() }
      window.history.replaceState(null, '', buildSearch(np))
      return np
    }
    return p
  })

  const [grid, setGrid] = useState<Grid>(() =>
    makeMaze({
      seed: params.seed as number,
      w: SIZES[params.size].w,
      h: SIZES[params.size].h,
      wallDensity: params.wall / 100,
      terrain: params.terrain,
    }),
  )
  const [paintMode, setPaintMode] = useState<PaintMode>('wall')
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)

  const traces = useMemo<Trace[]>(() => params.algs.map((a) => run(a, grid)), [params.algs, grid])
  const metrics = useMemo(() => computeMetrics(grid, traces), [grid, traces])
  const laneLen = (t: Trace) => t.steps.length + (t.path?.length ?? 0)
  const maxNeeded = useMemo(() => Math.max(1, ...traces.map(laneLen)), [traces])
  const done = traces.map((t) => progress >= laneLen(t))
  const allDone = done.every(Boolean)
  const refCost = useMemo(() => {
    const dij = metrics.find((m) => m.algo === 'dijkstra')
    return dij?.found ? dij.pathCost : null
  }, [metrics])
  const winner = useMemo(() => {
    let best: AlgoId | null = null
    let bestVisited = Infinity
    for (const m of metrics) {
      if (m.found && m.costOptimal && m.visited < bestVisited) {
        bestVisited = m.visited
        best = m.algo
      }
    }
    return best
  }, [metrics])

  // Structural parameter change ⇒ fresh maze + fresh run (auto-plays).
  const structuralKey = [params.seed, params.size, params.wall, params.terrain].join(':')
  const firstStructural = useRef(true)
  useEffect(() => {
    if (firstStructural.current) {
      firstStructural.current = false
      return
    }
    setGrid(
      makeMaze({
        seed: params.seed as number,
        w: SIZES[params.size].w,
        h: SIZES[params.size].h,
        wallDensity: params.wall / 100,
        terrain: params.terrain,
      }),
    )
    setProgress(0)
    setPlaying(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey])

  // Playback loop: advance the global counter at `speed` steps per frame.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const step = () => {
      setProgress((p) => Math.min(p + params.speed, maxNeeded))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, params.speed, maxNeeded])

  useEffect(() => {
    if (progress >= maxNeeded) setPlaying(false)
  }, [progress, maxNeeded])

  // URL stays shareable as params change.
  useEffect(() => {
    window.history.replaceState(null, '', buildSearch(params))
  }, [params])

  const patchParams = useCallback((patch: Partial<UrlParams>) => {
    setParams((p) => ({ ...p, ...patch }))
  }, [])

  const rerun = useCallback(() => {
    setProgress(0)
    setPlaying(true)
  }, [])

  const newMaze = useCallback(() => {
    setParams((p) => ({ ...p, seed: randomSeed() }))
  }, [])

  const clearWalls = useCallback(() => {
    setGrid((g) => {
      const c = cloneGrid(g)
      c.walls.fill(0)
      return c
    })
    setProgress(0)
    setPlaying(false)
  }, [])

  const copyLink = useCallback(() => {
    const url = window.location.origin + window.location.pathname + buildSearch(params)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        },
        () => undefined,
      )
    }
  }, [params])

  // --- editing -----------------------------------------------------------
  const dragRef = useRef<{ mode: 'wall' | 'terrain' | 'start' | 'goal'; last: number }>({ mode: 'wall', last: -1 })

  const applyAt = useCallback((i: number) => {
      const mode = dragRef.current.mode
      if (i === dragRef.current.last) return
      dragRef.current.last = i
      setGrid((g) => {
        const c = cloneGrid(g)
        if (mode === 'wall') {
          if (i === c.start || i === c.goal) return g
          c.walls[i] ^= 1
        } else if (mode === 'terrain') {
          if (i === c.start || i === c.goal || c.walls[i] === 1) return g
          c.weights[i] = TERRAIN_WEIGHT
        } else if (mode === 'start') {
          if (c.walls[i] === 1) return g
          c.start = i
        } else {
          if (c.walls[i] === 1) return g
          c.goal = i
        }
        return c
      })
      setProgress(0)
      setPlaying(false)
    },
    [],
  )

  const onCell = useCallback(
    (x: number, y: number, phase: 'down' | 'move') => {
      const i = y * grid.w + x
      if (phase === 'down') {
        if (i === grid.start) dragRef.current.mode = 'start'
        else if (i === grid.goal) dragRef.current.mode = 'goal'
        else dragRef.current.mode = paintMode
        dragRef.current.last = -1
      }
      applyAt(i)
    },
    [grid, paintMode, applyAt],
  )

  // --- keyboard ----------------------------------------------------------
  const togglePlay = useCallback(() => {
    if (progress >= maxNeeded) {
      rerun()
      return
    }
    setPlaying((p) => !p)
  }, [progress, maxNeeded, rerun])

  const bumpSpeed = useCallback(
    (d: number) => {
      setParams((p) => ({ ...p, speed: Math.max(1, Math.min(40, p.speed + d)) }))
    },
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'r':
        case 'R':
          rerun()
          break
        case 'n':
        case 'N':
          newMaze()
          break
        case 'ArrowUp':
          e.preventDefault()
          bumpSpeed(2)
          break
        case 'ArrowDown':
          e.preventDefault()
          bumpSpeed(-2)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, rerun, newMaze, bumpSpeed])

  // --- debug seam --------------------------------------------------------
  useEffect(() => {
    window.__PATHLAB__ = {
      getState: () => ({
        params,
        grid: {
          w: grid.w,
          h: grid.h,
          start: grid.start,
          goal: grid.goal,
          walls: Array.from(grid.walls),
          weights: Array.from(grid.weights),
        },
        progress,
        playing,
        maxNeeded,
        traces: traces.map((t) => ({ algo: t.algo, steps: t.steps.length, found: t.found, path: t.path?.length ?? 0 })),
      }),
      setProgress: (n: number) => setProgress(Math.max(0, Math.min(Math.round(n), maxNeeded))),
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      rerun,
      paint: (x: number, y: number) => {
        dragRef.current.mode = 'wall'
        dragRef.current.last = -1
        applyAt(y * grid.w + x)
      },
    }
    return () => {
      delete window.__PATHLAB__
    }
  }, [params, grid, progress, playing, maxNeeded, traces, rerun, applyAt])

  const progressPct = Math.min(100, (progress / maxNeeded) * 100)

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 sm:p-4">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-edge pb-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-mono text-sm font-bold text-accent">{'>'}_</span>
          <h1 className="font-display text-sm font-semibold tracking-tight text-slate-100">{meta.title}</h1>
          <span className="hidden truncate text-xs text-mute lg:inline">— {meta.tagline}</span>
        </div>
        <div aria-hidden className="flex items-center gap-4 font-mono text-xs sm:text-sm">
          <span className="text-mute">seed {params.seed}</span>
          <span className={allDone ? 'text-accent' : playing ? 'text-amber-300' : 'text-mute'}>
            {allDone ? 'race complete' : playing ? 'running' : 'paused'}
          </span>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">
        {allDone ? 'Race complete.' : playing ? 'Race running.' : 'Race paused.'}
      </p>

      <Controls
        params={params}
        onPatch={patchParams}
        paintMode={paintMode}
        onPaintMode={setPaintMode}
        playing={playing}
        onTogglePlay={togglePlay}
        onRerun={rerun}
        onNewMaze={newMaze}
        onClearWalls={clearWalls}
        onCopyLink={copyLink}
        copied={copied}
      />

      {/* lanes */}
      <div className="flex flex-col gap-3">
        {params.algs.map((algo, i) => (
          <Lane
            key={algo}
            algo={algo}
            grid={grid}
            trace={traces[i]}
            progress={progress}
            size={params.size}
            playing={playing}
            done={done[i]}
            metrics={metrics[i]}
            onCell={onCell}
          />
        ))}
      </div>

      {/* progress + hints */}
      <div className="flex items-center gap-3 font-mono text-xs text-mute">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-edge">
          <div className="h-full bg-accent transition-[width] duration-75" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="hidden sm:inline">[space] play/pause · [r] rerun · [n] new maze · [↑/↓] speed · drag to paint · drag ● to move</span>
      </div>

      <ResultsTable metrics={metrics} done={done} refCost={refCost} winner={winner} />
    </div>
  )
}
