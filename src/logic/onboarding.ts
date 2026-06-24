// Pure validation for the onboarding / profile form. No React, no DB — unit-testable.
import type { BabyInput, Sex } from '@/src/db/types';

export interface BabyDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  sex: Sex | null;
  /** Local date-only; null until the user picks one. */
  dob: Date | null;
}

export interface BabyDraftErrors {
  firstName?: string;
  sex?: string;
  dob?: string;
}

export type ValidationResult =
  | { ok: true; value: BabyInput }
  | { ok: false; errors: BabyDraftErrors };

/** Format a local Date as a date-only ISO string (yyyy-MM-dd), TZ-safe. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Validate a draft into a persistable BabyInput.
 * `now` is injectable so tests don't depend on the wall clock.
 */
export function validateBabyDraft(draft: BabyDraft, now: Date = new Date()): ValidationResult {
  const errors: BabyDraftErrors = {};

  const firstName = draft.firstName.trim();
  if (firstName.length === 0) errors.firstName = 'Enter a first name';

  if (draft.sex !== 'male' && draft.sex !== 'female') {
    errors.sex = 'Select boy or girl';
  }

  if (!draft.dob) {
    errors.dob = 'Pick a date of birth';
  } else if (Number.isNaN(draft.dob.getTime())) {
    errors.dob = 'Invalid date';
  } else if (toIsoDate(draft.dob) > toIsoDate(now)) {
    // Compare by local calendar day so "born today" is allowed.
    errors.dob = "Date of birth can't be in the future";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      first_name: firstName,
      middle_name: draft.middleName.trim() || null,
      last_name: draft.lastName.trim() || null,
      sex: draft.sex as Sex,
      date_of_birth: toIsoDate(draft.dob!),
    },
  };
}
