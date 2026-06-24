// Row shapes mirroring the SQLite schema (see migrations.ts / schema.sql).
// All timestamps are UTC ISO-8601 strings; date_of_birth / measured_at are
// date-only ISO (yyyy-MM-dd). Canonical units: ml, grams, cm.

export type Sex = 'male' | 'female';
export type FeedType = 'breast' | 'bottle' | 'pump';
export type Side = 'left' | 'right' | 'both';
export type Contents = 'breast_milk' | 'formula' | 'mixed';
export type DiaperType = 'wet' | 'dirty' | 'both';

export type UnitVolume = 'ml' | 'oz';
export type UnitMass = 'g' | 'lb_oz';
export type UnitLength = 'cm' | 'in';

export interface Baby {
  id: number;
  name: string; // full display name (first + middle + last), kept in sync by the repo
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  sex: Sex;
  date_of_birth: string; // yyyy-MM-dd
  created_at: string;
  updated_at: string;
}

/** Fields captured at onboarding / profile edit. */
export interface BabyInput {
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  sex: Sex;
  date_of_birth: string; // yyyy-MM-dd
}

export interface Settings {
  id: 1;
  unit_volume: UnitVolume;
  unit_mass: UnitMass;
  unit_length: UnitLength;
  active_baby_id: number | null;
  theme: string;
  updated_at: string;
}

export interface ReminderConfig {
  id: number;
  baby_id: number;
  type: 'feed';
  enabled: 0 | 1;
  interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface FeedEvent {
  id: number;
  baby_id: number;
  type: FeedType;
  start_time: string; // UTC ISO
  end_time: string | null;
  side: Side | null;
  duration_left_s: number | null;
  duration_right_s: number | null;
  volume_ml: number | null;
  contents: Contents | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields written when logging / editing a feed (ids + timestamps added by repo). */
export interface FeedInput {
  type: FeedType;
  start_time: string; // UTC ISO
  end_time?: string | null;
  side?: Side | null;
  duration_left_s?: number | null;
  duration_right_s?: number | null;
  volume_ml?: number | null; // canonical ml
  contents?: Contents | null;
  notes?: string | null;
}

export interface DiaperEvent {
  id: number;
  baby_id: number;
  time: string; // UTC ISO
  type: DiaperType;
  color: string | null;
  consistency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiaperInput {
  time: string; // UTC ISO
  type: DiaperType;
  color?: string | null;
  consistency?: string | null;
  notes?: string | null;
}

export interface GrowthMeasurement {
  id: number;
  baby_id: number;
  measured_at: string; // date-only ISO (yyyy-MM-dd)
  weight_g: number | null;
  length_cm: number | null;
  head_circumference_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthInput {
  measured_at: string; // yyyy-MM-dd
  weight_g?: number | null;
  length_cm?: number | null;
  head_circumference_cm?: number | null;
  notes?: string | null;
}
