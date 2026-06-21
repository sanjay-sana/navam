// Pure validation: a growth-measurement draft → GrowthInput. ≥1 of weight /
// length / head required; values converted to canonical (g, cm). No React/DB.
import type { GrowthInput, UnitLength, UnitMass } from '@/src/db/types';
import { toIsoDate } from './onboarding';
import { unitToCm, unitToGrams } from './units';

export interface GrowthDraft {
  measuredAt: Date;
  weightText: string; // user mass unit
  lengthText: string; // user length unit
  headText: string; // user length unit
  unitMass: UnitMass;
  unitLength: UnitLength;
}

export interface GrowthErrors {
  weight?: string;
  length?: string;
  head?: string;
  date?: string;
  general?: string;
}

export type GrowthResult =
  | { ok: true; value: GrowthInput }
  | { ok: false; errors: GrowthErrors };

/** null = blank (allowed), NaN = present-but-invalid. */
function parseField(text: string): number | null | typeof NaN {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export function validateGrowthDraft(draft: GrowthDraft, now: Date = new Date()): GrowthResult {
  const errors: GrowthErrors = {};

  const weight = parseField(draft.weightText);
  const length = parseField(draft.lengthText);
  const head = parseField(draft.headText);
  if (Number.isNaN(weight)) errors.weight = 'Invalid weight';
  if (Number.isNaN(length)) errors.length = 'Invalid length';
  if (Number.isNaN(head)) errors.head = 'Invalid measurement';

  const provided = [weight, length, head].filter((v) => typeof v === 'number') as number[];
  if (provided.length === 0 && Object.keys(errors).length === 0) {
    errors.general = 'Enter at least one measurement';
  }

  if (Number.isNaN(draft.measuredAt.getTime())) {
    errors.date = 'Invalid date';
  } else if (toIsoDate(draft.measuredAt) > toIsoDate(now)) {
    errors.date = "Date can't be in the future";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      measured_at: toIsoDate(draft.measuredAt),
      weight_g: typeof weight === 'number' ? unitToGrams(weight, draft.unitMass) : null,
      length_cm: typeof length === 'number' ? unitToCm(length, draft.unitLength) : null,
      head_circumference_cm: typeof head === 'number' ? unitToCm(head, draft.unitLength) : null,
    },
  };
}
