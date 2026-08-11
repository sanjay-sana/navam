import { defaultUnitsForRegion } from '@/src/logic/regionUnits';

describe('defaultUnitsForRegion', () => {
  it('uses imperial for the non-metric regions (US/LR/MM)', () => {
    for (const r of ['US', 'us', 'LR', 'MM']) {
      expect(defaultUnitsForRegion(r)).toEqual({ unit_volume: 'oz', unit_mass: 'lb_oz', unit_length: 'in' });
    }
  });

  it('uses metric everywhere else, and for unknown/null', () => {
    for (const r of ['GB', 'IN', 'DE', 'JP', '', null, undefined]) {
      expect(defaultUnitsForRegion(r)).toEqual({ unit_volume: 'ml', unit_mass: 'g', unit_length: 'cm' });
    }
  });
});
