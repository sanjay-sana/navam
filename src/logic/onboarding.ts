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
  middleName?: string;
  lastName?: string;
  sex?: string;
  dob?: string;
}

/** Max length per name part — caps input so long names can't break layouts or
 *  the export/backup filename. Character set is intentionally unrestricted so
 *  accents, apostrophes, hyphens, and non-Latin names are all accepted. */
export const NAME_MAX_LENGTH = 40;

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
  const middleName = draft.middleName.trim();
  const lastName = draft.lastName.trim();
  if (firstName.length === 0) errors.firstName = 'Enter a first name';
  else if (firstName.length > NAME_MAX_LENGTH) errors.firstName = `Keep it under ${NAME_MAX_LENGTH} characters`;
  if (middleName.length > NAME_MAX_LENGTH) errors.middleName = `Keep it under ${NAME_MAX_LENGTH} characters`;
  if (lastName.length > NAME_MAX_LENGTH) errors.lastName = `Keep it under ${NAME_MAX_LENGTH} characters`;

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
      middle_name: middleName || null,
      last_name: lastName || null,
      sex: draft.sex as Sex,
      date_of_birth: toIsoDate(draft.dob!),
    },
  };
}
