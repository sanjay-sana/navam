// App-wide Text that caps OS font scaling. RN <Text> grows unboundedly with the
// device font-size setting, which breaks layouts for large-font users; React 19
// dropped defaultProps for function components, so a wrapper is the reliable way
// to set a default. maxFontSizeMultiplier is spread-overridable per instance
// (e.g. the timer clock also sets adjustsFontSizeToFit). Text still scales up to
// the cap, so accessibility is preserved — it's just bounded.
import { Text as RNText, type TextProps } from 'react-native';

/** Max the font can grow relative to the app's base sizes. */
export const MAX_FONT_SCALE = 1.3;

export function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
