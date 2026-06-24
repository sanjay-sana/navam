// The Lull logo mark — a yawning baby cradled in a honey crescent moon, as an
// SVG so it stays crisp at any size and follows the theme. Same geometry as the
// app icon (composition B).
import { memo } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { colors } from '@/src/theme/theme';

// Crescent (lune) from two circle intersections — matches assets/branding gen.
function lune(
  O: { x: number; y: number },
  R: number,
  C: { x: number; y: number },
  r: number
): string {
  const dx = C.x - O.x;
  const dy = C.y - O.y;
  const d = Math.hypot(dx, dy);
  const a = (d * d - r * r + R * R) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const mx = O.x + (a * dx) / d;
  const my = O.y + (a * dy) / d;
  const ux = -dy / d;
  const uy = dx / d;
  const p1 = { x: mx + h * ux, y: my + h * uy };
  const p2 = { x: mx - h * ux, y: my - h * uy };
  const f = (n: number) => n.toFixed(1);
  return `M ${f(p1.x)},${f(p1.y)} A ${R},${R} 0 1,1 ${f(p2.x)},${f(p2.y)} A ${r},${r} 0 0,0 ${f(p1.x)},${f(p1.y)} Z`;
}

const MOON = lune({ x: 512, y: 560 }, 380, { x: 512, y: 360 }, 355);
const HC = { x: 512, y: 455 };
const HR = 170;

export const LullMark = memo(function LullMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path d={MOON} fill={colors.accent} />
      <Circle cx={HC.x} cy={HC.y} r={HR} fill={colors.text} />
      <Path
        d={`M ${HC.x - 28},${HC.y - 152} Q ${HC.x - 8},${HC.y - 194} ${HC.x + 24},${HC.y - 172} Q ${HC.x + 44},${HC.y - 158} ${HC.x + 28},${HC.y - 138}`}
        fill="none"
        stroke="#EE9A4C"
        strokeWidth={18}
        strokeLinecap="round"
      />
      <Circle cx={HC.x - 90} cy={HC.y + 48} r={26} fill={colors.accent} opacity={0.32} />
      <Circle cx={HC.x + 90} cy={HC.y + 48} r={26} fill={colors.accent} opacity={0.32} />
      <Path
        d={`M ${HC.x - 85},${HC.y - 24} Q ${HC.x - 60},${HC.y} ${HC.x - 35},${HC.y - 24}`}
        fill="none"
        stroke="#5C4A54"
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Path
        d={`M ${HC.x + 35},${HC.y - 24} Q ${HC.x + 60},${HC.y} ${HC.x + 85},${HC.y - 24}`}
        fill="none"
        stroke="#5C4A54"
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Ellipse cx={HC.x} cy={HC.y + 96} rx={33} ry={44} fill="#54414B" />
      <Ellipse cx={HC.x} cy={HC.y + 114} rx={19} ry={17} fill="#E8907E" />
    </Svg>
  );
});
