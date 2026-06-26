// Pure CSV builder for the backup/export (§5.9). All event tables for a baby in
// one sparse, RFC-4180-escaped sheet keyed by event_type. No DB/IO.
import type { DiaperEvent, FeedEvent, GrowthMeasurement } from '@/src/db/types';

const HEADER = [
  'event_type',
  'time',
  'subtype',
  'side',
  'duration_left_s',
  'duration_right_s',
  'volume_ml',
  'contents',
  'diaper_type',
  'diaper_color',
  'diaper_consistency',
  'weight_g',
  'length_cm',
  'notes',
];

type Cell = string | number | null | undefined;

function esc(v: Cell): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  growth: GrowthMeasurement[]
): string {
  const rows: Cell[][] = [];
  for (const f of feeds) {
    rows.push(['feed', f.start_time, f.type, f.side, f.duration_left_s, f.duration_right_s, f.volume_ml, f.contents, '', '', '', '', '', f.notes]);
  }
  for (const d of diapers) {
    rows.push(['diaper', d.time, '', '', '', '', '', '', d.type, d.color, d.consistency, '', '', d.notes]);
  }
  for (const g of growth) {
    rows.push(['growth', g.measured_at, '', '', '', '', '', '', '', '', '', g.weight_g, g.length_cm, g.notes]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return [HEADER, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
