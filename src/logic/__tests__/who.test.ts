import { formatPercentile, percentileFor, whoCurves } from '@/src/logic/who';

describe('percentileFor', () => {
  it('returns ~50th at the WHO median (boys weight at birth M=3.3464 kg)', () => {
    expect(percentileFor('weight', 'male', 0, 3.3464)).toBeCloseTo(50, 0);
  });

  it('is monotonic increasing in value', () => {
    const lo = percentileFor('weight', 'male', 2, 5.0)!;
    const hi = percentileFor('weight', 'male', 2, 6.5)!;
    expect(hi).toBeGreaterThan(lo);
  });

  it('maps the P3 / P97 band values to ~3rd / ~97th', () => {
    const curves = whoCurves('weight', 'male', 26);
    const p3 = curves.find((c) => c.label === 'P3')!.points[0].value;
    const p97 = curves.find((c) => c.label === 'P97')!.points[0].value;
    expect(percentileFor('weight', 'male', 0, p3)).toBeCloseTo(3, 0);
    expect(percentileFor('weight', 'male', 0, p97)).toBeCloseTo(97, 0);
  });

  it('returns null for the unsupported head metric', () => {
    expect(percentileFor('head', 'male', 2, 40)).toBeNull();
  });
});

describe('whoCurves', () => {
  it('matches the WHO girls length median at birth (~49.15 cm)', () => {
    const p50 = whoCurves('length', 'female', 4).find((c) => c.label === 'P50')!.points[0].value;
    expect(p50).toBeCloseTo(49.1477, 2);
  });

  it('returns no curves for head (unsupported)', () => {
    expect(whoCurves('head', 'male', 26)).toHaveLength(0);
  });

  it('produces the 5 standard percentile bands', () => {
    expect(whoCurves('weight', 'male', 26).map((c) => c.label)).toEqual([
      'P3',
      'P15',
      'P50',
      'P85',
      'P97',
    ]);
  });
});

describe('formatPercentile', () => {
  it.each([
    [62, '62nd'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [21, '21st'],
  ])('formats %i as %s', (n, expected) => {
    expect(formatPercentile(n)).toBe(expected);
  });
});
