// Pick sensible default measurement units for a device region. Pure/testable.
// Only the US, Liberia (LR) and Myanmar (MM) are non-metric; everyone else
// gets metric. Applied once on first launch; the user can change it in Settings.
import type { UnitLength, UnitMass, UnitVolume } from '@/src/db/types';

export interface UnitDefaults {
  unit_volume: UnitVolume;
  unit_mass: UnitMass;
  unit_length: UnitLength;
}

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export function defaultUnitsForRegion(region: string | null | undefined): UnitDefaults {
  const imperial = !!region && IMPERIAL_REGIONS.has(region.toUpperCase());
  return imperial
    ? { unit_volume: 'oz', unit_mass: 'lb_oz', unit_length: 'in' }
    : { unit_volume: 'ml', unit_mass: 'g', unit_length: 'cm' };
}
