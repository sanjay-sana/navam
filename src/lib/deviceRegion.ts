// Best-effort device region code (e.g. "US") without a native localization
// dependency — reads the platform locale identifier, with an Intl fallback.
import { NativeModules, Platform } from 'react-native';

function regionFrom(locale: unknown): string | null {
  if (typeof locale !== 'string') return null;
  const m = locale.match(/[-_]([A-Za-z]{2})(?![A-Za-z])/); // en_US / en-US → US
  return m ? m[1].toUpperCase() : null;
}

/** Device region code (ISO-3166 alpha-2), or null if it can't be determined. */
export function deviceRegion(): string | null {
  const candidates: unknown[] = [];
  try {
    if (Platform.OS === 'ios') {
      const s = (NativeModules as { SettingsManager?: { settings?: Record<string, unknown> } })
        .SettingsManager?.settings;
      candidates.push(s?.AppleLocale, (s?.AppleLanguages as string[] | undefined)?.[0]);
    } else {
      candidates.push((NativeModules as { I18nManager?: { localeIdentifier?: string } })
        .I18nManager?.localeIdentifier);
    }
  } catch {
    // ignore — fall through to Intl
  }
  try {
    candidates.push(new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // Intl may be unavailable
  }
  for (const c of candidates) {
    const r = regionFrom(c);
    if (r) return r;
  }
  return null;
}
