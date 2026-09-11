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

## Release gates
Don't start a tier until the previous one has *earned* it. Each gate tests three
things together — **reach** (are people finding it), **retention** (do they keep
using it — the real signal for a tracker), and **demand** (are they asking for
what's next). Numbers are adjustable targets for a private, no-marketing,
word-of-mouth app — the *structure* matters more than the exact figures, and
retention always outweighs installs. Read all of these free in Play Console
(Statistics, Acquisition/retention cohorts, Ratings, Android vitals).

- **v1 → v1.1** *(is the core worth polishing?)* — ~100 installs, a clean
  production launch, a handful of 4★+ ratings, no critical-bug pattern in
  reviews, and ≥3 unprompted requests among the v1.1 candidates. Bar is low —
  these are cheap polish items. Build what people ask for; skip the rest.
- **v1.1 → v2** *(is there a base worth making smarter for?)* — ~1,000 installs
  with meaningful **D30 retention** (people still logging a month in), 20–50
  ratings at 4.2★+, and clear pull for a differentiator (repeated "does it
  predict naps?" / "can I get a pediatrician report?"). That pull is what earns
  wake-window prediction and the PDF summary.
- **v2 → v3** *(the expensive, strategic tier)* — several thousand active users,
  a sustained base, and explicit repeated demand for the specific v3 feature.
  ⚠️ Different in kind: sync means a **backend with ongoing cost + liability for
  a minor's health data**, so the real gate is "enough demand that you'll
  monetize it (see Monetization stance) or happily fund the servers." Never
  cross into v3 casually — it turns Navam from a local tool into an operated
  service.

---

## Shipped since v1
- **Backup & restore (local JSON snapshot)** — lossless, fully-offline backup:
  Settings → Back up writes a versioned JSON envelope of every table and hands
  it to the OS share sheet; Restore picks a file (via the file-system picker,
  falling back to `expo-document-picker`), validates it, and **replaces** all
  data in a single transaction. Carries **sleep + pump durations** the CSV drops,
  and also restores preferences (units, night window, feed reminder). Doubles as
  the migration path off a sideloaded preview build onto the store build.

---

## v1.1 — small polish (post-launch, usage-driven)
Low-risk, no architecture change, all consistent with the offline ethos.

- **Feed notes** — the feed screen has no notes field today (the `feed_events`
  table already has a dormant `notes` column). Add it, then add
  **flag-for-review** on feed too, for parity with diaper/sleep.
- **Head circumference** on Growth — `GrowthInput.head_circumference_cm` already
  exists in the schema; needs an input + a third chart toggle (Weight / Length /
  Head).
- **In-app review prompt** — request a Play rating via `expo-store-review`
  (Google's In-App Review API) at a positive milestone, e.g. once total logged
  events cross ~20–30. Request once, then flag it in settings so it never
  re-fires. Must NOT gate features, incentivise, or pre-filter to happy users
  (all Play violations) — just request at a good moment and let Google decide
  whether to show it.
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

## Monetization stance
How Navam earns without betraying what it is. Gate any billing work behind real
demand — don't build it until there are enough users that a small conversion is
worth the effort.

- **Off the table — permanently.** Ads (the listing says "no ads, no tracking";
  ad networks are third-party trackers and need network) and selling/sharing
  data (it's a minor's health data on a privacy-first app). These would destroy
  the one thing that differentiates Navam.
- **Primary model: free core + one-time "Pro" unlock.** A generous free core,
  and a **one-time purchase** (not a subscription) for power/convenience
  features. One-time fits because baby tracking has a short, intense usage
  window (people churn in ~3 months) and the offline app has **no ongoing server
  cost** to justify recurring charges — a subscription for something that costs
  us nothing to run breeds resentment. "Buy it, own it, no strings" also matches
  the privacy ethos.
- **Free forever — never paywalled:** core logging, and anything safety-related,
  especially **backup/restore and CSV export**. Locking someone's own data
  behind a paywall betrays the whole promise.
- **Pro (one-time) candidates:** PDF pediatrician report, extended trends /
  history windows, wake-window prediction, growth velocity, multi-baby, extra
  themes — the committed-parent conveniences, not what a casual user needs.
- **Subscription — reserved for v3 sync only.** Multi-caregiver sync is the one
  feature with a genuine recurring server cost, so it's the only thing a
  subscription can honestly charge for.
- **The pitch is the ethos:** "You're the customer, not the product — no ads, no
  data sales. Buy Pro to support a solo developer keeping your baby's data
  private." Privacy-conscious users convert *better* when respected.
- **Reality check:** a niche, no-marketing, free-core app converts ~2–5% at a
  few dollars — coffee money until real scale. Play takes 15% on the first
  $1M/yr for small developers.

---

### Notes
- Section refs (§) point to [`baby-tracker-requirements.md`](./baby-tracker-requirements.md).
- Sleep phases S4/S5 are detailed in [`sleep-tracking-plan.md`](./sleep-tracking-plan.md).
- Anything needing a server (sync, cloud backup) is quarantined to v3+ so the
  offline/local guarantee holds for v1–v2.
