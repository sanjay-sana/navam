# Baby Tracker — Requirements & Design Spec

**Version:** 0.2 (draft)
**Platform:** React Native + Expo (managed workflow). **v1 ships Android only; iOS deferred but architecturally supported** (see §10).
**Build:** EAS Build
**Persistence:** expo-sqlite (on-device)

---

## 1. Scope

A personal baby tracker for a single caregiver on a single device. Three core
domains: **feeding/milk**, **diaper changes**, and **growth measurements**, plus
**scheduled reminders**.

### In scope (v1)
- Feeding: breastfeeding sessions, bottle feeds, pumping
- Diaper logging
- Growth measurements with WHO percentile overlays
- Trends dashboard — daily feed / diaper / pump charts (§5.6)
- History — per-day timeline with edit/delete (§5.7)
- First-run onboarding (name / sex / DOB) (§5.8)
- Local scheduled reminders / notifications
- CSV export / backup via share sheet (§5.9)
- User-selectable units (metric / imperial)
- **Dark theme only**
- Single baby in the UI, but schema designed for multiple

### Out of scope (v1 — candidates for later)
- iOS build/release (codebase stays iOS-compatible from day one — see §10)
- Light / system theme
- Multi-caregiver / multi-device sync (would require a backend, auth, conflict resolution)
- Sleep tracking
- Solids / food introduction tracking
- Photos, milestones, journaling
- Automatic cloud backup (manual CSV export covers v1 — §5.9)
- Notification snooze & quiet-hours

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Caregivers | Single user, single device | No backend, auth, or sync needed. SQLite is the single source of truth. |
| Persistence | expo-sqlite | Local, relational, offline by default. |
| Offline | Offline-first (mandatory) | Logging happens in nurseries with no connectivity. Free with local SQLite. |
| Notifications | Local scheduled (expo-notifications) | Single device ⇒ no push infrastructure (no FCM/APNs, no server). |
| Multi-baby | Schema-ready, UI-hidden | `baby_id` FK on every event from day one; baby-switcher hidden until > 1 baby. |
| Units | Stored canonical, converted on display | Store ml / grams / cm; render per user preference. |
| Theme | Dark only (v1) | Matches the low-light "nightlight" use case; light/system theme deferred. |
| Time | Stored UTC, displayed local | Persist timestamps in UTC; render and compute day boundaries in device-local time. |

### Notification mechanic (important)
Mobile OSes will not reliably wake the app to compute "3h since last feed" on the
fly. Instead, the app **cancels the pending reminder and schedules a fresh
one-shot** for `last_relevant_event_time + interval` every time a relevant event
is logged. Fully offline, no background execution required.

---

## 3. Core UX Principle

The dominant design constraint is **data-entry latency**, not feature breadth.
The killer use case is logging a 3am feed one-handed while holding the baby.

- Optimize for **minimum taps to log an event**.
- Default `time = now` on every event; make it editable but never required.
- Diaper fast path target: **2 taps** (type → save).
- Configuration and optional fields live off the fast path.

---

## 4. Data Model

ISO-8601 strings for all timestamps. Canonical units: **ml** (volume),
**grams** (mass), **cm** (length).

```sql
CREATE TABLE babies (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  sex           TEXT NOT NULL CHECK (sex IN ('male','female')), -- required for WHO percentiles
  date_of_birth TEXT NOT NULL,                                  -- ISO date; drives age computation
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE feed_events (
  id                INTEGER PRIMARY KEY,
  baby_id           INTEGER NOT NULL REFERENCES babies(id),
  type              TEXT NOT NULL CHECK (type IN ('breast','bottle','pump')),
  start_time        TEXT NOT NULL,
  end_time          TEXT,
  -- breast / pump
  side              TEXT CHECK (side IN ('left','right','both')),
  duration_left_s   INTEGER,
  duration_right_s  INTEGER,
  -- bottle / pump
  volume_ml         REAL,                                        -- canonical ml
  -- bottle
  contents          TEXT CHECK (contents IN ('breast_milk','formula','mixed')),
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE diaper_events (
  id          INTEGER PRIMARY KEY,
  baby_id     INTEGER NOT NULL REFERENCES babies(id),
  time        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('wet','dirty','both')),
  color       TEXT,                                              -- optional, off fast path
  consistency TEXT,                                             -- optional, off fast path
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE growth_measurements (
  id                      INTEGER PRIMARY KEY,
  baby_id                 INTEGER NOT NULL REFERENCES babies(id),
  measured_at             TEXT NOT NULL,                        -- ISO date
  weight_g                REAL,                                 -- canonical grams
  length_cm               REAL,                                 -- canonical cm
  head_circumference_cm   REAL,                                 -- canonical cm
  notes                   TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE reminder_configs (
  id               INTEGER PRIMARY KEY,
  baby_id          INTEGER NOT NULL REFERENCES babies(id),
  type             TEXT NOT NULL CHECK (type IN ('feed')),       -- extensible
  enabled          INTEGER NOT NULL DEFAULT 0,                   -- bool
  interval_minutes INTEGER NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),               -- single row
  unit_volume TEXT NOT NULL DEFAULT 'ml'  CHECK (unit_volume IN ('ml','oz')),
  unit_mass   TEXT NOT NULL DEFAULT 'g'   CHECK (unit_mass   IN ('g','lb_oz')),
  unit_length TEXT NOT NULL DEFAULT 'cm'  CHECK (unit_length IN ('cm','in')),
  active_baby_id INTEGER REFERENCES babies(id),
  updated_at  TEXT NOT NULL
);
```

### WHO reference data
Bundled as a static read-only asset (JSON), **not** a DB table. Keyed by
`sex × measurement_type (weight/length/head_circ) × age`. Used only to draw
percentile curves under the baby's plotted values.

---

## 5. Functional Requirements

### 5.1 Feeding
- **Breast session:** side (L/R/both), per-side duration (timer or manual), start time. No volume.
- **Bottle:** volume + contents (breast milk / formula / mixed).
- **Pump:** volume expressed, optional side.
- Single `feed_events` table; `type` discriminator with nullable type-specific columns.
- Volume entered/displayed in user's unit; stored as ml.
- **Entry modes — live vs. backfill (first-class, not an afterthought).** Most feeds are logged after the fact, so manual entry is required, not optional:
  - The live timer only *auto-fills* `start_time` / `end_time` / duration; those are plain editable fields. Manual entry sets them directly.
  - Bottle and pump are backfill-native (no timer — just volume + an editable time).
  - Breast supports both: run the timer, **or** enter start time + per-side duration manually.
  - The time field is always editable to any past time, with quick "when" presets (Now / 15m / 30m / 1h ago / pick time) to keep backfill within the tap budget. Multiple forgotten feeds = repeat entry.
  - **Validation:** block future-dated times.
- **Edit / delete** existing feeds (corrections) use the same fields and trigger the same recompute as §5.4.

### 5.2 Diaper
- Type: wet / dirty / both. Time defaults to now.
- Optional color/consistency, kept off the fast path.
- In trends, a **"both" event counts toward both the wet and the dirty bar** (+1 each), so the stacked totals reconcile (§5.6).

### 5.3 Growth
- Capture any of weight / length / head circumference per entry (all optional individually, ≥1 required).
- Entered/displayed in user units; stored canonical.
- **Three per-metric percentile charts**, toggled via Weight | Length | Head:
  **weight-for-age, length-for-age, head-circumference-for-age** — each plots the baby's
  values over age against the sex-specific WHO percentile curves (P3–P97). Sex is required
  because the WHO standards differ for boys and girls.
- **Line, not bars — by design.** Growth is *measurement* data (recorded occasionally,
  continuous quantity), so it's a continuous percentile line over age. Contrast with
  *event-frequency* data (feeds, diapers), which is daily bars (§5.6). This line-vs-bar
  split is the organizing rule for all analytics.
- Lives as the Growth view within the Trends tab (§5.6).
- *Possible later extension:* growth velocity (e.g. g/week) — deferred.

### 5.4 Reminders

**Next-feed prediction — fixed interval (v1).** One rule, one source of truth for
both the Today ring and the scheduled notification:

```
next_feed = last_qualifying_feed.start_time + interval
```

- **Interval:** the Settings value (default 180 min); enable/disable per type.
- **"Latest qualifying feed" = `MAX(start_time)` over `type IN ('breast','bottle')`** — keyed off event time, not entry order. Pumping excluded (milk tracking, not the baby feeding).
- **Measure start-to-start:** compute from `start_time`, not end time (matters for long breast sessions).
- **Today ring** = `elapsed_since_last_feed / interval`.
- **Overdue, not negative:** once `now > next_feed`, fill the ring and show "Feed overdue by Xm" — never a negative countdown.
- **Cold start:** no qualifying feed yet ⇒ no prediction; Today shows a "Log your first feed" prompt instead of a ring.
- **Recompute trigger (covers live + backfill + edits):** on any insert / edit / delete of a qualifying feed, recompute `next_feed` from `MAX(start_time)`, then cancel the pending reminder and schedule a fresh one-shot. Consequences:
  - Logging/correcting the most-recent feed ⇒ prediction + reminder move.
  - Backfilling an *older* forgotten feed ⇒ latest is unchanged ⇒ prediction + reminder unaffected (history only).
  - Deleting the latest feed ⇒ prediction falls back to the previous qualifying feed.
- Local notifications; runtime permission required (iOS & Android differ — handle denial gracefully).
- **Permission timing:** request when the user first enables a reminder (not at app launch).
- **Tap action:** tapping the notification deep-links to the Log feed screen.
- *Deferred:* snooze and quiet-hours.

*Out of v1 (deferred):* adaptive interval (rolling average of recent gaps) and
time-of-day modelling. Revisit once there's real feed history to learn from.

### 5.5 Settings
- Unit preferences (volume, mass, length).
- Baby profile (name, sex, DOB).
- Reminder configuration.

### 5.6 Trends / Insights
A scrollable dashboard of daily aggregations over existing event data — **no schema
change** (computed via `GROUP BY date(start_time)` filtered by `baby_id`). Lives in
the **Trends tab** (the former "Growth" tab, broadened); the WHO growth curve from
§5.3 becomes one view within it.

- **Metrics:** feeds/day via a **Count | Volume** toggle — *Count* = number of feeds (works for any feeding style, incl. exclusive breast); *Volume* = summed **bottle** ml/day in the user's unit (ml or oz). Plus pump *output*/day (ml), breastfeeding duration/day, wet diapers/day, dirty diapers/day (+ combined).
- **Volume is bottle-only:** breast sessions have no measurable volume, so they're excluded from the Volume total (and a "bottle volume only" note makes that explicit); pump output is shown separately (output ≠ intake). If there are no bottle feeds in range, Volume shows an empty-state hint rather than a misleading zero.
- **Chart choice follows data shape:** daily counts/volumes → **bar charts** (discrete
  buckets, not lines); diapers → **stacked bars** (wet bottom + dirty top, so per-type
  split and daily total read together); growth stays the continuous percentile **line** (§5.3).
- **Intake vs output are distinct series:** bottle (ml in) ≠ pump (ml expressed); pumping
  stays separate from feeding throughout (consistent with the data model).
- **Ranges:** 7 / 14 / 30 days, default 7.
- **Day boundary = local calendar day** (device timezone); mind DST.
- **Empty days render as zero, never skipped** — gaps are the signal, not noise.
- **Mixed diaper events count toward both bars** (+1 wet, +1 dirty), so stacked totals reconcile.

### 5.7 History
- Per-day **timeline** of all events (feed / diaper / pump / growth) in chronological order, newest first.
- **Day navigation:** move between days; each day shows a small summary (e.g. "6 feeds · 5 diapers · 674 ml").
- **Tap any entry to edit or delete** — the entry point for the backfill/correction flows in §5.1; edits/deletes trigger the §5.4 recompute.
- Reached from the Today screen (header affordance); the tab bar stays at four (Today / Log / Trends / Settings).

### 5.8 First-run Onboarding
- Minimal setup captured on first launch: **baby name, sex, date of birth** (sex + DOB are required before growth percentiles can render — §5.3).
- Optional: confirm unit preference and default reminder interval.
- Kept to the fewest screens possible; everything is editable later in Settings.

### 5.9 Export / Backup
- **Manual CSV export via the OS share sheet** (`expo-sharing` + `expo-file-system`) — the v1 recovery path, since local-only storage has no automatic backup.
- Cross-platform by construction (maps to Android share intent and, later, iOS Files/iCloud — §10).
- Export covers all event tables for the active baby. Automatic cloud backup is deferred.

---

## 6. Non-Functional Requirements
- **Offline-first:** zero network dependency for any core flow.
- **Fast entry:** see §3. Treat tap-count as a measurable budget per flow.
- **Data integrity:** all writes timestamped (`created_at`/`updated_at`); soft-delete optional.
- **Time handling:** persist timestamps in UTC (ISO-8601); render in device-local time; compute "per day" boundaries and "time since last feed" in local time. DST is the only edge to watch.
- **Theme:** dark only for v1 (light/system theme deferred).
- **Platform parity:** identical feature set on iOS & Android; respect each platform's notification-permission UX.
- **Resilience:** graceful handling of denied notification permission and empty states.

---

## 7. Deployment — Google Play Store

Goal: deployable to the Google Play Store. For an Expo app this splits into
tooling (mostly automated) and policy gates (process/timeline, not code).

### 7.1 Build & submit pipeline
- **Artifact:** Android App Bundle (`.aab`), not APK — Play requires AAB for distribution. EAS `production` profile outputs `.aab` by default.
- **Signing:** Play App Signing — Google holds the app signing key; you upload with an upload key. EAS manages the keystore for you.
- **First upload is manual:** a Google Play Store API limitation. Create the app in Play Console and upload the first `.aab` by hand. Every subsequent release: `eas submit` automates it.
- **Automation credential:** a Google Service Account JSON key, uploaded to EAS credentials, authorizes `eas submit` for later releases.
- **Target API level:** new apps must target Android 15 (API 35). A current Expo SDK already targets this — effectively free, just keep the SDK current.
- **Runtime permission:** `POST_NOTIFICATIONS` (Android 13+) for reminders; request at runtime, handle denial gracefully (already in §5.4 / §6).

### 7.2 Policy gates (the ones with real lead time)
- **Account type: PERSONAL (decided).** Accepts the closed-testing gate below; organization account was the alternative (exempt from the gate, but needs a registered business entity).
- **Closed testing requirement (personal accounts):** a personal developer account created after 13 Nov 2023 must run a closed test with **≥ 12 testers opted in for 14 continuous days** before it can apply for production access. This is a ~2-week timeline gate, not a code task. Recruit real testers (partner, family, parent groups). Do **not** use emulators/fake accounts — that risks permanent account suspension.
- **Account:** $25 one-time registration fee + identity verification.
- **Content rating:** IARC questionnaire (trivial for this app — no objectionable content).
- **Privacy policy:** a hosted privacy-policy URL is required (app touches health/child-adjacent data). A simple static page suffices.
- **Data Safety form:** declares what data leaves the device. **Local-only design ⇒ no data collected or transmitted ⇒ minimal declaration.** Direct payoff of the no-backend architecture.
- **Target audience:** declare **adults** — the app is used by parents, not children. This avoids triggering Google's stricter Designed-for-Families policy.

### 7.3 Store listing assets (needed before first publish)
App icon, feature graphic, phone screenshots, short + full description, category.

---

## 8. Decisions Log

All v1 open decisions are now resolved:

1. **Next-feed prediction** → fixed interval from the latest qualifying feed's start time (§5.4).
2. **Backup / export** → manual CSV export via share sheet in v1 (§5.9); automatic cloud backup deferred.
3. **Per-side pump volume** → total only in v1.
4. **Sleep tracking** → out for v1.
5. **Developer account type** → personal (accepts the 12-tester / 14-day closed-test gate; §7.2).
6. **Theme** → dark only for v1; light/system theme deferred.
7. **History** → in v1 as a per-day timeline reached from Today (§5.7).
8. **Mixed diaper events** → count toward both wet and dirty trend bars.
9. **Time handling** → store UTC, display local (§6).
10. **Onboarding** → minimal first-run capture of name/sex/DOB (§5.8).
11. **Notifications** → permission requested on first enable; tap opens Log feed; snooze/quiet-hours deferred (§5.4).

*Remaining deferrals (post-v1, non-blocking):* iOS build, light theme, multi-baby UI, sleep & solids tracking, adaptive prediction, growth velocity, automatic cloud backup, notification snooze/quiet-hours, and **natural-language Q&A over the data via a user-supplied LLM key** (BYOK, text-to-SQL so only schema + aggregates leave the device) — deferred because it re-opens the "nothing leaves the device" privacy story (transmitting a minor's health data) and adds key-management + SQL-sandboxing surface area; revisit as an opt-in v1.1 feature.

---

## 9. Proposed Next Steps
1. ~~Resolve open decisions~~ — done (§8).
2. Add the History screen to the screen set (§5.7); finalize navigation map.
3. Generate the Expo project scaffold (schema migrations, navigation, data layer, dark theme).
4. Set up Play Console + closed-testing track early (the 14-day clock can run in parallel with development).

---

## 10. iOS Readiness (Android-first, iOS-later)

v1 ships Android only, but the codebase stays iOS-deployable so the eventual iOS
launch is a build target, not a rewrite. Expo's managed workflow compiles one
TypeScript codebase to both platforms; all chosen libraries (expo-sqlite,
expo-notifications, expo-file-system) are cross-platform. The discipline below
keeps the iOS gap at zero.

### 10.1 Code guardrails (apply from day one)
- **Notification channels are Android-only.** Guard `setNotificationChannelAsync` behind `Platform.OS === 'android'` so it no-ops on iOS.
- **Respect iOS's 64 pending-notification cap.** The cancel + reschedule-one-shot reminder design (§2) keeps ~1 pending notification, well under the limit. Do not fan out many future notifications.
- **Declare iOS permission usage strings** (`ios.infoPlist`) in app config alongside Android permissions.
- **Safe areas:** use `react-native-safe-area-context` (SafeAreaView) so the notch / home indicator don't clip UI.
- **Pickers / native UI:** use cross-platform components (e.g. `@react-native-community/datetimepicker`) rather than Android-shaped UI — relevant for the time-heavy fast-entry flows.
- **Export/backup:** implement via `expo-sharing` + `expo-file-system` (maps to iOS Files/iCloud and Android share intent), not Android storage APIs (SAF / external paths).
- **General rule:** stay inside the Expo SDK and well-known cross-platform libraries. Any Android-native module creates an iOS gap.
- **Config now:** populate the `ios` block (bundle identifier, icon, splash) even though iOS isn't built yet.

### 10.2 Operational realities for the eventual iOS launch
- **No Mac needed to build:** EAS builds iOS in the cloud. But the iOS simulator does not run on Linux — test on a physical iPhone via TestFlight.
- **Cost:** Apple Developer Program is **$99/year recurring** (vs Google's $25 one-time).
- **Review:** Apple App Review is manual and slower; budget a few days. Local-only personal tracker is low content risk.
- **Privacy:** iOS App Privacy labels — trivial, same rationale as the Data Safety form (nothing leaves the device).
