// Pure validation: a Log-feed form draft → a persistable FeedInput. No React/DB.
// Rules from §5.1: breast needs a side; bottle needs volume + contents; pump
// needs volume (side optional). Future-dated times are always blocked.
import type { Contents, FeedInput, FeedType, Side, UnitVolume } from '@/src/db/types';
import { unitToMl } from './units';

export interface FeedDraft {
  type: FeedType;
  startTime: Date;
  /** breast/pump side; null = unset (pump allows null). */
  side: Side | null;
  /** breast session length in seconds (timer or manual); null if not provided. */
  durationSeconds: number | null;
  /** raw volume text in the user's unit (bottle/pump). */
  volumeText: string;
  contents: Contents | null;
  unitVolume: UnitVolume;
}

export interface FeedErrors {
  time?: string;
  side?: string;
  volume?: string;
  contents?: string;
  duration?: string;
}

export type FeedResult =
  | { ok: true; value: FeedInput }
  | { ok: false; errors: FeedErrors };

function parseVolume(text: string): number | null {
  const n = Number(text.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function validateFeedDraft(draft: FeedDraft, now: Date = new Date()): FeedResult {
  const errors: FeedErrors = {};

  if (Number.isNaN(draft.startTime.getTime())) {
    errors.time = 'Invalid time';
  } else if (draft.startTime.getTime() > now.getTime()) {
    errors.time = "Time can't be in the future";
  }

  const start_time = draft.startTime.toISOString();
  let value: FeedInput;

  if (draft.type === 'breast') {
    if (draft.side !== 'left' && draft.side !== 'right' && draft.side !== 'both') {
      errors.side = 'Pick a side';
    }
    const dur = draft.durationSeconds;
    if (dur == null || dur <= 0) {
      errors.duration = 'Record a time or enter minutes';
    }
    const end_time =
      dur && dur > 0 ? new Date(draft.startTime.getTime() + dur * 1000).toISOString() : null;
    value = {
      type: 'breast',
      start_time,
      end_time,
      side: draft.side,
      // Only attribute a per-side duration when the side is unambiguous; for
      // 'both' the total is recoverable from end_time - start_time.
      duration_left_s: draft.side === 'left' ? (dur ?? null) : null,
      duration_right_s: draft.side === 'right' ? (dur ?? null) : null,
    };
  } else {
    // bottle | pump — both need a positive volume.
    const parsed = parseVolume(draft.volumeText);
    if (parsed === null) errors.volume = 'Enter a volume';

    if (draft.type === 'bottle') {
      if (
        draft.contents !== 'breast_milk' &&
        draft.contents !== 'formula' &&
        draft.contents !== 'mixed'
      ) {
        errors.contents = 'Pick what’s in the bottle';
      }
      value = {
        type: 'bottle',
        start_time,
        volume_ml: parsed !== null ? unitToMl(parsed, draft.unitVolume) : null,
        contents: draft.contents,
      };
    } else {
      // pump — duration is optional; when present, store it as end_time.
      const dur = draft.durationSeconds;
      const end_time =
        dur && dur > 0 ? new Date(draft.startTime.getTime() + dur * 1000).toISOString() : null;
      value = {
        type: 'pump',
        start_time,
        end_time,
        volume_ml: parsed !== null ? unitToMl(parsed, draft.unitVolume) : null,
        side: draft.side, // optional for pump
      };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
