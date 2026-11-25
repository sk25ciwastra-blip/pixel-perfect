/** Baturaden 25 Homestay appearance rules (not booking day_mode).
 * Morning Blue: 06:00:00–17:59:59 WIB; Night Gold: 18:00:00–05:59:59 WIB.
 * Pure functions: never depend on the user's device timezone.
 */
export type B25ThemePreference = 'auto' | 'morning' | 'night';
export type B25ThemeAppearance = 'morning' | 'night';
export const B25_THEME_STORAGE_KEY = 'b25_appearance_preference_v1';
export const B25_TIMEZONE = 'Asia/Jakarta';

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: B25_TIMEZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function timePartsWib(timestampMs: number) {
  if (!Number.isFinite(timestampMs)) return null;
  const values = clockFormatter.formatToParts(new Date(timestampMs));
  const find = (type: 'hour' | 'minute' | 'second') =>
    Number(values.find(part => part.type === type)?.value);
  const hour = find('hour');
  const minute = find('minute');
  const second = find('second');
  if (![hour, minute, second].every(Number.isFinite)) return null;
  return { hour, minute, second };
}

export function isB25ThemePreference(value: unknown): value is B25ThemePreference {
  return value === 'auto' || value === 'morning' || value === 'night';
}

export function resolveB25Appearance(preference: B25ThemePreference, timestampMs: number): B25ThemeAppearance {
  if (preference !== 'auto') return preference;
  const clock = timePartsWib(timestampMs);
  // Fail-closed for invalid clock; the UI can recover on the next clock tick.
  return clock && clock.hour >= 6 && clock.hour < 18 ? 'morning' : 'night';
}

/** Milliseconds until the next 06:00 or 18:00 WIB boundary.
 * Used for automatic switch without reload; the caller also handles focus/resume.
 */
export function nextB25ThemeBoundaryDelayMs(timestampMs: number): number {
  const clock = timePartsWib(timestampMs);
  if (!clock) return 60_000;
  const sinceMidnightSeconds = clock.hour * 3600 + clock.minute * 60 + clock.second;
  const atSix = 6 * 3600;
  const atEighteen = 18 * 3600;
  const untilSeconds = sinceMidnightSeconds < atSix ? atSix - sinceMidnightSeconds :
    sinceMidnightSeconds < atEighteen ? atEighteen - sinceMidnightSeconds :
      24 * 3600 - sinceMidnightSeconds + atSix;
  return untilSeconds * 1000 - (timestampMs % 1000) + 50;
}
