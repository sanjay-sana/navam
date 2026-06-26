// Custom breast-pump glyph (no icon font has one): an upright collection bottle
// with the flange/horn angled off the top. Outline style to match the
// baby-bottle / diaper / flask outline set.
import Svg, { Ellipse, G, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* collection bottle (upright) */}
      <Path
        d="M9.5 9 L9.5 18.4 Q9.5 21 12 21 L14 21 Q16.5 21 16.5 18.4 L16.5 9"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* bottle mouth */}
      <Path d="M9 9 H17" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* measurement tick */}
      <Path d="M14.6 15 H16.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      {/* flange / horn, angled up-left from the bottle mouth */}
      <G transform="rotate(-36 12.5 9)">
        <Ellipse cx={12.5} cy={2.4} rx={4.3} ry={1.6} stroke={color} strokeWidth={sw} />
        <Path d="M8.2 2.4 L11 9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M16.8 2.4 L14 9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
