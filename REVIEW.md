# REVIEW — pathfinding-lab (2026-10-19)

Independent pass over the finished build: gate verification, breakpoint audit,
refine cycles. Findings below with severity and disposition — every P1/P2 was
closed and re-verified before the final push.

## Gate results

| Gate | Result | Evidence |
|------|--------|----------|
| G1 toolchain | ✅ | `npm run build` (tsc strict + vite) clean — 240 kB raw / 75 kB gzip (harness incl. fonts); CSS 38 kB / 18 kB gzip |
| G2 correctness | ✅ | 43/43 `node --test`: rng determinism; maze (seed determinism, endpoints on open left/right edges, unreachable re-roll bounded); all five algorithms (same grid ⇒ deep-equal trace, wall-free step-adjacent paths on dozens of random mazes, BFS/Dijkstra/A\* cost-optimal, no-path mazes report `found: false` for all); DFS/greedy non-optimality witnesses; trace invariants (first step = start, unique, in-bounds, never a wall); metrics (cost sums weights, optimal flags, `NO PATH` ⇒ `null`); URL round-trip + individual garbage-field drop |
| G3 runtime | ✅ | Real Edge: full race lifecycle — auto-start on load, pause/resume, wall paint (toggle), terrain paint, start/goal drag, new maze, clear walls, copy link, `NO PATH` state (walled-off goal), progressive per-lane chips → final results table. Zero console errors. Debug-seam readback matched the live view in the same task after every mutation |
| G4 responsive | ✅ | Captured 1440 / 768 / 375: `screenshots/`. At 375: lanes keep 1:1 canvas aspect (`max-width` per size), controls wrap, header collapses the tagline, no page overflow; 375 shot taken mid-race (BFS `expanding… 318/318`) |
| G5 keyboard | ✅ | `Space` play/pause (and rerun-when-complete), `R` rerun, `N` new maze, `↑/↓` speed ±2 — verified with trusted CDP key events; input-focus guard confirmed (no hijack while a control has focus) |
| G6 a11y | ✅ | sr-only `aria-live="polite"` region announces running → paused → complete; each canvas `role="img"` + descriptive `aria-label`; all controls labeled; progress bar `aria-hidden` (decorative duplicate of the live region) |
| G7 URL state | ✅ | Seed minted + written back on fresh load (every load is shareable); invalid fields dropped individually; structural change (seed/size/wall/terrain) rebuilds the maze and re-plays; param edits live-update the query via `replaceState` |
| G8 portability | ✅ | Lift check: `src/lab/` copied verbatim into `portfolio/src/labs/pathfinding-lab/` → portfolio `tsc --noEmit` exit 0 + `vite build` exit 0, lab auto-discovered and code-split to its own 20.6 kB chunk (7 kB gzip); portfolio reverted to clean. All in-lab imports are relative-within-lab or `react`; DOM chrome uses host tokens + default palette + arbitrary values only (canvas colors are drawn, never referenced from CSS) |
| G9 hygiene | ✅ | No TODO/FIXME/HACK; strict tsc with `noUnusedLocals/Parameters` clean; JSDoc on the public API; zero runtime network, zero storage (no persistence by design), zero audio |

## Findings

### F1 — P2 — Debug seam `getState()` stale until re-render — **fixed**
Same class as typing-lab F4: seam mutations (`paint`, `play`, `pause`,
`rerun`, `setProgress`) called `setState`, but the ref backing `getState()`
was only refreshed on render, so a synchronous readback in the same task
returned pre-mutation state (paint "did nothing", progress frozen). Fix:
`viewRef`/`gridRef` mirrors refreshed in the render body, and every seam
mutation patches the mirror optimistically **before** calling `setState`
(`src/lab/index.tsx`, seam section). Re-verified: readback immediately after
each seam op matched the mutation exactly, including `paint` ⇒ grid swap +
progress 0 + paused.

### F2 — P2 — Pointer harness emits `move` before `down` — **guarded**
Synthetic drags (and some touch paths) deliver `pointermove` events before
any `pointerdown`; unguarded, the first move of a drag would paint a cell
outside any press. Fix: `onCell` ignores `move` phases unless a `down` is
active (`draggingRef`), and `Lane` releases pointer capture in a
`try/catch` (release on an uncaptured pointer throws). Verified with
synthetic drag + real pointer paint/drag at all three viewports.

### F3 — P2 (false positive) — "Broken, jumbled" race screenshots — **closed, no app bug**
Downscaled captures of the five-lane race read as jumbled/wrong. Forensics
(custom PNG pixel analysis + live-DOM cross-check) proved the app was
correct and the *reading* was wrong:
- Idle shot: all canvases genuinely empty (0 path / 0 visited cells); the
  "bright band" at the bottom of the frame was the scrollbar column, not
  content.
- "Results" shot: captured with the page scrolled to the results table
  (`scrollTop 840`) — the table pixels were the real, populated results.
- Impossible-mix proof: each lane's `done[i]` is a monotonic function of one
  shared global `progress` counter, so the chip/geometry mixes seen in the
  thumbnails cannot occur from any app state.
Final four shots re-captured and pixel-verified; **no code change**.

## Refine cycles

**Cycle 1 — engine + browser interaction gates (findings: F2, F3 — closed):**
- Full interaction pass: paint/drag/seam/keyboard/URL at 1440 / 768 / 375;
  synthetic-drag guard confirmed; screenshot forensics (F3) — resolved as
  capture artifacts, app verified correct.

**Cycle 2 — seam readback (finding: F1 — fixed, re-verified):**
- Same-task readback after every seam mutation; optimistic mirror pattern
  applied (typing-lab F4 fix pattern) and re-tested in-browser.

**Stop rule:** two consecutive cycles with zero new P0/P1 — met (cycle 3 was
the lift + final screenshot pass with no changes).

## Notes (no action needed)

- **N1** — On a ~144 Hz display a 312-step race at speed 12 completes in
  ~180 ms; mid-race assertions need immediate read-after-action or
  `?speed=1` for a stable window.
- **N2** — The `browserKey` harness swallows uppercase letters; the app
  matches `r`/`R` and `n`/`N` case-insensitively anyway (Space/ArrowUp/
  ArrowDown arrive capitalized).
- **N3** — `full: true` screenshots return the viewport size (internally
  scroll + restore) — explicit `scrollTo` is the reliable way to frame a
  section; this is what confused the first "results" capture.
- **N4** — Enter-cost model: moving *into* a cell costs that cell's weight
  (open 1, terrain 4, start free). Dijkstra on the same grid is the
  optimality reference; the table shows both hops and cost because
  cost-optimality with weights ≥ 1 does not imply hop-optimality.

## Verdict

All nine gates green. Three findings (one fixed engine-adjacent seam
staleness, one guarded input edge, one false positive closed with pixel
evidence) — all closed and re-verified before the final push. Lift verified
against the portfolio and reverted. Ready for the portfolio.
