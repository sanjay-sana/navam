// Stacked daily bars for diapers: wet (bottom) + dirty (top). A "both" event
// contributes to each, so the stack total reconciles (§5.6).
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

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
}: {
  data: StackedDatum[];
  width: number;
  height: number;
  wetColor?: string;
  dirtyColor?: string;
}) {
  const topPad = 22;
  const bottomPad = 22;
  const plotH = height - topPad - bottomPad;
  const max = Math.max(...data.map((d) => d.wet + d.dirty), 1);
  const slot = width / data.length;
  const barW = Math.min(slot * 0.55, 34);

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
            {total > 0 ? String(total) : ''}
          </SvgText>
        );
      })}
      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        return (
          <SvgText key={`l${i}`} x={cx} y={height - 6} fill={colors.dim} fontSize={11} fontFamily={fonts.ui} textAnchor="middle">
            {d.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
