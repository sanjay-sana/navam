// The Navam logo mark — a yawning baby cradled in a honey crescent moon, as an
// SVG so it stays crisp at any size and follows the theme. Same geometry as the
// app icon (composition B).
import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

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

export const BrandMark = memo(function BrandMark({
  size = 30,
  dimmed = false,
  animate = false,
}: {
  size?: number;
  /** Fades the mark for an inactive/disabled state (e.g. unfocused tab). */
  dimmed?: boolean;
  /** Gentle "breathing" pulse — for hero placements, not tab icons. */
  animate?: boolean;
}) {
  // A slow, soft scale so the sleepy baby looks like it's breathing. Native
  // driver = runs on the UI thread; skipped when the OS asks to reduce motion.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breath, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [animate, breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });

  return (
    <Animated.View style={animate ? { transform: [{ scale }] } : undefined}>
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <G opacity={dimmed ? 0.4 : 1}>
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
      </G>
    </Svg>
    </Animated.View>
  );
});
