// Pure validation: a Log-diaper draft → a persistable DiaperInput. No React/DB.
// §5.2: type wet/dirty/both, time defaults to now, future times blocked.
import type { DiaperInput, DiaperType } from '@/src/db/types';

export interface DiaperDraft {
  type: DiaperType | null;
  time: Date;
  color?: string | null;
  consistency?: string | null;
  notes?: string;
  flagged?: boolean;
}

export interface DiaperErrors {
  type?: string;
  time?: string;
}

export type DiaperResult =
  | { ok: true; value: DiaperInput }
  | { ok: false; errors: DiaperErrors };

export function validateDiaperDraft(draft: DiaperDraft, now: Date = new Date()): DiaperResult {
  const errors: DiaperErrors = {};

  if (draft.type !== 'wet' && draft.type !== 'dirty' && draft.type !== 'both') {
    errors.type = 'Pick a type';
  }
  if (Number.isNaN(draft.time.getTime())) {
    errors.time = 'Invalid time';
  } else if (draft.time.getTime() > now.getTime()) {
    errors.time = "Time can't be in the future";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  // Colour/consistency only apply to stool (dirty/both); ignore them for wet.
  const hasStool = draft.type === 'dirty' || draft.type === 'both';
  return {
    ok: true,
    value: {
      type: draft.type as DiaperType,
      time: draft.time.toISOString(),
      color: hasStool ? draft.color ?? null : null,
      consistency: hasStool ? draft.consistency ?? null : null,
      notes: draft.notes?.trim() || null,
      flagged: draft.flagged ? 1 : 0,
    },
  };
}
