// Pure age helpers from a date-of-birth (date-only ISO) to a reference date.
// Used by Growth (age axis + WHO lookup) and the latest-measurement card.

const MS_PER_DAY = 86_400_000;

/** Whole days from DOB to `at` (local-day based; never negative). */
export function ageInDays(dobIso: string, at: Date = new Date()): number {
  const dob = new Date(`${dobIso}T00:00:00`);
  const atDay = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return Math.max(0, Math.round((atDay.getTime() - dob.getTime()) / MS_PER_DAY));
}

export function ageInWeeks(dobIso: string, at: Date = new Date()): number {
  return Math.floor(ageInDays(dobIso, at) / 7);
}

/** Fractional age in months (avg month = 30.4375 days) — for WHO LMS lookup. */
export function ageInMonths(dobIso: string, at: Date = new Date()): number {
  return ageInDays(dobIso, at) / 30.4375;
}

/** Human label, e.g. "5 days", "8 weeks", "14 months". */
export function formatAge(dobIso: string, at: Date = new Date()): string {
  const days = ageInDays(dobIso, at);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 16) return `${weeks} weeks`;
  const months = Math.floor(days / 30.4375);
  return `${months} months`;
}
