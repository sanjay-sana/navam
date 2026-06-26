// Shared wheel-column configs for entering weight + length/height in the user's
// units. Display values: weight = kg or lb decimal; length = cm or total inches.
// Used by the growth form and onboarding (birth weight).
import type { WheelColumnSpec } from '@/src/components/WheelPicker';
import type { UnitLength, UnitMass } from '@/src/db/types';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const nums = (a: number, b: number, step = 1): WheelColumnSpec['items'] =>
  Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => ({ label: String(a + i * step) }));

export function weightColumns(unit: UnitMass): WheelColumnSpec[] {
  return unit === 'lb_oz'
    ? [{ items: nums(0, 66), label: 'lb' }, { items: nums(0, 15), label: 'oz' }]
    : [{ items: nums(0, 30), label: 'kg' }, { items: nums(0, 990, 10), label: 'g' }];
}
export function weightInitial(unit: UnitMass, v: number): number[] {
  const whole = Math.floor(v);
  return unit === 'lb_oz'
    ? [clamp(whole, 0, 66), clamp(Math.round((v - whole) * 16), 0, 15)]
    : [clamp(whole, 0, 30), clamp(Math.round((v - whole) * 100), 0, 99)];
}
export const weightCompose = (unit: UnitMass, i: number[]) =>
  unit === 'lb_oz' ? i[0] + i[1] / 16 : i[0] + (i[1] * 10) / 1000;
export function weightLabel(v: number, unit: UnitMass): string {
  const whole = Math.floor(v);
  if (unit === 'lb_oz') return `${whole} lb ${Math.round((v - whole) * 16)} oz`;
  const g = Math.round((v - whole) * 1000);
  return g > 0 ? `${whole} kg ${g} g` : `${whole} kg`;
}

export function lengthColumns(unit: UnitLength): WheelColumnSpec[] {
  return unit === 'in'
    ? [{ items: nums(0, 8), label: 'ft' }, { items: nums(0, 11), label: 'in' }]
    : [{ items: nums(20, 130), label: 'cm' }];
}
export function lengthInitial(unit: UnitLength, v: number): number[] {
  if (unit === 'in') {
    const ft = clamp(Math.floor(v / 12), 0, 8);
    return [ft, clamp(Math.round(v - ft * 12), 0, 11)];
  }
  return [clamp(Math.round(v) - 20, 0, 110)];
}
export const lengthCompose = (unit: UnitLength, i: number[]) =>
  unit === 'in' ? i[0] * 12 + i[1] : 20 + i[0];
export function lengthLabel(v: number, unit: UnitLength): string {
  if (unit === 'in') {
    const ft = Math.floor(v / 12);
    return `${ft} ft ${Math.round(v - ft * 12)} in`;
  }
  return `${Math.round(v)} cm`;
}
