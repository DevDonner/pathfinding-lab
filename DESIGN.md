# Pathfinding Lab — design document

**One interesting thing:** five search algorithms — BFS, DFS, Greedy
Best-First, Dijkstra, and A\* — racing across the *same* seeded maze,
side by side, so you can *see* what each algorithm trades away: BFS's
even wavefront, DFS's blind depth, Greedy's goal-chasing (and its
detours), Dijkstra's weighted correctness, A\*'s heuristic focus.

## Goals

1. **Rigorous engine.** Every algorithm is a pure function
   `run(algo, grid) → Trace` producing the full expansion order and final
   path *before* animation. The UI is a dumb playback machine. All
   behavior — optimality, determinism, no-path handling — is unit-tested
   without a browser.
2. **Same maze, fair race.** Every lane gets the identical grid (walls,
   terrain, start, goal). Lanes are ordered and comparable; results table
   reports visited / path hops / cost / optimal-or-not per algorithm.
3. **You can break the maze.** Paint walls (toggle), paint slow terrain
   (cost 4), and drag start/goal — all lanes rebuild from the edited
   grid. A maze with no path is a legitimate, shown state.
4. **Shareable.** `?seed=N&size=m&wall=24&terrain=1&speed=10&algs=…`
   reproduces the exact race.
5. **Lift-safe.** `src/lab/` obeys the portfolio lab contract: default
   export, no props, no shell imports, only host theme tokens + default
   Tailwind palette + arbitrary values (canvas colors are drawn, not
   themed, so they never leak into CSS).

## Non-goals

- No 8-directional movement, no diagonal cuts, no A\* variants
  (octile, weighted, any-angle) — five honest classics, clearly labeled.
- No path smoothing, no animated "agents" — the wavefront *is* the show.
- No persistence (no saved mazes), no accounts, no server.

## Theme

Radar/terminal on the host ink background, but the identity accent is the
**path**: visited wavefront in teal `rgba(94,234,212,·)` (host accent,
drawn to canvas), the expanding head in amber `#fbbf24`, the revealed
path in solid `#5eead4`, start `#4ade80`, goal `#f472b6`, walls
`#33465c`, slow terrain `#55432a`. DOM chrome (chips, table, controls)
uses only host tokens (`ink/surface/edge/accent/mute`) + default Tailwind
palette + arbitrary values.

## UX

```
┌──────────────────────────────────────────────────────────────────────────┐
│ pathfinder  ─ race 5 searches on one maze        seed 8241  [copy link] │
│ algs: [x]BFS [x]DFS [x]Greedy [x]Dijkstra [x]A*  size [S M L] walls 24% │
│ terrain [on]  speed ───────●────  paint: (walls)(terrain)  [new maze]   │
├──────────────────────────────────────────────────────────────────────────┤
│ bfs        ●▢▢▣▣▣▢▢▢…▣▣▣●   312 visited · 26 hops · cost 30 · OPTIMAL   │
│ dfs        ▢▢▢▢▣▢▢▢▢▢▢▢…    540 visited · 71 hops · cost 71 · suboptimal │
│ greedy     ▢▢▣▣▣▣▢▢▢▢…      118 visited · 34 hops · cost 34 · suboptimal │
│ dijkstra   ▢▢▢▣▣▣▣▢▢▢…      289 visited · 26 hops · cost 30 · OPTIMAL   │
│ a*         ▢▢▣▣▢▢▢▢▢▢…      131 visited · 26 hops · cost 30 · OPTIMAL   │
│ ───────────────────────────────────────────────────────────────────────  │
│ ▉▉▉▉▉▉▉▉▉▊▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉  [space] play/pause  [r] rerun [n] maze │
├──────────────────────────────────────────────────────────────────────────┤
│ RESULTS  Algorithm   Visited  Hops  Cost  Optimal                       │
│          bfs         312      26    30    ✓                             │
│          dfs         540      71    71    ✗ (+41)                       │
│          greedy      118      34    34    ✗ (+4)                        │
│          dijkstra    289      26    30    ✓                             │
│          a*          131      26    30    ✓ (fewest)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Auto-start.** The race runs on load (that's the demo). Pause to
  inspect; edit the maze any time (edits stop and reset the run).
- **Progressive results.** Each lane prints its chip (visited · hops ·
  cost · badge) the moment it finishes; the table fills in as lanes
  complete and is final when the last one does.
- **Optimal = cost-optimal** against Dijkstra on the same grid (the
  reference). Hop-optimality is implied: on this grid, cost-optimal with
  integer weights ≥ 1 does not guarantee hop-optimality, so the table
  shows both hops and cost; the badge uses cost.
- **Keyboard:** `Space` play/pause, `R` rerun, `N` new maze,
  `↑/↓` speed.
- **No-path honesty:** if start and goal are walled off, every lane
  burns its reachable region and prints `NO PATH` — that's a feature
  (watch DFS exhaust the component).

## Engine (pure TS, `src/lab/engine/`)

- **`rng.ts`** — mulberry32, identical to the other labs.
- **`grid.ts`** — `Grid { w, h, walls: Uint8Array, weights: Float64Array,
  start, goal }` + index math, `neighbors(i)` in fixed N-E-S-W order,
  `cost(i)`.
- **`maze.ts`** — seeded generation: start on the left edge, goal on the
  right; random walls (never in the first/last column, so endpoints are
  always reachable), optional slow-terrain rectangles (weight 4). If the
  result is unreachable, re-roll with `seed+1` (deterministic, bounded).
- **`algorithms.ts`** — `run(algo, grid) → Trace { steps: number[],
  path: number[] | null, found }`. `steps` = unique expansion order
  (marked-on-visit, fixed neighbor order, stable tie-breaks ⇒ fully
  deterministic). BFS/DFS are unweighted (hops); Greedy expands by
  Manhattan only; Dijkstra and A\* accumulate weighted cost. A binary
  min-heap `(key, insertOrder, cell)` keeps ties deterministic.
- **`metrics.ts`** — per-algo `visited`, `pathHops`, `pathCost`,
  `costOptimal` (vs the Dijkstra reference on the same grid),
  `hopsOptimal` (vs the BFS reference). `null` when the path wasn't
  found.
- **`urlState.ts`** — parse/build the shareable query; invalid fields
  dropped individually, never fatal.

## Tests (`node --test`, no browser)

- Determinism: same seed → identical maze; same grid → identical trace
  (deep-equal) for all five algorithms.
- Correctness on dozens of random mazes: every finder that reports
  `found` produces a wall-free, step-adjacent path from start to goal;
  BFS/Dijkstra/A\* are cost-optimal; when a path exists, BFS, Dijkstra,
  A\* (Manhattan is admissible on a 4-grid with weights ≥ 1) always find
  it; crafted no-path mazes report `found: false` for all.
- DFS/greedy are valid-but-not-optimal witnesses: at least one crafted
  maze where each beats (is longer than) the reference.
- Trace invariants: first step is the start, no duplicate visits,
  every step is in-bounds and not a wall.
- Metrics: cost sums weights, optimal flags, `NO PATH` ⇒ `null`.
- URL: round-trip, garbage fields dropped, canonical form.

## Verification

- `npm test` green, `tsc --noEmit && vite build` green.
- Browser-verified at 1440 / 768 / 375 (race runs to completion, table
  fills, wall painting works, zero console errors), screenshots checked
  in.
- Lift check: copy into `portfolio/src/labs/pathfinding-lab/`, host
  build green, revert.
