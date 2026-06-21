// WHO percentile maths over the bundled LMS asset (real WHO Child Growth
// Standards, weight + length, 0-24 months). Pure; no React/DB.
//
// LMS: value(z) = M·(1 + L·S·z)^(1/L)   (L≠0)   |   M·exp(S·z)  (L=0)
//      z(value) = ((value/M)^L − 1)/(L·S)        |   ln(value/M)/S
import lms from '@/assets/who/who-lms.json';
import type { Sex } from '@/src/db/types';

export type GrowthMetric = 'weight' | 'length' | 'head';

interface LMSPoint {
  ageMonths: number;
  l: number;
  m: number;
  s: number;
}

const TABLES: Record<'weight' | 'length', Record<Sex, LMSPoint[]>> = {
  weight: lms.weight as Record<Sex, LMSPoint[]>,
  length: lms.length as Record<Sex, LMSPoint[]>,
};

/** Metrics we have real WHO data for (head circumference pending a source). */
export const SUPPORTED_METRICS: GrowthMetric[] = ['weight', 'length'];
export function isSupported(metric: GrowthMetric): metric is 'weight' | 'length' {
  return metric === 'weight' || metric === 'length';
}

const WEEKS_PER_MONTH = 52 / 12; // 4.333…

export const PERCENTILE_BANDS = [
  { label: 'P3', z: -1.88079 },
  { label: 'P15', z: -1.03643 },
  { label: 'P50', z: 0 },
  { label: 'P85', z: 1.03643 },
  { label: 'P97', z: 1.88079 },
] as const;

/** Linearly interpolate LMS at a fractional age (clamped to table range). */
function lmsAt(metric: 'weight' | 'length', sex: Sex, ageMonths: number): LMSPoint {
  const table = TABLES[metric][sex];
  const first = table[0];
  const last = table[table.length - 1];
  if (ageMonths <= first.ageMonths) return first;
  if (ageMonths >= last.ageMonths) return last;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (ageMonths >= a.ageMonths && ageMonths <= b.ageMonths) {
      const t = (ageMonths - a.ageMonths) / (b.ageMonths - a.ageMonths);
      return {
        ageMonths,
        l: a.l + t * (b.l - a.l),
        m: a.m + t * (b.m - a.m),
        s: a.s + t * (b.s - a.s),
      };
    }
  }
  return last;
}

function valueForZ({ l, m, s }: LMSPoint, z: number): number {
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

function zForValue({ l, m, s }: LMSPoint, value: number): number {
  return l === 0 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
}

// Abramowitz & Stegun 7.1.26 erf approximation → standard normal CDF.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Percentile (0-100) for a measured value at an age. Weight in kg, length in cm.
 * Returns null for unsupported metrics.
 */
export function percentileFor(
  metric: GrowthMetric,
  sex: Sex,
  ageMonths: number,
  value: number
): number | null {
  if (!isSupported(metric)) return null;
  const point = lmsAt(metric, sex, ageMonths);
  return normalCdf(zForValue(point, value)) * 100;
}

export interface CurvePoint {
  weeks: number;
  value: number;
}

/** Sample each percentile band across [0, maxWeeks] for plotting. */
export function whoCurves(
  metric: GrowthMetric,
  sex: Sex,
  maxWeeks: number,
  stepWeeks = 2
): { label: string; points: CurvePoint[] }[] {
  if (!isSupported(metric)) return [];
  return PERCENTILE_BANDS.map((band) => {
    const points: CurvePoint[] = [];
    for (let w = 0; w <= maxWeeks; w += stepWeeks) {
      const point = lmsAt(metric, sex, w / WEEKS_PER_MONTH);
      points.push({ weeks: w, value: valueForZ(point, band.z) });
    }
    return { label: band.label, points };
  });
}

/** Ordinal percentile label, e.g. 62 → "62nd". */
export function formatPercentile(p: number): string {
  const n = Math.round(p);
  const mod100 = n % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : n % 10 === 1
        ? 'st'
        : n % 10 === 2
          ? 'nd'
          : n % 10 === 3
            ? 'rd'
            : 'th';
  return `${n}${suffix}`;
}
