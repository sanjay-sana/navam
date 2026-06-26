// Custom breast-pump glyph (no icon font has one): a collection bottle with a
// wide flange cup on top. Outline style to match the baby-bottle / diaper /
// flask set. Drawn upright with clean junctions (cone meets the cup at its
// edges and the bottle at its top corners) so it stays crisp at small sizes.
import Svg, { Ellipse, Path } from 'react-native-svg';

export function PumpIcon({ size = 24, color }: { size?: number; color: string }) {
  const sw = 1.7;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* flange cup opening */}
      <Ellipse cx={12} cy={3.4} rx={5} ry={1.7} stroke={color} strokeWidth={sw} />
      {/* flange cone tapering from the cup edges to the bottle */}
      <Path d="M7 3.4 L8.6 9.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M17 3.4 L15.4 9.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* collection bottle */}
      <Path
        d="M8.6 9.2 L8.6 18.4 Q8.6 21 11.1 21 L12.9 21 Q15.4 21 15.4 18.4 L15.4 9.2"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* measurement tick */}
      <Path d="M8.6 15 H10.6" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
