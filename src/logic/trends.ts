// Pure daily aggregation for the Trends dashboard. Buckets events into the last
// N local calendar days (empty days kept as zero). No React/DB.
import { format } from 'date-fns';

import type { DiaperEvent, FeedEvent } from '@/src/db/types';

export type TrendRange = 7 | 14 | 30;

export interface TrendDay {
  key: string; // yyyy-MM-dd (local)
  label: string;
  feedCount: number; // breast + bottle (pump excluded)
  bottleMl: number; // bottle volume only
  pumpMl: number;
  wet: number; // wet + both
  dirty: number; // dirty + both
  diaperCount: number; // actual diaper events (no double-count)
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Oldest → newest buckets ending on `now`'s local day. */
export function buildTrendDays(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  range: TrendRange,
  now: Date = new Date()
): TrendDay[] {
  const labelFmt = range <= 7 ? 'EEE' : 'd';
  const buckets: TrendDay[] = [];
  const index = new Map<string, TrendDay>();

  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day: TrendDay = {
      key: localDayKey(d),
      label: format(d, labelFmt),
      feedCount: 0,
      bottleMl: 0,
      pumpMl: 0,
      wet: 0,
      dirty: 0,
      diaperCount: 0,
    };
    buckets.push(day);
    index.set(day.key, day);
  }

  for (const f of feeds) {
    const day = index.get(localDayKey(new Date(f.start_time)));
    if (!day) continue;
    if (f.type === 'pump') {
      day.pumpMl += f.volume_ml ?? 0;
    } else {
      day.feedCount += 1;
      if (f.type === 'bottle') day.bottleMl += f.volume_ml ?? 0;
    }
  }

  for (const d of diapers) {
    const day = index.get(localDayKey(new Date(d.time)));
    if (!day) continue;
    day.diaperCount += 1;
    if (d.type === 'wet' || d.type === 'both') day.wet += 1;
    if (d.type === 'dirty' || d.type === 'both') day.dirty += 1;
  }

  return buckets;
}

export interface TrendSummary {
  avgIntakeMl: number; // bottle ml / day
  avgDiapers: number;
  avgPumpMl: number;
  hasBottle: boolean;
}

export function trendSummary(days: TrendDay[]): TrendSummary {
  const n = days.length || 1;
  const sum = (sel: (d: TrendDay) => number) => days.reduce((acc, d) => acc + sel(d), 0);
  return {
    avgIntakeMl: Math.round(sum((d) => d.bottleMl) / n),
    avgDiapers: Math.round((sum((d) => d.diaperCount) / n) * 10) / 10,
    avgPumpMl: Math.round(sum((d) => d.pumpMl) / n),
    hasBottle: days.some((d) => d.bottleMl > 0),
  };
}
