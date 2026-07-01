# Navam — Build Kit

Seed scaffolding for the Navam baby tracker, generated from the approved design
spec (`baby-tracker-requirements.md`). Everything here encodes a decision already
made, so the build starts spec-accurate instead of from scratch.

## What's inside
| File | Purpose |
|------|---------|
| `app.json` | Expo config — name, dark theme, Android package + `POST_NOTIFICATIONS`, iOS bundle id (ready, not built), expo-router/sqlite/notifications plugins |
| `eas.json` | Build profiles — `development` (dev client), `preview` (APK for family), `production` (AAB → Play internal track) |
| `db/schema.sql` | Canonical DDL for all six tables (reference) |
| `db/migrations.ts` | Executable open + versioned migration runner (expo-sqlite) |
| `theme/theme.ts` | The nightlight design tokens (colour, type, spacing, radius) |
| `SETUP.md` | Create-project steps, dependency installs, structure, build/test commands |

## How to use it
1. Run the steps in `SETUP.md` to create the Expo project and install deps.
2. Copy these files in.
3. Build the screens against the approved mockups + spec.

## Recommended: build in Claude Code
The screens and logic are iterative work — best done with **Claude Code** in your
repo on Ubuntu, where it can write files, run `expo`, read the errors, and iterate.
Point it at this kit plus `baby-tracker-requirements.md` and the screen PNGs, and
build screen by screen (Today → Log → History → Trends → Settings → onboarding).

## Run these two tracks in parallel
- **Build:** scaffold → data layer (`repo.ts`) → screens → prediction + notifications → export.
- **Play Console (start now):** register ($25), create the app, stand up the closed-testing
  track, recruit 12 testers. The 14-day clock runs while you build (personal account).

## Not in v1 (see the spec's decisions log)
iOS release, light theme, multi-baby UI, sleep/solids, adaptive prediction,
growth velocity, auto cloud backup, notification snooze/quiet-hours, and the
BYOK LLM Q&A feature.
