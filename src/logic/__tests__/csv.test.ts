import { format } from 'date-fns';

import type { DiaperEvent, FeedEvent, GrowthMeasurement } from '@/src/db/types';
import { buildCsv } from '@/src/logic/csv';

const local = (iso: string) => format(new Date(iso), 'yyyy-MM-dd HH:mm');

function feed(p: Partial<FeedEvent>): FeedEvent {
  return {
    id: 1, baby_id: 1, type: 'bottle', start_time: '2026-06-20T02:35:00.000Z', end_time: null,
    side: null, duration_left_s: null, duration_right_s: null, volume_ml: 90, contents: 'formula',
    notes: null, created_at: '', updated_at: '', ...p,
  };
}
function diaper(p: Partial<DiaperEvent>): DiaperEvent {
  return { id: 2, baby_id: 1, time: '2026-06-20T01:15:00.000Z', type: 'both', color: null, consistency: null, notes: null, created_at: '', updated_at: '', ...p };
}
function growth(p: Partial<GrowthMeasurement>): GrowthMeasurement {
  return { id: 3, baby_id: 1, measured_at: '2026-06-20', weight_g: 5900, length_cm: 58.4, head_circumference_cm: null, notes: null, created_at: '', updated_at: '', ...p };
}

describe('buildCsv', () => {
  const lines = buildCsv([feed({})], [diaper({})], [growth({})]).split('\n');

  it('has a header and one row per event', () => {
    expect(lines[0].startsWith('event_type,time_local,subtype')).toBe(true);
    expect(lines).toHaveLength(4);
  });

  it('sorts by the stored instant (date-only growth sorts before same-day timestamps)', () => {
    expect(lines[1].startsWith('growth,2026-06-20,')).toBe(true);
    expect(lines[2].startsWith('diaper,')).toBe(true);
    expect(lines[3]).toContain(',90,formula,');
  });

  it('renders event times in local time (not raw UTC ISO)', () => {
    expect(lines[2]).toContain(local('2026-06-20T01:15:00.000Z'));
    expect(lines[2]).not.toContain('T01:15:00.000Z');
  });

  it('keeps a fixed 14-column shape with blank cells', () => {
    expect(lines[0].split(',')).toHaveLength(14);
    expect(lines[3].split(',')).toHaveLength(14);
  });

  it('escapes commas and quotes (RFC-4180)', () => {
    const csv = buildCsv([feed({ notes: 'a, b' })], [], [growth({ notes: 'say "hi"' })]);
    expect(csv).toContain('"a, b"');
    expect(csv).toContain('"say ""hi"""');
  });
});
