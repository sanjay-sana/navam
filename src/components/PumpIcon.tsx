// Custom breast-pump glyph (no icon font has one): an upright collection bottle
// with the flange/horn angled off the top. Outline style to match the
// baby-bottle / diaper / flask set.
import Svg, { Ellipse, G, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* collection bottle */}
      <Path
        d="M10 8.6 L16.5 8.6 L16.5 18.6 Q16.5 21 14 21 L12.5 21 Q10 21 10 18.6 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* measurement ticks */}
      <Path d="M13.8 15 H16 M13.8 17 H16" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      {/* flange / horn angled off the bottle mouth */}
      <G transform="rotate(-26 11 9)">
        <Ellipse cx={11} cy={2} rx={4.6} ry={1.7} stroke={color} strokeWidth={sw} />
        <Path d="M6.4 2 L9.3 8.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M15.6 2 L12.7 8.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
