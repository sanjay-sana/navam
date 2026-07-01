# Navam — Device QA Checklist

Manual test plan for things the unit tests **can't** cover (they only test
`src/logic`). Run on a real Android build, not Expo Go — **notifications and
SQLite need a dev build**:

```
npx expo run:android        # or: eas build --profile development
```

Legend: ☐ todo · ✅ pass · ❌ fail (note the issue)

---

## 0. Boot & onboarding
- ☐ Fresh install (clear app data) launches to **Onboarding**, not the tabs.
- ☐ Saving with a blank name / no sex / no DOB shows inline errors.
- ☐ DOB picker won't allow a future date; "born today" is accepted.
- ☐ After saving, app lands on **Today** and the tab bar shows 4 tabs.
- ☐ Relaunch goes straight to **Today** (baby persisted).
- ☐ Fonts render (Fraunces headings, Hanken body), dark theme everywhere.

## 1. Today
- ☐ Cold start (no feeds) shows "Log your first feed", no countdown.
- ☐ After a feed, ring shows elapsed (H:MM) and counts up live (~1s tick).
- ☐ "Next feed around HH:MM" pill matches last feed start + interval.
- ☐ Past the interval: ring fills, pill switches to "Feed overdue by Xm" (never negative).
- ☐ "feeds today" / "diapers today" counts are correct and update on return.
- ☐ Feed button → Log feed; Diaper button → Log diaper; history icon → History.

## 2. Log feed — breast
- ☐ Record starts the timer (mm:ss climbs); Stop captures duration.
- ☐ Save disabled while timing.
- ☐ "Started" time reflects when Record was pressed.
- ☐ Manual minutes path works when timer not used.
- ☐ Side required (error if none). Save returns to Today; ring/counts update.
- ☐ Left/Right store a per-side duration; Both stores total (check via History/CSV).

## 3. Log feed — bottle / pump
- ☐ Bottle: volume + contents required; saves; appears in History.
- ☐ Pump: volume required, side optional; excluded from "feeds today" & next-feed.
- ☐ Volume shows the unit from Settings (ml/oz) and stores canonical ml.
- ☐ "When" presets (Now/15m/30m/1h) set the time; **Pick** does date then time.
- ☐ Future time is blocked with an error.

## 4. Log diaper (2-tap)
- ☐ Tap a type (Wet/Dirty/Mixed) → Save = 2 taps; time defaults to now.
- ☐ Saving with no type selected shows an error.
- ☐ Appears in History; "Mixed" displays for type `both`.

## 5. History
- ☐ Timeline is newest-first; per-day summary line is correct.
- ☐ Day nav: ‹ goes back; › disabled on today.
- ☐ Tap a feed → edit screen prefilled; Save changes persists; Delete (with confirm) removes it.
- ☐ Same for diaper and growth entries.
- ☐ Growth rows show no clock time and route to the growth form.
- ☐ Edits/deletes of feeds reschedule the reminder (see §8).

## 6. Trends — Activity
- ☐ 7/14/30 range toggle re-queries; empty days render as zero bars.
- ☐ Count vs Volume toggle; Volume shows "bottle volume only" note + avg line.
- ☐ Volume with no bottles in range shows the empty-state hint (not a zero).
- ☐ Diaper stacked bars: wet (teal) + dirty (honey); a Mixed event adds to both.
- ☐ Summary cards (ml/day in, diapers/day, ml pumped) look right.

## 7. Trends — Growth
- ☐ Weight & Length show WHO P3–P97 curves + the baby's plotted line.
- ☐ Head tab is disabled ("· soon").
- ☐ Latest card shows value + percentile + age + date.
- ☐ Add measurement: ≥1 field required; future date blocked; saves & plots.
- ☐ Switching units (Settings) re-renders chart + card in the new unit.
- ☐ **Spot-check** a couple of plotted percentiles against published WHO tables.

## 8. Reminders (needs dev build)
- ☐ Enabling the Feed reminder prompts for notification permission first time.
- ☐ Denying permission keeps the toggle off and shows the hint.
- ☐ With it on, a scheduled notification fires at last feed start + interval.
- ☐ Logging a newer feed reschedules (only **one** pending reminder exists).
- ☐ Backfilling an *older* feed does **not** move the reminder.
- ☐ Deleting the latest feed falls back to the previous one.
- ☐ Tapping the notification deep-links to the Log feed screen.
- ☐ Changing the interval reschedules.

## 9. Settings
- ☐ Profile card shows name/DOB/sex; tap → edit-profile; changes persist & propagate.
- ☐ Unit toggles (volume/weight/length) persist and update other screens.
- ☐ Export data → share sheet with a `navam-<name>-<date>.csv`; open it and verify
      feeds/diapers/growth rows + correct escaping.

## 10. Platform / resilience
- ☐ SafeAreaView: no clipping under the status bar / nav bar / notch.
- ☐ Rotate / background-and-resume doesn't crash or lose the in-progress timer unexpectedly.
- ☐ App icon on the home screen is the Navam crescent-baby (not the Expo placeholder);
      splash shows the mark + "Navam".
- ☐ Adaptive icon (long-press / themed icons) looks correct.

---

## Pre-release (not code)
- ☐ WHO data spot-checked vs published tables; note that data covers **0–24 months** only.
- ☐ Head-circumference WHO source decided/added (or keep "soon" for v1).
- ☐ Play Store assets: 1024² icon, feature graphic (1024×500), screenshots, descriptions.
- ☐ Privacy policy URL hosted; Data Safety form (local-only → minimal).
- ☐ Closed-testing track: ≥12 testers / 14 days (personal account gate).
