// Deterministic, realistic sample-data generator — used by the experimental
// "Load sample data" tool so the app's screens look real for store screenshots.
// Pure (no DB/IO): produces event *Input* objects with UTC ISO times, ready to
// hand to the repo's create* functions. Seeded by the baby's DOB so a given baby
// always gets the same dataset (stable, unit-testable).
import { format } from 'date-fns';

import type { DiaperInput, FeedInput, GrowthInput, SleepInput } from '@/src/db/types';

export interface SampleData {
  feeds: FeedInput[];
  diapers: DiaperInput[];
  sleeps: SleepInput[];
  growth: GrowthInput[];
}

// --- tiny seeded PRNG (mulberry32) so output is deterministic per seed --------
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FEED_NOTES = ['Cluster feeding', 'Fussy at the breast', 'Fell asleep halfway', 'Good latch', 'Spit up a little after'];
const DIAPER_NOTES = ['A bit of diaper rash', 'Cream applied', 'Leaked overnight'];
const SLEEP_NOTES = ['Went down easily', 'Needed rocking', 'Woke once, resettled', 'Contact nap on chest'];

const CONTENTS: NonNullable<FeedInput['contents']>[] = ['breast_milk', 'formula', 'mixed'];
const STOOL_COLORS = ['yellow', 'green', 'brown'];
const CONSISTENCIES = ['runny', 'soft', 'seedy'];

export interface SampleOptions {
  dob: string; // yyyy-MM-dd
  now?: Date;
  days?: number; // how many recent days of activity (default 21)
}

/**
 * Build a realistic dataset for a baby. Activity (feeds/diapers/sleep) spans the
 * last `days` days (clamped to on/after DOB, and never in the future); growth
 * spans from birth to now, weekly, so the percentile chart has a full curve.
 */
export function buildSampleData(opts: SampleOptions): SampleData {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 21;
  const rnd = mulberry32(hashSeed(opts.dob));

  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const jit = (maxMin: number) => Math.round((rnd() * 2 - 1) * maxMin);
  const chance = (p: number) => rnd() < p;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  const dobMidnight = new Date(`${opts.dob}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // A local wall-clock time on `dayOffset` days before today, at hour.min.
  const at = (dayOffset: number, hour: number, extraMin = 0): Date => {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60) + extraMin;
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset, h, m);
  };
  const inRange = (d: Date) => d.getTime() <= now.getTime() && d.getTime() >= dobMidnight.getTime();

  const feeds: FeedInput[] = [];
  const diapers: DiaperInput[] = [];
  const sleeps: SleepInput[] = [];

  const FEED_HOURS = [6.5, 9, 11.5, 14, 16.5, 19, 21, 22.75];
  const DIAPER_HOURS = [7, 9.5, 12, 14, 16, 18.5, 21];
  const NAP_HOURS = [9.5, 12.5, 15.5];

  for (let i = days - 1; i >= 0; i--) {
    // ---- feeds ----
    for (const h of FEED_HOURS) {
      const start = at(i, h, jit(35));
      if (!inRange(start)) continue;
      const r = rnd();
      if (r < 0.62) {
        // breast — one or both sides
        const both = chance(0.7);
        const left = both || chance(0.5) ? int(6, 15) * 60 : 0;
        const right = both || left === 0 ? int(6, 15) * 60 : 0;
        const side = left > 0 && right > 0 ? 'both' : right > 0 ? 'right' : 'left';
        feeds.push({
          type: 'breast',
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + (left + right) * 1000).toISOString(),
          side,
          duration_left_s: left || null,
          duration_right_s: right || null,
          notes: chance(0.12) ? pick(FEED_NOTES) : null,
        });
      } else if (r < 0.86) {
        // bottle
        const vol = int(6, 15) * 10; // 60–150 ml
        feeds.push({
          type: 'bottle',
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + int(8, 16) * 60_000).toISOString(),
          volume_ml: vol,
          contents: pick(CONTENTS),
          notes: chance(0.1) ? pick(FEED_NOTES) : null,
        });
      } else {
        // pump
        feeds.push({
          type: 'pump',
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + int(12, 20) * 60_000).toISOString(),
          volume_ml: int(6, 13) * 10, // 60–130 ml
          notes: null,
        });
      }
    }

    // ---- diapers ----
    for (const h of DIAPER_HOURS) {
      const t = at(i, h, jit(40));
      if (!inRange(t)) continue;
      const r = rnd();
      const type: DiaperInput['type'] = r < 0.55 ? 'wet' : r < 0.8 ? 'dirty' : 'both';
      const stool = type !== 'wet';
      diapers.push({
        time: t.toISOString(),
        type,
        color: stool ? pick(STOOL_COLORS) : null,
        consistency: stool ? pick(CONSISTENCIES) : null,
        notes: chance(0.08) ? pick(DIAPER_NOTES) : null,
      });
    }

    // ---- naps ----
    for (const h of NAP_HOURS) {
      const start = at(i, h, jit(40));
      const end = new Date(start.getTime() + int(40, 95) * 60_000);
      if (!inRange(start) || end.getTime() > now.getTime()) continue;
      sleeps.push({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        kind: 'nap',
        notes: chance(0.15) ? pick(SLEEP_NOTES) : null,
      });
    }

    // ---- night sleep (started the previous evening, ended this morning) ----
    const nStart = at(i + 1, 20, jit(45));
    const nEnd = at(i, 6.5, jit(45));
    if (inRange(nStart) && nEnd.getTime() <= now.getTime() && nStart.getTime() < nEnd.getTime()) {
      sleeps.push({
        start_time: nStart.toISOString(),
        end_time: nEnd.toISOString(),
        kind: 'night',
        notes: chance(0.2) ? pick(SLEEP_NOTES) : null,
      });
    }
  }

  // ---- growth: weekly from ~1 week old to now (birth point comes from onboarding) ----
  const growth: GrowthInput[] = [];
  const baseWeight = 3300 + int(-200, 200); // g at birth-ish
  const baseLength = 50 + int(-2, 2); // cm
  for (let week = 1; week <= 20; week++) {
    const d = new Date(dobMidnight.getFullYear(), dobMidnight.getMonth(), dobMidnight.getDate() + week * 7);
    if (d.getTime() > now.getTime()) break;
    growth.push({
      measured_at: format(d, 'yyyy-MM-dd'),
      weight_g: baseWeight + week * (190 + int(-25, 25)),
      length_cm: Math.round((baseLength + week * 0.85 + (rnd() - 0.5)) * 10) / 10,
    });
  }

  // ---- showcase the Flagged review list: flag a couple of items with a note ----
  const flagDiaper = (idx: number, note: string) => {
    if (idx >= 0 && idx < diapers.length) {
      diapers[idx].flagged = 1;
      diapers[idx].notes = note;
    }
  };
  flagDiaper(Math.floor(diapers.length * 0.4), 'Small red streak — asked pediatrician to check');
  flagDiaper(Math.floor(diapers.length * 0.75), 'Unusually dark, keeping an eye on it');
  const napIdx = sleeps.findIndex((s) => s.kind === 'nap');
  if (napIdx >= 0) {
    sleeps[napIdx].flagged = 1;
    sleeps[napIdx].notes = 'Very short nap, seemed uncomfortable';
  }

  return { feeds, diapers, sleeps, growth };
}
