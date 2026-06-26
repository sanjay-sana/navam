// Daily bar chart for Trends (feed count / bottle volume). Value labels on top,
// optional dashed average line. Pure presentational over react-native-svg.
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/src/theme/theme';

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  width,
  height,
  color = colors.accent,
  valueFormat = (v) => String(v),
  avg,
}: {
  data: BarDatum[];
  width: number;
  height: number;
  color?: string;
  valueFormat?: (v: number) => string;
  avg?: number;
}) {
  const topPad = 22;
  const bottomPad = 22;
  const plotH = height - topPad - bottomPad;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = width / data.length;
  const barW = Math.min(slot * 0.55, 34);
  // Thin x-axis labels on dense ranges (e.g. 30d); always keep the first + last bar.
  const labelStep = data.length <= 14 ? 1 : Math.ceil(data.length / 6);
  const showLabel = (i: number) => i % labelStep === 0 || i === data.length - 1;

  const yFor = (v: number) => topPad + plotH * (1 - v / max);

  return (
    <Svg width={width} height={height}>
      {avg != null && avg > 0 ? (
        <Line
          x1={0}
          y1={yFor(avg)}
          x2={width}
          y2={yFor(avg)}
          stroke={colors.dim}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}

      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const barH = (d.value / max) * plotH;
        const y = topPad + plotH - barH;
        return (
          <Rect
            key={i}
            x={cx - barW / 2}
            y={d.value > 0 ? y : topPad + plotH - 1}
            width={barW}
            height={d.value > 0 ? barH : 1}
            rx={5}
            fill={d.value > 0 ? color : colors.surface2}
          />
        );
      })}

      {data.map((d, i) => {
        const cx = i * slot + slot / 2;
        const barH = (d.value / max) * plotH;
        const y = topPad + plotH - barH;
        return (
          <SvgText key={`v${i}`} x={cx} y={y - 6} fill={colors.text} fontSize={12} fontFamily={fonts.uiBold} textAnchor="middle">
            {d.value > 0 ? valueFormat(d.value) : ''}
          </SvgText>
        );
      })}

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
