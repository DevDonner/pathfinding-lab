/**
 * Control bar — pure presentational: every control reports intent up,
 * the parent owns all state.
 */
import { ALGO_IDS, ALGO_LABELS } from '../engine/algorithms.ts'
import type { UrlParams, SizeId } from '../engine/urlState.ts'

export type PaintMode = 'wall' | 'terrain'

interface ControlsProps {
  params: UrlParams
  onPatch: (patch: Partial<UrlParams>) => void
  paintMode: PaintMode
  onPaintMode: (m: PaintMode) => void
  playing: boolean
  onTogglePlay: () => void
  onRerun: () => void
  onNewMaze: () => void
  onClearWalls: () => void
  onCopyLink: () => void
  copied: boolean
}

const SIZES: Array<{ id: SizeId; label: string }> = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
]

export function Controls({
  params,
  onPatch,
  paintMode,
  onPaintMode,
  playing,
  onTogglePlay,
  onRerun,
  onNewMaze,
  onClearWalls,
  onCopyLink,
  copied,
}: ControlsProps) {
  const toggleAlgo = (a: (typeof ALGO_IDS)[number]) => {
    const on = params.algs.includes(a)
    if (on && params.algs.length === 1) return // keep at least one lane
    onPatch({ algs: ALGO_IDS.filter((x) => (x === a ? !on : params.algs.includes(x))) as typeof params.algs })
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-edge bg-surface p-2 font-mono text-xs sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-mute">algos</span>
        {ALGO_IDS.map((a) => {
          const on = params.algs.includes(a)
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => toggleAlgo(a)}
              className={`rounded border px-2 py-1 transition-colors ${
                on
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-edge text-mute hover:border-mute hover:text-slate-200'
              }`}
            >
              {ALGO_LABELS[a]}
            </button>
          )
        })}
        <span className="mx-1 hidden h-4 w-px bg-edge sm:block" />
        <span className="text-mute">size</span>
        <div className="flex overflow-hidden rounded border border-edge">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={params.size === s.id}
              onClick={() => onPatch({ size: s.id })}
              className={`px-2 py-1 ${params.size === s.id ? 'bg-accent/15 text-accent' : 'text-mute hover:text-slate-200'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-mute">
          walls
          <input
            type="range"
            min={10}
            max={40}
            step={1}
            value={params.wall}
            onChange={(e) => onPatch({ wall: Number(e.target.value) })}
            className="w-24 accent-[#5eead4]"
          />
          <span className="w-8 text-slate-200">{params.wall}%</span>
        </label>

        <label className="flex items-center gap-2 text-mute">
          terrain
          <input
            type="checkbox"
            checked={params.terrain}
            onChange={(e) => onPatch({ terrain: e.target.checked })}
            className="accent-[#5eead4]"
          />
          <span className={params.terrain ? 'text-slate-200' : ''}>slow</span>
        </label>

        <label className="flex items-center gap-2 text-mute">
          speed
          <input
            type="range"
            min={1}
            max={40}
            step={1}
            value={params.speed}
            onChange={(e) => onPatch({ speed: Number(e.target.value) })}
            className="w-24 accent-[#5eead4]"
          />
          <span className="w-10 text-slate-200">{params.speed}/f</span>
        </label>

        <span className="mx-1 hidden h-4 w-px bg-edge sm:block" />

        <span className="text-mute">paint</span>
        <div className="flex overflow-hidden rounded border border-edge">
          <button
            type="button"
            aria-pressed={paintMode === 'wall'}
            onClick={() => onPaintMode('wall')}
            className={`px-2 py-1 ${paintMode === 'wall' ? 'bg-amber-400/15 text-amber-300' : 'text-mute hover:text-slate-200'}`}
          >
            walls
          </button>
          <button
            type="button"
            aria-pressed={paintMode === 'terrain'}
            onClick={() => onPaintMode('terrain')}
            className={`px-2 py-1 ${paintMode === 'terrain' ? 'bg-amber-400/15 text-amber-300' : 'text-mute hover:text-slate-200'}`}
          >
            terrain
          </button>
        </div>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={onTogglePlay} className="rounded border border-accent/60 bg-accent/10 px-3 py-1 text-accent hover:bg-accent/20">
            {playing ? 'pause' : 'play'}
          </button>
          <button type="button" onClick={onRerun} className="rounded border border-edge px-2 py-1 text-slate-200 hover:border-mute">
            rerun
          </button>
          <button type="button" onClick={onNewMaze} className="rounded border border-edge px-2 py-1 text-slate-200 hover:border-mute">
            new maze
          </button>
          <button type="button" onClick={onClearWalls} className="rounded border border-edge px-2 py-1 text-slate-200 hover:border-mute">
            clear walls
          </button>
          <button type="button" onClick={onCopyLink} className="rounded border border-edge px-2 py-1 text-slate-200 hover:border-mute">
            {copied ? 'copied ✓' : 'copy link'}
          </button>
        </span>
      </div>
    </section>
  )
}
