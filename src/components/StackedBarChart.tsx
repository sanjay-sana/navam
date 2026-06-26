// Stacked daily bars for diapers: wet (bottom) + dirty (top). A "both" event
// contributes to each, so the stack total reconciles (§5.6).
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/src/theme/theme';

export interface StackedDatum {
  label: string;
  wet: number;
  dirty: number;
}

export function StackedBarChart({
  data,
  width,
  height,
  wetColor = colors.diaper,
  dirtyColor = colors.accent,
  valueFormat = (v) => String(v),
  segmentLabels = false,
}: {
  data: StackedDatum[];
  width: number;
  height: number;
  wetColor?: string;
  dirtyColor?: string;
  valueFormat?: (total: number) => string;
  /** Draw each segment's value inside it (only when bars are wide enough). */
  segmentLabels?: boolean;
}) {
  const topPad = 22;
  const bottomPad = 22;
  const plotH = height - topPad - bottomPad;
  const max = Math.max(...data.map((d) => d.wet + d.dirty), 1);
  const slot = width / data.length;
  const barW = Math.min(slot * 0.55, 34);
  const showSegments = segmentLabels && barW >= 18; // hide on dense 14/30-day views
  // Thin x-axis labels on dense ranges (e.g. 30d), anchored on the latest day.
  const labelStep = data.length <= 14 ? 1 : Math.ceil(data.length / 6);
  const showLabel = (i: number) => (data.length - 1 - i) % labelStep === 0;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const total = d.wet + d.dirty;
        const wetH = (d.wet / max) * plotH;
        const dirtyH = (d.dirty / max) * plotH;
        const baseY = topPad + plotH;
        const x = cx - barW / 2;
        return (
          <Rect key={`w${i}`} x={x} y={baseY - wetH} width={barW} height={wetH} fill={wetColor} rx={total > 0 ? 0 : 5} />
        );
      })}
      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const wetH = (d.wet / max) * plotH;
        const dirtyH = (d.dirty / max) * plotH;
        const baseY = topPad + plotH;
        const x = cx - barW / 2;
        if (d.dirty <= 0) return null;
        return <Rect key={`d${i}`} x={x} y={baseY - wetH - dirtyH} width={barW} height={dirtyH} fill={dirtyColor} rx={5} />;
      })}
      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const total = d.wet + d.dirty;
        const y = topPad + plotH - (total / max) * plotH;
        return (
          <SvgText key={`t${i}`} x={cx} y={y - 6} fill={colors.text} fontSize={12} fontFamily={fonts.uiBold} textAnchor="middle">
            {total > 0 ? valueFormat(total) : ''}
          </SvgText>
        );
      })}
      {showSegments
        ? data.map((d, i) => {
            const cx = i * slot + slot / 2;
            const wetH = (d.wet / max) * plotH;
            const dirtyH = (d.dirty / max) * plotH;
            const baseY = topPad + plotH;
            return (
              <G key={`s${i}`}>
                {d.wet > 0 && wetH >= 14 ? (
                  <SvgText x={cx} y={baseY - wetH / 2 + 4} fill={colors.bg} fontSize={11} fontFamily={fonts.uiBold} textAnchor="middle">
                    {d.wet}
                  </SvgText>
                ) : null}
                {d.dirty > 0 && dirtyH >= 14 ? (
                  <SvgText x={cx} y={baseY - wetH - dirtyH / 2 + 4} fill={colors.bg} fontSize={11} fontFamily={fonts.uiBold} textAnchor="middle">
                    {d.dirty}
                  </SvgText>
                ) : null}
              </G>
            );
          })
        : null}
      {data.map((d, i) =>
        showLabel(i) ? (
          <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 6} fill={colors.dim} fontSize={11} fontFamily={fonts.ui} textAnchor="middle">
            {d.label}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}
