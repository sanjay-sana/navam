// Shared wheel-column configs for entering measurements in the user's units.
// Display values: weight = kg/lb decimal, length = cm/total inches, volume =
// ml/oz. Used by the growth form, onboarding (birth weight), and the feed form.
import type { WheelColumnSpec } from '@/src/components/WheelPicker';
import type { UnitLength, UnitMass, UnitVolume } from '@/src/db/types';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const nums = (a: number, b: number, step = 1): WheelColumnSpec['items'] =>
  Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => ({
    label: String(Math.round((a + i * step) * 100) / 100),
  }));

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

// --- volume (display value: ml in 5s, or oz in 0.5s) ------------------------
const volStep = (u: UnitVolume) => (u === 'oz' ? 0.5 : 5);
const volMax = (u: UnitVolume) => (u === 'oz' ? 12 : 360);

export function volumeColumns(unit: UnitVolume): WheelColumnSpec[] {
  return [{ items: nums(0, volMax(unit), volStep(unit)), label: unit }];
}
export function volumeInitial(unit: UnitVolume, v: number): number[] {
  const step = volStep(unit);
  return [clamp(Math.round(v / step), 0, Math.round(volMax(unit) / step))];
}
export const volumeCompose = (unit: UnitVolume, i: number[]) =>
  Math.round(i[0] * volStep(unit) * 100) / 100;
export function volumeLabel(v: number, unit: UnitVolume): string {
  return `${v} ${unit}`;
}
