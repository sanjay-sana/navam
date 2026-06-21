// Pure unit conversion + formatting. Canonical storage is ml; we convert only
// at the display edge (CLAUDE.md). Mass/length conversions land with Growth (P5).
import type { UnitVolume } from '@/src/db/types';

const ML_PER_OZ = 29.5735;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Canonical ml → a number in the user's unit (not formatted). */
export function mlToUnit(ml: number, unit: UnitVolume): number {
  return unit === 'oz' ? round1(ml / ML_PER_OZ) : Math.round(ml);
}

/** A value in the user's unit → canonical ml. */
export function unitToMl(value: number, unit: UnitVolume): number {
  return unit === 'oz' ? value * ML_PER_OZ : value;
}

export function volumeUnitLabel(unit: UnitVolume): string {
  return unit === 'oz' ? 'oz' : 'ml';
}

/** Canonical ml → display string in the user's unit, e.g. "90 ml" / "3.1 oz". */
export function formatVolume(ml: number, unit: UnitVolume): string {
  return `${mlToUnit(ml, unit)} ${volumeUnitLabel(unit)}`;
}
