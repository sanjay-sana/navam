// Pure builders for the History timeline + per-day summary. Maps raw feed/diaper
// rows into display entries; no React/DB. Time strings are UTC ISO, so lexical
// sort == chronological.
import type {
  DiaperEvent,
  FeedEvent,
  FeedType,
  GrowthMeasurement,
  SleepEvent,
  UnitLength,
  UnitMass,
  UnitVolume,
} from '@/src/db/types';
import { formatDuration } from './sleep';
import { formatLength, formatMass, formatVolume } from './units';

export interface DisplayUnits {
  volume: UnitVolume;
  mass: UnitMass;
  length: UnitLength;
}

export interface TimelineEntry {
  key: string;
  id: number;
  kind: 'feed' | 'diaper' | 'growth' | 'sleep';
  feedType?: FeedType;
  time: string; // UTC ISO (growth uses midday of its date for ordering)
  /** False for growth (date-only) — the row hides the clock time. */
  hasClock: boolean;
  title: string;
  subtitle: string;
  flagged?: boolean;
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
  const base = { key: `feed-${f.id}`, id: f.id, kind: 'feed' as const, feedType: f.type, time: f.start_time, hasClock: true };
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function diaperEntry(d: DiaperEvent): TimelineEntry {
  const parts = [DIAPER_LABEL[d.type], d.color ? cap(d.color) : null, d.consistency ? cap(d.consistency) : null]
    .filter(Boolean)
    .join(' · ');
  return {
    key: `diaper-${d.id}`,
    id: d.id,
    kind: 'diaper',
    time: d.time,
    hasClock: true,
    title: 'Diaper',
    subtitle: parts,
    flagged: d.flagged === 1,
  };
}

export function growthEntry(m: GrowthMeasurement, units: DisplayUnits): TimelineEntry {
  const parts = [
    m.weight_g != null ? formatMass(m.weight_g, units.mass) : null,
    m.length_cm != null ? formatLength(m.length_cm, units.length) : null,
    m.head_circumference_cm != null ? `${formatLength(m.head_circumference_cm, units.length)} head` : null,
  ].filter(Boolean) as string[];
  return {
    key: `growth-${m.id}`,
    id: m.id,
    kind: 'growth',
    // Date-only measurement: anchor at midday so it orders sensibly within the day.
    time: `${m.measured_at}T12:00:00.000Z`,
    hasClock: false,
    title: 'Measurement',
    subtitle: parts.join(' · '),
  };
}

export function sleepEntry(s: SleepEvent): TimelineEntry {
  const subtitle = s.end_time
    ? formatDuration(new Date(s.end_time).getTime() - new Date(s.start_time).getTime())
    : 'ongoing';
  return {
    key: `sleep-${s.id}`,
    id: s.id,
    kind: 'sleep',
    time: s.start_time,
    hasClock: true,
    title: s.kind === 'night' ? 'Night sleep' : 'Nap',
    subtitle,
    flagged: s.flagged === 1,
  };
}

/** Merge feeds + diapers + growth + sleep into one timeline, newest first. */
export function buildTimeline(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  growth: GrowthMeasurement[],
  sleeps: SleepEvent[],
  units: DisplayUnits
): TimelineEntry[] {
  const items = [
    ...feeds.map((f) => feedEntry(f, units.volume)),
    ...diapers.map(diaperEntry),
    ...growth.map((m) => growthEntry(m, units)),
    ...sleeps.map(sleepEntry),
  ];
  items.sort((a, b) => b.time.localeCompare(a.time));
  return items;
}

export interface DaySummary {
  feeds: number;
  diapers: number;
  volume: string | null; // bottle-only ml/oz, null when no bottles
  weighIns: number;
  sleep: string | null; // total sleep that day, null when none
}

export function daySummary(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  growth: GrowthMeasurement[],
  sleeps: SleepEvent[],
  unit: UnitVolume,
  now: Date = new Date()
): DaySummary {
  const feedCount = feeds.filter((f) => f.type !== 'pump').length;
  const volMl = feeds
    .filter((f) => f.type === 'bottle')
    .reduce((sum, f) => sum + (f.volume_ml ?? 0), 0);
  const sleepMs = sleeps.reduce((sum, s) => {
    const end = s.end_time ? new Date(s.end_time).getTime() : now.getTime();
    return sum + Math.max(0, end - new Date(s.start_time).getTime());
  }, 0);
  return {
    feeds: feedCount,
    diapers: diapers.length,
    volume: volMl > 0 ? formatVolume(volMl, unit) : null,
    weighIns: growth.length,
    sleep: sleepMs > 0 ? formatDuration(sleepMs) : null,
  };
}
