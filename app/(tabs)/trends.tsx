import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart } from '@/src/components/BarChart';
import { GrowthChart } from '@/src/components/GrowthChart';
import { Segmented } from '@/src/components/Segmented';
import { StackedBarChart } from '@/src/components/StackedBarChart';
import * as repo from '@/src/db/repo';
import type { GrowthMeasurement } from '@/src/db/types';
import { ageInMonths, ageInWeeks, formatAge } from '@/src/logic/age';
import {
  cmToUnit,
  formatLength,
  formatMass,
  gramsToUnit,
  lengthUnitLabel,
  massUnitLabel,
  mlToUnit,
  volumeUnitLabel,
} from '@/src/logic/units';
import {
  buildTrendDays,
  trendSummary,
  type TrendDay,
  type TrendRange,
} from '@/src/logic/trends';
import {
  formatPercentile,
  isSupported,
  percentileFor,
  whoCurves,
  type GrowthMetric,
} from '@/src/logic/who';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const CHART_W = Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2;

export default function TrendsScreen() {
  const [view, setView] = useState<'activity' | 'growth'>('activity');
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Trends</Text>
        <Segmented
          options={[
            { label: 'Activity', value: 'activity' },
            { label: 'Growth', value: 'growth' },
          ]}
          value={view}
          onChange={setView}
        />
        {view === 'activity' ? <ActivityView /> : <GrowthView />}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Activity ---------------------------------------------------------------

function ActivityView() {
  const { activeBaby, settings } = useAppData();
  const unit = settings?.unit_volume ?? 'ml';
  const [range, setRange] = useState<TrendRange>(7);
  const [mode, setMode] = useState<'count' | 'volume'>('count');
  const [days, setDays] = useState<TrendDay[]>([]);

  const load = useCallback(async () => {
    if (!activeBaby) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (range - 1));
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const [feeds, diapers] = await Promise.all([
      repo.getFeedEventsBetween(activeBaby.id, start.toISOString(), end.toISOString()),
      repo.getDiaperEventsBetween(activeBaby.id, start.toISOString(), end.toISOString()),
    ]);
    setDays(buildTrendDays(feeds, diapers, range, now));
  }, [activeBaby, range]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const summary = trendSummary(days);

  return (
    <>
      <View style={styles.rangeRow}>
        <Segmented
          options={[
            { label: '7d', value: '7' },
            { label: '14d', value: '14' },
            { label: '30d', value: '30' },
          ]}
          value={String(range)}
          onChange={(v) => setRange(Number(v) as TrendRange)}
        />
      </View>

      {/* Milk intake */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>MILK INTAKE</Text>
          <View style={styles.headerToggle}>
            <Segmented
              options={[
                { label: 'Count', value: 'count' as const },
                { label: 'Volume', value: 'volume' as const },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>
        </View>
        {/* Caption row always present so the card height is the same in both modes. */}
        <View style={styles.noteRow}>
          <Text style={styles.note}>{mode === 'volume' ? 'bottle volume only' : 'breast + bottle'}</Text>
          {mode === 'volume' && summary.hasBottle ? (
            <Text style={styles.avgNote}>
              avg {mlToUnit(summary.avgIntakeMl, unit)} {volumeUnitLabel(unit)}
            </Text>
          ) : null}
        </View>

        {mode === 'count' ? (
          <BarChart
            data={days.map((d) => ({ label: d.label, value: d.feedCount }))}
            width={CHART_W}
            height={180}
          />
        ) : summary.hasBottle ? (
          <BarChart
            data={days.map((d) => ({ label: d.label, value: mlToUnit(d.bottleMl, unit) }))}
            width={CHART_W}
            height={180}
            avg={mlToUnit(summary.avgIntakeMl, unit)}
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.empty}>No bottle feeds in this range.</Text>
          </View>
        )}
      </View>

      {/* Diapers */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>DIAPERS</Text>
          <View style={styles.legend}>
            <Legend color={colors.diaper} label="wet" />
            <Legend color={colors.accent} label="dirty" />
          </View>
        </View>
        <StackedBarChart
          data={days.map((d) => ({ label: d.label, wet: d.wet, dirty: d.dirty }))}
          width={CHART_W}
          height={180}
        />
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <SummaryCard value={String(mlToUnit(summary.avgIntakeMl, unit))} label={`${volumeUnitLabel(unit)}/day in`} />
        <SummaryCard value={String(summary.avgDiapers)} label="diapers/day" />
        <SummaryCard value={String(mlToUnit(summary.avgPumpMl, unit))} label={`${volumeUnitLabel(unit)} pumped`} />
      </View>
    </>
  );
}

// --- Growth -----------------------------------------------------------------

const METRICS: { label: string; value: GrowthMetric }[] = [
  { label: 'Weight', value: 'weight' },
  { label: 'Length', value: 'length' },
];

function GrowthView() {
  const router = useRouter();
  const { activeBaby, settings } = useAppData();
  const unitMass = settings?.unit_mass ?? 'g';
  const unitLength = settings?.unit_length ?? 'cm';
  const [metric, setMetric] = useState<GrowthMetric>('weight');
  const [rows, setRows] = useState<GrowthMeasurement[]>([]);

  const load = useCallback(async () => {
    if (!activeBaby) return;
    setRows(await repo.getGrowthMeasurements(activeBaby.id));
  }, [activeBaby]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!activeBaby) return null;

  const supported = isSupported(metric);
  const dob = activeBaby.date_of_birth;

  // Canonical metric value (kg / cm) for a row, or null if missing.
  const metricCanonical = (r: GrowthMeasurement): number | null => {
    if (metric === 'weight') return r.weight_g != null ? r.weight_g / 1000 : null;
    if (metric === 'length') return r.length_cm;
    return r.head_circumference_cm;
  };

  const measured = rows
    .map((r) => ({ row: r, value: metricCanonical(r) }))
    .filter((x) => x.value != null) as { row: GrowthMeasurement; value: number }[];

  const toDisplay = (canonical: number) =>
    metric === 'weight' ? gramsToUnit(canonical * 1000, unitMass) : cmToUnit(canonical, unitLength);

  const babyPoints = measured.map((m) => ({
    weeks: ageInWeeks(dob, new Date(`${m.row.measured_at}T00:00:00`)),
    value: toDisplay(m.value),
  }));

  const maxBabyWeeks = babyPoints.reduce((mx, p) => Math.max(mx, p.weeks), 0);
  const maxWeeks = Math.min(104, Math.max(26, maxBabyWeeks + 8));
  const curves = supported
    ? whoCurves(metric, activeBaby.sex, maxWeeks).map((c) => ({
        label: c.label,
        points: c.points.map((p) => ({ weeks: p.weeks, value: toDisplay(p.value) })),
      }))
    : [];

  const latest = measured.length > 0 ? measured[measured.length - 1] : null;
  const latestPct =
    latest && supported
      ? percentileFor(
          metric,
          activeBaby.sex,
          ageInMonths(dob, new Date(`${latest.row.measured_at}T00:00:00`)),
          latest.value
        )
      : null;

  return (
    <>
      <View style={styles.metricRow}>
        {METRICS.map((m) => {
          const disabled = !isSupported(m.value);
          const selected = metric === m.value;
          return (
            <Pressable
              key={m.value}
              disabled={disabled}
              onPress={() => setMetric(m.value)}
              style={[styles.metricBtn, selected && styles.metricBtnSel, disabled && styles.metricBtnDis]}
            >
              <Text style={[styles.metricText, selected && styles.metricTextSel, disabled && styles.metricTextDis]}>
                {m.label}
                {disabled ? ' · soon' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {!supported ? (
          <Text style={styles.empty}>Head circumference charts are coming soon.</Text>
        ) : measured.length === 0 ? (
          <Text style={styles.empty}>No measurements yet. Add one to see percentiles.</Text>
        ) : (
          <>
            <GrowthChart
              curves={curves}
              babyPoints={babyPoints}
              width={CHART_W}
              height={230}
              formatY={(v) => (metric === 'weight' ? String(Math.round(v)) : String(Math.round(v)))}
            />
            <View style={styles.legend}>
              <Legend color={colors.growth} label={activeBaby.name} />
              <Legend color={colors.dim} label="WHO P3–P97" />
            </View>
          </>
        )}
      </View>

      {latest ? (
        <View style={styles.latestCard}>
          <Text style={styles.latestValue}>
            {metric === 'weight'
              ? formatMass(latest.value * 1000, unitMass)
              : formatLength(latest.value, unitLength)}
            {latestPct != null ? <Text style={styles.latestPct}>{`  ·  ${formatPercentile(latestPct)} pct`}</Text> : null}
          </Text>
          <Text style={styles.latestSub}>
            {formatAge(dob, new Date(`${latest.row.measured_at}T00:00:00`))} · last measured{' '}
            {latest.row.measured_at}
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.addButton} onPress={() => router.push('/log-growth')}>
        <Text style={styles.addText}>Add measurement</Text>
      </Pressable>

      {rows.length > 0 ? (
        <View style={styles.measList}>
          {[...rows].reverse().map((m) => {
            const parts = [
              m.weight_g != null ? formatMass(m.weight_g, unitMass) : null,
              m.length_cm != null ? formatLength(m.length_cm, unitLength) : null,
            ].filter(Boolean) as string[];
            return (
              <Pressable
                key={m.id}
                style={styles.measRow}
                onPress={() => router.push({ pathname: '/log-growth', params: { id: String(m.id) } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.measDate}>
                    {format(new Date(`${m.measured_at}T00:00:00`), 'd MMM yyyy')}
                  </Text>
                  {parts.length > 0 ? <Text style={styles.measVals}>{parts.join(' · ')}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.dim} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },
  rangeRow: { marginTop: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: spacing.md },
  cardTitle: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 0.5, color: colors.dim, flexShrink: 1 },
  headerToggle: { width: 168 },
  note: { fontFamily: fonts.ui, fontSize: 12, color: colors.dim },
  noteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  avgNote: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.dim },
  empty: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, textAlign: 'center', paddingVertical: spacing.xl },
  chartEmpty: { height: 180, alignItems: 'center', justifyContent: 'center' },

  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fonts.ui, fontSize: 13, color: colors.dim },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  summaryValue: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  summaryLabel: { fontFamily: fonts.ui, fontSize: 12, color: colors.dim, marginTop: spacing.xs, textAlign: 'center' },

  metricRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  metricBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center' },
  metricBtnSel: { backgroundColor: colors.growthSoft, borderColor: colors.growth },
  metricBtnDis: { opacity: 0.4 },
  metricText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.dim },
  metricTextSel: { color: colors.growth },
  metricTextDis: { color: colors.dim },

  latestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  latestValue: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  latestPct: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.growth },
  latestSub: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: spacing.xs },

  addButton: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.growth,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  addText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.growth },
  measList: { marginTop: spacing.lg, gap: spacing.sm },
  measRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  measDate: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.text },
  measVals: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: 2 },
});
