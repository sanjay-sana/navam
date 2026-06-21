// Pure builders for the History timeline + per-day summary. Maps raw feed/diaper
// rows into display entries; no React/DB. Time strings are UTC ISO, so lexical
// sort == chronological.
import type { DiaperEvent, FeedEvent, FeedType, UnitVolume } from '@/src/db/types';
import { formatVolume } from './units';

export interface TimelineEntry {
  key: string;
  id: number;
  kind: 'feed' | 'diaper';
  feedType?: FeedType;
  time: string; // UTC ISO
  title: string;
  subtitle: string;
}

const SIDE_LABEL = { left: 'Left', right: 'Right', both: 'Both' } as const;
const CONTENTS_LABEL = { breast_milk: 'breast milk', formula: 'formula', mixed: 'mixed' } as const;
const DIAPER_LABEL = { wet: 'Wet', dirty: 'Dirty', both: 'Mixed' } as const;

/** Total breast minutes: sum of per-side durations, else end−start, else null. */
function breastMinutes(f: FeedEvent): number | null {
  const perSide = (f.duration_left_s ?? 0) + (f.duration_right_s ?? 0);
  if (perSide > 0) return Math.round(perSide / 60);
  if (f.end_time) {
    return Math.round((new Date(f.end_time).getTime() - new Date(f.start_time).getTime()) / 60000);
  }
  return null;
}

export function feedEntry(f: FeedEvent, unit: UnitVolume): TimelineEntry {
  const base = { key: `feed-${f.id}`, id: f.id, kind: 'feed' as const, feedType: f.type, time: f.start_time };
  if (f.type === 'breast') {
    const m = breastMinutes(f);
    const parts = [f.side ? SIDE_LABEL[f.side] : null, m != null ? `${m} min` : null].filter(Boolean);
    return { ...base, title: 'Breast feed', subtitle: parts.join(' · ') };
  }
  if (f.type === 'bottle') {
    const vol = f.volume_ml != null ? formatVolume(f.volume_ml, unit) : null;
    const parts = [vol, f.contents ? CONTENTS_LABEL[f.contents] : null].filter(Boolean);
    return { ...base, title: 'Bottle', subtitle: parts.join(' · ') };
  }
  const vol = f.volume_ml != null ? formatVolume(f.volume_ml, unit) : null;
  return { ...base, title: 'Pump', subtitle: vol ? `${vol} expressed` : 'expressed' };
}

export function diaperEntry(d: DiaperEvent): TimelineEntry {
  return {
    key: `diaper-${d.id}`,
    id: d.id,
    kind: 'diaper',
    time: d.time,
    title: 'Diaper',
    subtitle: DIAPER_LABEL[d.type],
  };
}

/** Merge feeds + diapers into one timeline, newest first. */
export function buildTimeline(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  unit: UnitVolume
): TimelineEntry[] {
  const items = [...feeds.map((f) => feedEntry(f, unit)), ...diapers.map(diaperEntry)];
  items.sort((a, b) => b.time.localeCompare(a.time));
  return items;
}

export interface DaySummary {
  feeds: number;
  diapers: number;
  volume: string | null; // bottle-only ml/oz, null when no bottles
}

export function daySummary(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  unit: UnitVolume
): DaySummary {
  const feedCount = feeds.filter((f) => f.type !== 'pump').length;
  const volMl = feeds
    .filter((f) => f.type === 'bottle')
    .reduce((sum, f) => sum + (f.volume_ml ?? 0), 0);
  return {
    feeds: feedCount,
    diapers: diapers.length,
    volume: volMl > 0 ? formatVolume(volMl, unit) : null,
  };
}
