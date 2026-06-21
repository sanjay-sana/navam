// WHO percentile line chart: grey P3–P97 bands + the baby's plotted values over
// age (weeks). Growth is continuous measurement data → lines, not bars (§5.3).
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import type { CurvePoint } from '@/src/logic/who';
import { colors, fonts } from '@/src/theme/theme';

export interface BabyPoint {
  weeks: number;
  value: number;
}

export function GrowthChart({
  curves,
  babyPoints,
  width,
  height,
  color = colors.growth,
  formatY = (v) => String(Math.round(v)),
}: {
  curves: { label: string; points: CurvePoint[] }[];
  babyPoints: BabyPoint[];
  width: number;
  height: number;
  color?: string;
  formatY?: (v: number) => string;
}) {
  const leftPad = 30;
  const rightPad = 10;
  const topPad = 12;
  const bottomPad = 24;
  const plotW = width - leftPad - rightPad;
  const plotH = height - topPad - bottomPad;

  const allPoints = [...curves.flatMap((c) => c.points), ...babyPoints];
  if (allPoints.length === 0) return <Svg width={width} height={height} />;

  const maxWeeks = Math.max(...allPoints.map((p) => p.weeks), 1);
  const values = allPoints.map((p) => p.value);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const padY = (yMax - yMin) * 0.08 || 1;
  yMin -= padY;
  yMax += padY;

  const xFor = (weeks: number) => leftPad + plotW * (weeks / maxWeeks);
  const yFor = (v: number) => topPad + plotH * (1 - (v - yMin) / (yMax - yMin));
  const toPoints = (pts: { weeks: number; value: number }[]) =>
    pts.map((p) => `${xFor(p.weeks)},${yFor(p.value)}`).join(' ');

  // y gridlines / labels (4 ticks)
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks);
  // x labels at 0 / mid / max weeks
  const xTicks = [0, Math.round(maxWeeks / 2), maxWeeks];

  return (
    <Svg width={width} height={height}>
      {yTicks.map((v, i) => (
        <Line key={`g${i}`} x1={leftPad} y1={yFor(v)} x2={width - rightPad} y2={yFor(v)} stroke={colors.border} strokeWidth={1} />
      ))}
      {yTicks.map((v, i) => (
        <SvgText key={`yl${i}`} x={leftPad - 6} y={yFor(v) + 4} fill={colors.dim} fontSize={10} fontFamily={fonts.ui} textAnchor="end">
          {formatY(v)}
        </SvgText>
      ))}
      {xTicks.map((w, i) => (
        <SvgText key={`xl${i}`} x={xFor(w)} y={height - 8} fill={colors.dim} fontSize={10} fontFamily={fonts.ui} textAnchor="middle">
          {`${w}w`}
        </SvgText>
      ))}

      {curves.map((c) => (
        <Polyline key={c.label} points={toPoints(c.points)} fill="none" stroke={colors.dim} strokeWidth={1} opacity={0.5} />
      ))}

      {babyPoints.length > 1 ? (
        <Polyline points={toPoints(babyPoints)} fill="none" stroke={color} strokeWidth={3} />
      ) : null}
      {babyPoints.map((p, i) => (
        <Circle key={`p${i}`} cx={xFor(p.weeks)} cy={yFor(p.value)} r={4} fill={color} />
      ))}
    </Svg>
  );
}
