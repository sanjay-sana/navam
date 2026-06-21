# Lull — Setup & Build Guide

This kit holds the decision-bearing scaffolding. Drop these files into a fresh
Expo project, install the dependencies, and you're ready to build the screens.

## 1. Create the project
```bash
npx create-expo-app@latest lull --template tabs   # expo-router + TypeScript
cd lull
```
Then copy this kit in:
- `app.json`            → project root (overwrite)
- `eas.json`            → project root
- `db/`                 → `src/db/`
- `theme/`             → `src/theme/`

## 2. Install dependencies
```bash
# core data + platform features
npx expo install expo-sqlite expo-notifications expo-sharing expo-file-system

# navigation is included with the tabs template (expo-router)
# cross-platform UI + iOS readiness
npx expo install react-native-safe-area-context @react-native-community/datetimepicker

# charts (custom WHO percentile overlay + bars) and date math
npx expo install react-native-svg
npm install date-fns

# fonts (the nightlight type pairing)
npx expo install expo-font @expo-google-fonts/fraunces @expo-google-fonts/hanken-grotesque
```

## 3. Suggested structure
```
app/                        # expo-router routes
  (tabs)/
    index.tsx               # Today
    log.tsx                 # Log (feed / diaper entry)
    trends.tsx              # Trends (feeds/diapers/pump/growth views)
    settings.tsx            # Settings
    _layout.tsx             # bottom tab bar (Today / Log / Trends / Settings)
  log/feed.tsx              # Log feed (live + backfill)
  log/diaper.tsx            # Log diaper
  history.tsx               # History timeline (reached from Today)
  growth/add.tsx            # Add measurement
  onboarding.tsx            # first-run: name / sex / DOB
src/
  db/migrations.ts          # open + migrate (provided)
  db/schema.sql             # reference DDL (provided)
  db/repo.ts                # CRUD + queries (to write)
  theme/theme.ts            # design tokens (provided)
  logic/prediction.ts       # next_feed = MAX(start_time) + interval (to write)
  logic/notifications.ts    # cancel + reschedule one-shot (to write)
  logic/units.ts            # canonical <-> display conversion (to write)
```

## 4. The testing ladder (matches the spec)
```bash
# Rung 2 — development build (your daily loop, real native modules)
npx expo run:android                      # local; needs Android Studio SDK
# or: eas build --profile development      # cloud dev client, zero local setup

# Rung 3 — preview APK to sideload to family phones
eas build --profile preview

# Rung 4 — production AAB for Play, then submit to the internal track
eas build --profile production
eas submit --profile production            # first upload is MANUAL in Play Console
```

## 5. Key implementation notes (from the spec)
- **Time:** store every timestamp as UTC (`new Date().toISOString()`); render local; compute day boundaries and "time since last feed" in local time (use `date-fns`).
- **Prediction:** `next_feed = MAX(start_time over type IN ('breast','bottle')) + interval`. Recompute on every insert/edit/delete, then cancel + reschedule the single pending notification.
- **Notifications:** request permission on first reminder enable; create an Android channel (`setNotificationChannelAsync`) guarded by `Platform.OS === 'android'`; tap deep-links to Log feed.
- **Units:** store canonical (ml / g / cm); convert only at the display edge.
- **Volume trend:** sum bottle `volume_ml` only; breast excluded; pump shown separately.
- **Diaper "both":** counts toward both wet and dirty trend bars.
