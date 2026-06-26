# Sleep Tracking — v1 Design Plan

Design sketch for adding sleep to Lull. Follows existing conventions (event
tables keyed by `baby_id`, UTC-store / local-render, all DB access via
`src/db/repo.ts`, pure logic in `src/logic/`, the prediction-ring + timeline +
trends architecture). No code yet — this is the build-ready design.

Sleep maps cleanly onto Lull: a sleep is an event with a start and end (like the
breast-feed timer), so ~70% reuses existing patterns (wheel pickers, event /
History / Trends architecture, the prediction ring, stacked charts, themed
dialogs). The genuinely new pieces are the **persisted open-session model** and
(v2) the **age-based wake-window reference**.

---

## Locked decisions

1. **Today layout** — Keep the feed countdown ring as the hero. Add a **dedicated
   sleep card below the daily counts** with the Start/End toggle, the state line,
   and naps/total-sleep stats. The card is **highlighted (accent border) while a
   sleep is in progress**. No hero-flip — both feed and sleep stay visible.
2. **Nap vs. night** — Auto-infer by start hour: **night = starts 20:00–06:00
   local, otherwise nap**, with a manual toggle to override on the log screen.
3. **Overnight attribution (Trends)** — Attribute a session's full duration to the
   local day it **started** (v1). Midnight-splitting is a documented v1.1 refinement.
4. **Sleep color** — A calm **periwinkle indigo** (night feel, distinct from the
   pink-violet growth color): `sleep: '#8B93E8'`, `sleepSoft: 'rgba(139,147,232,0.14)'`.
5. **"Asleep" indicator** — Show a small **"Asleep · 1:23" chip in the Today
   header** while a session is open. **Today only**, not on every screen (avoid clutter).

---

## Data model — `sleep_events` (migration v3)

```sql
CREATE TABLE sleep_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  baby_id     INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  start_time  TEXT NOT NULL,                       -- UTC ISO
  end_time    TEXT,                                -- NULL = in progress (asleep now)
  kind        TEXT NOT NULL CHECK (kind IN ('nap','night')),
  location    TEXT,                                -- optional, off fast path
  how         TEXT,                                -- optional: nursed/rocked/independent
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_sleep_baby_start ON sleep_events(baby_id, start_time);
```

**Key difference from the feed timer:** a sleep is **persisted the moment it
starts** (`end_time = NULL` = currently asleep), not just a UI stopwatch — so the
asleep state survives app-close and is the natural sync point for two parents
later.

**Invariant:** at most one open session (`end_time IS NULL`) per baby. Starting a
sleep while one is open auto-closes the previous at the new start time.

---

## Key rules (consistent with feeds)

- **Time:** store UTC ISO, render local, day boundaries local.
- **Duration** = `end − start`; in-progress = `now − start`.
- **Wake window** = `now − last completed sleep's end_time` (when awake) — the
  sleep analogue of "time since last feed."
- **Nap/night:** decision #2.
- **Trends day attribution:** decision #3 (by start day).

---

## Pure logic — `src/logic/sleep.ts` (unit-testable)

- `validateSleepDraft(draft, now)` → `SleepInput` (end ≥ start, no future, kind set).
- `sleepState({ openSleep, lastEndedSleep, now })` → `{ kind:'asleep'|'awake', sinceMs }`
  — drives the Today display (parallels `computeFeedRing`).
- `classifyKind(start)` → `'nap' | 'night'` (20:00–06:00 → night).
- `buildSleepDays(sessions, range, now)` → per-day
  `{ totalMin, nightMin, dayMin, naps, longestMin }` (parallels `buildTrendDays`).
- `formatDuration(ms)` → `"7h 20m"`.

## Repo additions — `src/db/repo.ts`

- `startSleep(babyId, startIso, kind)`, `endSleep(id, endIso)`, `getOpenSleep(babyId)`
- `createSleepEvent` / `getSleepEvent` / `updateSleepEvent` / `deleteSleepEvent`
- `getSleepEventsBetween(babyId, startIso, endIso)`

## Types — `src/db/types.ts`

- `SleepKind = 'nap' | 'night'`
- `SleepEvent` (row), `SleepInput` (write).

---

## Screens / UI

**A. Today — sleep card** (below the daily counts; decision #1)
- Big **Start sleep / End sleep** toggle.
- State line: "Asleep for 1:23" (live, ticking) or "Awake for 0:42" (wake window).
- Stats: **naps today**, **total sleep today**.
- Header chip "Asleep · 1:23" while open (decision #5).

**B. Log "+" chooser** — add **Sleep** → Feed / Pump / Sleep / Diaper / Growth.

**C. `log-sleep` screen** (hidden route)
- Start + end times (wheel pickers); "ongoing" when no end yet.
- **Nap / Night** toggle (pre-filled by auto-infer).
- Optional: location / how / notes (off fast path, like diaper details).
- Edit/delete via themed `ConfirmDialog`.

**D. History** — timeline entries: "Night sleep · 7h 20m" / "Nap · 45m", sleep-colored icon.

**E. Trends — Sleep view** (third segment with Activity / Growth)
- **Total sleep/day**, stacked **night vs. day** (reuses `StackedBarChart`).
- **Naps/day** bars.
- Summary cards: **avg sleep/day**, **avg naps/day**, **longest stretch**.

**F. Theme** — add `sleep` + `sleepSoft` tokens (decision #4) to `colors` and
`eventColors` in `src/theme/theme.ts`.

---

## Phased build order

- **S1 — Core:** migration v3 + types + repo + `sleep.ts` + Today Start/End +
  asleep/awake state + header chip. *(Usable day one.)*
- **S2 — Log + History:** `log-sleep` screen (manual/backfill, nap/night,
  details) + timeline entries + chooser entry.
- **S3 — Trends:** sleep view (night/day stacked, naps, summary cards).
- **S4 — v1.1:** night-wakings within a night sleep; overnight midnight-split;
  optional details polish.
- **S5 — Differentiator (v2):** bundled **age-based wake-window reference** →
  "next nap around X" prediction (mirrors the WHO percentile approach) +
  optional nap reminder.

Each phase: one slice on a feature branch, plan before implementing, keep
`tsc --noEmit` clean, pure logic unit-tested, commit per slice.

---

## Future / explicitly deferred
- Wake-window prediction + nap reminders (S5).
- Sleep-quality / mood-on-waking.
- Sleep-consistency (bedtime/wake-time) charts.
- Multi-caregiver live "is the baby asleep right now" (rides on the planned sync).
