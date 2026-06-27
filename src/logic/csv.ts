// Pure CSV builder for the backup/export (§5.9). All event tables for a baby in
// one sparse, RFC-4180-escaped sheet keyed by event_type. No DB/IO.
//
// Times are rendered in the device-local timezone (the column is `time_local`)
// so the export is readable without mental UTC conversion. Rows are still sorted
// by the underlying stored instant, so ordering is timezone-independent.
import { format } from 'date-fns';

import type { DiaperEvent, FeedEvent, GrowthMeasurement } from '@/src/db/types';

const HEADER = [
  'event_type',
  'time_local',
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

/** UTC ISO instant → local "yyyy-MM-dd HH:mm". */
function localTime(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd HH:mm');
}

export function buildCsv(
  feeds: FeedEvent[],
  diapers: DiaperEvent[],
  growth: GrowthMeasurement[]
): string {
  // `key` is the original stored value (UTC ISO / date) used only for sorting,
  // so order stays chronological regardless of the device timezone.
  const items: { key: string; cells: Cell[] }[] = [];
  for (const f of feeds) {
    items.push({
      key: f.start_time,
      cells: ['feed', localTime(f.start_time), f.type, f.side, f.duration_left_s, f.duration_right_s, f.volume_ml, f.contents, '', '', '', '', '', f.notes],
    });
  }
  for (const d of diapers) {
    items.push({
      key: d.time,
      cells: ['diaper', localTime(d.time), '', '', '', '', '', '', d.type, d.color, d.consistency, '', '', d.notes],
    });
  }
  for (const g of growth) {
    // measured_at is date-only — no clock time to localise.
    items.push({
      key: g.measured_at,
      cells: ['growth', g.measured_at, '', '', '', '', '', '', '', '', '', g.weight_g, g.length_cm, g.notes],
    });
  }
  items.sort((a, b) => a.key.localeCompare(b.key));
  return [HEADER, ...items.map((i) => i.cells)].map((r) => r.map(esc).join(',')).join('\n');
}
