import { describe, expect, it } from 'bun:test';
import {
  B25_THEME_STORAGE_KEY, B25_TIMEZONE, isB25ThemePreference,
  resolveB25Appearance, nextB25ThemeBoundaryDelayMs,
} from '../src/lib/b25-appearance';

const at = (wib: string) => Date.parse(wib);

describe('Poin7 Morning Blue / Night Gold, Asia/Jakarta only', () => {
  it('uses literal Asia/Jakarta and stable local-storage key', () => {
    expect(B25_TIMEZONE).toBe('Asia/Jakarta');
    expect(B25_THEME_STORAGE_KEY).toBe('b25_appearance_preference_v1');
  });
  it('switches at 06:00 exactly, not a minute early', () => {
    expect(resolveB25Appearance('auto', at('2026-11-25T05:59:59+07:00'))).toBe('night');
    expect(resolveB25Appearance('auto', at('2026-11-25T06:00:00+07:00'))).toBe('morning');
  });
  it('switches at 18:00 exactly, not a minute early', () => {
    expect(resolveB25Appearance('auto', at('2026-11-25T17:59:59+07:00'))).toBe('morning');
    expect(resolveB25Appearance('auto', at('2026-11-25T18:00:00+07:00'))).toBe('night');
    expect(resolveB25Appearance('auto', at('2026-11-26T00:00:00+07:00'))).toBe('night');
  });
  it('uses the same instant regardless of incoming ISO timestamp timezone', () => {
    expect(resolveB25Appearance('auto', at('2026-11-24T23:00:00Z'))).toBe('morning');
    expect(resolveB25Appearance('auto', at('2026-11-25T10:59:59Z'))).toBe('morning');
    expect(resolveB25Appearance('auto', at('2026-11-25T11:00:00Z'))).toBe('night');
  });
  it('manual Pagi/Malam override auto boundaries without server changes', () => {
    expect(resolveB25Appearance('morning', at('2026-11-25T23:30:00+07:00'))).toBe('morning');
    expect(resolveB25Appearance('night', at('2026-11-25T11:30:00+07:00'))).toBe('night');
    expect(isB25ThemePreference('auto')).toBe(true);
    expect(isB25ThemePreference('morning')).toBe(true);
    expect(isB25ThemePreference('night')).toBe(true);
    expect(isB25ThemePreference('invalid')).toBe(false);
    expect(isB25ThemePreference(null)).toBe(false);
  });
  it('schedules next 06:00 / 18:00 WIB boundary without waiting for reload', () => {
    expect(nextB25ThemeBoundaryDelayMs(at('2026-11-25T05:59:59+07:00'))).toBe(1050);
    expect(nextB25ThemeBoundaryDelayMs(at('2026-11-25T17:59:59+07:00'))).toBe(1050);
    expect(nextB25ThemeBoundaryDelayMs(at('2026-11-25T18:00:00+07:00'))).toBe(12 * 60 * 60 * 1000 + 50);
    expect(nextB25ThemeBoundaryDelayMs(at('2026-11-25T17:59:59.500+07:00'))).toBe(550);
  });
  it('fails closed on invalid clock inputs', () => {
    expect(resolveB25Appearance('auto', Number.NaN)).toBe('night');
    expect(nextB25ThemeBoundaryDelayMs(Number.NaN)).toBe(60_000);
  });
});
