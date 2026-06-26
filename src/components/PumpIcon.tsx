// Custom manual-breast-pump glyph (no icon font has one): a graduated collection
// bottle, a collar + plunger on top, a handle/lever to the left and a flange/
// horn to the right. Traced from a reference and verified by rendering at
// 24–150px. Outline style to match the rest of the icon set.
import Svg, { Ellipse, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* collection bottle */}
      <Path
        d="M7.5 11.6 L16.5 11.6 L16.5 18.9 Q16.5 21.5 13.9 21.5 L10.1 21.5 Q7.5 21.5 7.5 18.9 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* graduated measurement ticks */}
      <Path
        d="M9.2 14.3 H10.7 M9.2 16.1 H10.7 M9.2 17.9 H11.4 M9.2 19.7 H10.7"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* collar where the pump screws onto the bottle */}
      <Path d="M9.3 11.6 L10.8 9.5 L13.2 9.5 L14.7 11.6" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      {/* plunger */}
      <Path
        d="M11.2 9.5 L11.2 7.3 Q11.2 6.3 12 6.3 Q12.8 6.3 12.8 7.3 L12.8 9.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* handle / lever to the left */}
      <Path
        d="M11 7.7 Q4.8 5.6 3.2 8.1 Q5.7 10 10.9 9.1"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* flange / horn to the right */}
      <Ellipse cx={19.1} cy={6.7} rx={1.5} ry={3} stroke={color} strokeWidth={sw} />
      <Path d="M13 7.4 L17.9 4 M13 9 L18 9.1" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}
