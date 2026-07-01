# Navam — baby tracker

## WHY
A personal baby tracker built for fast, one-handed logging at 3am, because existing
trackers are overcomplicated. Single caregiver, single device, offline, local-only.
The dominant design constraint is **minimum taps to log an event**.

## WHAT (v1)
Feeding (breast / bottle / pump), diaper logging, growth with WHO percentiles, a Trends
dashboard, a History timeline, local reminders, CSV export, and first-run onboarding.
Android-first; iOS deferred but kept compatible. **Dark theme only.**
Full spec: `docs/baby-tracker-requirements.md`. Approved mockups: `docs/lull-*.png`.

## TECH STACK
- Expo (managed) + TypeScript; expo-router with 4 tabs: Today / Log / Trends / Settings
- expo-sqlite (local DB — see `src/db/migrations.ts`); no backend
- expo-notifications (local scheduled); expo-sharing + expo-file-system (CSV export)
- react-native-svg (charts); @react-native-community/datetimepicker; react-native-safe-area-context; date-fns
- Fonts: Fraunces (display) + Hanken Grotesque (UI). Design tokens in `src/theme/theme.ts`.

## HOW — build order (one slice at a time; plan before implementing)
1. DB layer (`src/db/repo.ts`) + onboarding (name / sex / DOB)
2. Today (countdown ring, quick-log, daily counts)
3. Log feed (breast / bottle / pump; live timer **and** manual backfill)
4. Log diaper (2-tap), then History timeline (edit / delete)
5. Trends (feed count/volume, diaper wet/dirty stacked, pump; + Growth percentile view)
6. Reminders (notifications) + CSV export

## KEY RULES (do not violate)
- **Time:** store UTC ISO-8601 (`new Date().toISOString()`); render local; day boundaries local.
- **Next feed** = `MAX(start_time over breast+bottle) + interval`. Recompute on every insert/edit/delete; cancel + reschedule the single pending notification. Pump excluded.
- **Units:** store canonical (ml / g / cm); convert only at the display edge.
- **Volume trend** = bottle `volume_ml` only (breast is unmeasurable); pump shown separately.
- **Diaper "both"** counts toward both the wet and the dirty trend bar.
- **Notifications:** create the Android channel guarded by `Platform.OS === 'android'`; request permission on first enable; tapping a notification deep-links to Log feed.
- **iOS-ready:** stay inside the Expo SDK / cross-platform libs; use SafeAreaView everywhere; no Android-only native modules.
- **Dark theme only** for v1.

## COMMANDS
- Dev build: `npx expo run:android`  (or `eas build --profile development`)
- Preview APK (sideload to family): `eas build --profile preview`
- Production AAB + submit: `eas build --profile production && eas submit --profile production`
- Type check: `npx tsc --noEmit`

## CONVENTIONS
- Keep business logic (prediction, unit conversion, day-bucketing) in `src/logic/` — pure and unit-testable.
- All DB access goes through `src/db/repo.ts`.
- Commit per slice on a feature branch; review changes in plan mode before implementing.
