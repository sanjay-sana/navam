// Lull — design tokens (the "nightlight" dark theme from the approved mockups).
// Single source of truth for colour, type, spacing, radius. v1 is dark-only.

export const colors = {
  bg: '#17131D',          // app background (base)
  bgTop: '#1E1825',       // gradient top
  surface: '#241D2D',     // raised card
  surface2: '#2C2436',    // inset / pressed
  border: '#382E44',      // hairline
  text: '#F4EDE6',        // primary text (warm cream)
  dim: '#A99FB2',         // secondary text

  accent: '#F4A259',      // honey — feeds + primary actions
  accentSoft: 'rgba(244,162,89,0.14)',

  diaper: '#5FB8AC',      // teal
  diaperSoft: 'rgba(95,184,172,0.14)',

  growth: '#B98BDD',      // violet
  growthSoft: 'rgba(185,139,221,0.14)',

  sleep: '#8B93E8',       // periwinkle indigo — night feel
  sleepSoft: 'rgba(139,147,232,0.14)',

  good: '#7FC8A0',
  white: '#FFFFFF',
} as const;

// Semantic mapping for the event domains.
export const eventColors = {
  feed: colors.accent,
  diaper: colors.diaper,
  growth: colors.growth,
  pump: colors.growth, // pump shares the growth/violet hue in History
  sleep: colors.sleep,
} as const;

export const fonts = {
  // Load via expo-font / @expo-google-fonts.
  display: 'Fraunces_600SemiBold',     // app name, hero numbers, section headers
  ui: 'HankenGrotesk_500Medium',       // body / UI
  uiBold: 'HankenGrotesk_600SemiBold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 20, xl: 26, pill: 999 } as const;

export const theme = { colors, eventColors, fonts, spacing, radius } as const;
export type Theme = typeof theme;
