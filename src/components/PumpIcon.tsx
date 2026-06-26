// Custom breast-pump glyph (no icon font has one): a wide collection bottle with
// a tube running up to the angled flange/horn. Outline style to match the
// baby-bottle / diaper / flask set. Geometry verified by rendering at 24–180px.
import Svg, { Ellipse, G, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* collection bottle */}
      <Path
        d="M4.5 9 L11 9 L11 18.6 Q11 21 8.5 21 L7 21 Q4.5 21 4.5 18.6 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* measurement ticks */}
      <Path d="M8.6 14.5 H10.6 M8.6 16.5 H10.6" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      {/* tube from the bottle up to the flange */}
      <Path d="M14.4 7.3 Q12 9.6 9.4 9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* flange / horn, pointing right just past 90° */}
      <G transform="translate(14.6 7) rotate(100)">
        <Ellipse cx={0} cy={-5.8} rx={3.6} ry={1.5} stroke={color} strokeWidth={sw} />
        <Path d="M-3.6 -5.8 L-1.6 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M3.6 -5.8 L1.6 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
