// Custom breast-pump glyph (no icon font has one): a collection bottle with a
// tube running up to the flange/horn set at 45°. Outline style to match the
// baby-bottle / diaper / flask set. Geometry verified by rendering at 24–180px.
import Svg, { Ellipse, G, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* collection bottle */}
      <Path
        d="M3.5 9 L10 9 L10 18.6 Q10 21 7.5 21 L6 21 Q3.5 21 3.5 18.6 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* measurement ticks */}
      <Path d="M4.9 14.5 H6.9 M4.9 16.5 H6.9" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      {/* tube from the bottle up to the flange */}
      <Path d="M12.5 7.7 Q10.3 9.6 8 10.4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* flange / horn at 45° */}
      <G transform="translate(12.6 7.6) rotate(45)">
        <Ellipse cx={0} cy={-5.1} rx={3.4} ry={1.5} stroke={color} strokeWidth={sw} />
        <Path d="M-3.4 -5.1 L-1.5 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M3.4 -5.1 L1.5 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
