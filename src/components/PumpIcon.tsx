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
        d="M7.5 11.6 L16.5 11.6 L16.5 19.9 Q16.5 22.5 13.9 22.5 L10.1 22.5 Q7.5 22.5 7.5 19.9 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* graduated measurement ticks */}
      <Path
        d="M9.2 14.3 H10.7 M9.2 16.2 H10.7 M9.2 18.1 H11.4 M9.2 20 H10.7 M9.2 21.9 H10.7"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* collar where the pump screws onto the bottle */}
      <Path d="M9.3 11.6 L10.9 10.3 L13.1 10.3 L14.7 11.6" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      {/* neck */}
      <Path d="M10.9 10.3 L10.9 8.9 M13.1 10.3 L13.1 8.9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* plunger */}
      <Path
        d="M11.2 8.9 L11.2 6.8 Q11.2 5.8 12 5.8 Q12.8 5.8 12.8 6.8 L12.8 8.9"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* handle / lever to the left */}
      <Path
        d="M11 7.1 Q4.8 5 3.2 7.5 Q5.7 9.4 10.9 8.5"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* flange / horn to the right */}
      <Ellipse cx={19.1} cy={6.1} rx={1.5} ry={3} stroke={color} strokeWidth={sw} />
      <Path d="M13 6.8 L17.9 3.4 M13 8.4 L18 8.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}
