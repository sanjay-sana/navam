// Pure unit conversion + formatting. Canonical storage is ml / grams / cm; we
// convert only at the display edge (CLAUDE.md).
import type { UnitLength, UnitMass, UnitVolume } from '@/src/db/types';

const ML_PER_OZ = 29.5735;
const G_PER_LB = 453.592;
const OZ_PER_LB = 16;
const CM_PER_IN = 2.54;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

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

// --- Mass (canonical grams) -------------------------------------------------

/** Grams → display value: kg (2 dp, preserves the 10 g wheel step) or lb (1 dp). */
export function gramsToUnit(grams: number, unit: UnitMass): number {
  return unit === 'lb_oz' ? round1(grams / G_PER_LB) : round2(grams / 1000);
}

/** A weight entered in the user's unit → canonical grams. */
export function unitToGrams(value: number, unit: UnitMass): number {
  return unit === 'lb_oz' ? value * G_PER_LB : value * 1000;
}

export function massUnitLabel(unit: UnitMass): string {
  return unit === 'lb_oz' ? 'lb' : 'kg';
}

/** Grams → display string, e.g. "5.9 kg". lb_oz renders as "13 lb 0 oz". */
export function formatMass(grams: number, unit: UnitMass): string {
  if (unit === 'lb_oz') {
    const totalOz = grams / (G_PER_LB / OZ_PER_LB);
    const lb = Math.floor(totalOz / OZ_PER_LB);
    const oz = Math.round(totalOz - lb * OZ_PER_LB);
    return `${lb} lb ${oz} oz`;
  }
  return `${gramsToUnit(grams, unit)} kg`;
}

// --- Length (canonical cm) --------------------------------------------------

export function cmToUnit(cm: number, unit: UnitLength): number {
  return unit === 'in' ? round1(cm / CM_PER_IN) : round1(cm);
}

export function unitToCm(value: number, unit: UnitLength): number {
  return unit === 'in' ? value * CM_PER_IN : value;
}

export function lengthUnitLabel(unit: UnitLength): string {
  return unit === 'in' ? 'in' : 'cm';
}

export function formatLength(cm: number, unit: UnitLength): string {
  return `${cmToUnit(cm, unit)} ${lengthUnitLabel(unit)}`;
}
