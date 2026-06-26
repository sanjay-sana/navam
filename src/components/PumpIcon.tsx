// Custom breast-pump glyph (no icon font has one). Outline style to match the
// baby-bottle / diaper / flask outline set. A flared shield funnel on a bottle.
import Svg, { Ellipse, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* soft shield rim (the cup against the breast) */}
      <Ellipse cx={12} cy={5} rx={7} ry={2.1} stroke={color} strokeWidth={sw} />
      {/* funnel sides tapering down to the bottle neck */}
      <Path d="M5 5 L9.4 12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M19 5 L14.6 12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* collection bottle */}
      <Path
        d="M9.4 12 L9.4 18.4 Q9.4 20.8 11.8 20.8 L12.2 20.8 Q14.6 20.8 14.6 18.4 L14.6 12"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* measurement tick so it reads as a bottle */}
      <Path d="M9.4 15.6 L11.2 15.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
