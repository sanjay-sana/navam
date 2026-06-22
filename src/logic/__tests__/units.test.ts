import {
  cmToUnit,
  formatLength,
  formatMass,
  formatVolume,
  gramsToUnit,
  mlToUnit,
  unitToCm,
  unitToGrams,
  unitToMl,
} from '@/src/logic/units';

describe('volume (canonical ml)', () => {
  it('rounds ml to integer and oz to 1 dp', () => {
    expect(mlToUnit(90.4, 'ml')).toBe(90);
    expect(mlToUnit(88.7205, 'oz')).toBe(3);
  });
  it('converts user units back to ml', () => {
    expect(unitToMl(3, 'oz')).toBeCloseTo(88.7205, 3);
    expect(unitToMl(90, 'ml')).toBe(90);
  });
  it('formats with unit label', () => {
    expect(formatVolume(90, 'ml')).toBe('90 ml');
    expect(formatVolume(88.7205, 'oz')).toBe('3 oz');
  });
});

describe('mass (canonical grams)', () => {
  it('formats kg and lb', () => {
    expect(formatMass(5900, 'g')).toBe('5.9 kg');
    expect(formatMass(453.592 * 13, 'lb_oz')).toBe('13 lb 0 oz');
  });
  it('round-trips kg', () => {
    expect(unitToGrams(5.9, 'g')).toBeCloseTo(5900, 6);
    expect(gramsToUnit(5900, 'g')).toBe(5.9);
  });
});

describe('length (canonical cm)', () => {
  it('formats cm and in', () => {
    expect(formatLength(58.4, 'cm')).toBe('58.4 cm');
    expect(formatLength(2.54, 'in')).toBe('1 in');
  });
  it('round-trips inches', () => {
    expect(unitToCm(10, 'in')).toBeCloseTo(25.4, 6);
    expect(cmToUnit(25.4, 'in')).toBe(10);
  });
});
