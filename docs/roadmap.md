# Navam — Roadmap (post-v1)

Captured after the v1 feature freeze. v1 = feeds / diapers / sleep / growth,
Trends, History, reminders, CSV export, onboarding, WHO percentiles — Android,
dark-only, offline, single-caregiver.

Guiding constraints (unchanged): **minimum taps to log**, **nothing leaves the
device**, **dark, calm, one-handed**. Any feature that breaks the offline/local
promise (i.e. needs a backend) is a deliberate, isolated decision — see v3.

Ordering within a tier is flexible; ship v1 → learn from real use → pull the
next tier by what actually annoys us.

---

## v1.1 — small polish (post-launch, usage-driven)
Low-risk, no architecture change, all consistent with the offline ethos.

- **Feed notes** — the feed screen has no notes field today (the `feed_events`
  table already has a dormant `notes` column). Add it, then add
  **flag-for-review** on feed too, for parity with diaper/sleep.
- **Head circumference** on Growth — `GrowthInput.head_circumference_cm` already
  exists in the schema; needs an input + a third chart toggle (Weight / Length /
  Head).
- **Notification snooze / quiet-hours** — explicitly deferred from v1 (§5.4).
- **Sleep refinements** (sleep plan **S4**): night-wakings within a night sleep;
  overnight **midnight-split** attribution in Trends. See
  [`sleep-tracking-plan.md`](./sleep-tracking-plan.md).

## v2 — the differentiators + reporting (no backend, no privacy cost)
Where Navam gets genuinely smarter and more useful without collecting anything.

- **Sleep wake-window prediction (S5)** — bundled, on-device **age-based
  wake-window reference** → "next nap around 2:40pm" + optional nap reminder.
  Mirrors the WHO-percentile approach (reference data shipped in-app, computed
  locally). The marquee sleep item — see the sleep plan's S5.
- **Adaptive feed interval** — replace the fixed interval with a rolling average
  of recent feed gaps, so the Today countdown learns the baby's real rhythm.
  (§5.2 deferral: adaptive interval.)
- **Growth velocity** — g/week and cm/week, so you see the *rate* of change, not
  just the percentile position. (§7 deferral: growth velocity.)
- **Richer export / reporting — PDF pediatrician summary.** A "well-visit
  handout" generated **on-device** with `expo-print` (HTML→PDF, cross-platform,
  in the Expo SDK) and shared via the existing share sheet — same privacy model
  as CSV. Contents:
  - Baby profile + selected date range.
  - Growth chart with WHO percentiles + a measurements table (weight / length /
    head circ, with percentiles).
  - Feeding summary (feeds/day, avg intake, breast vs. bottle vs. pump).
  - Diaper summary (wet/dirty/day) and sleep summary (total/day, naps, longest
    stretch).
  - Also under this umbrella: **date-range / filtered CSV export** (v1 exports
    everything).

## v3 — platform expansion (bigger bets, some strategic)
- **Multi-caregiver sync** — "is the baby asleep right now" across two phones.
  The **one** feature that forces a **backend + auth + conflict resolution**, and
  it directly tensions the local-only story. The persisted open-sleep model is
  already designed as the sync point (see sleep plan), but treat this as its own
  product decision, not a casual feature. **Explicitly v3.**
- **iOS build** — kept architecturally ready throughout (SafeAreaView, Expo
  cross-platform libs, Android-guarded notification channel). Mostly config +
  device testing (§10).
- **Light / system theme** — dark-only was a deliberate v1 call for the
  nightlight use case.
- **Multi-baby** — support more than one child (twins, second kid).
- **Solids tracking** — introducing-solids logging.

## Exploratory (unscheduled, privacy-sensitive)
- **Natural-language Q&A over your data (BYOK)** — "how much did she sleep last
  week?" via a *user-supplied* LLM key, text-to-SQL so only the **schema +
  aggregates** leave the device. Deferred deliberately: it re-opens the "nothing
  leaves the device" promise for a minor's health data, and adds key-management +
  SQL-sandbox surface. Only ever as an explicit opt-in. (§9 deferral.)

---

### Notes
- Section refs (§) point to [`baby-tracker-requirements.md`](./baby-tracker-requirements.md).
- Sleep phases S4/S5 are detailed in [`sleep-tracking-plan.md`](./sleep-tracking-plan.md).
- Anything needing a server (sync, cloud backup) is quarantined to v3+ so the
  offline/local guarantee holds for v1–v2.
