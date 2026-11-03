import { describe, expect, it } from 'vitest';
import { bacaSakelar, fitur } from '../src/lib/fitur';

describe('sakelar fitur', () => {
  it('OFF tanpa variabel', () => expect(bacaSakelar(undefined)).toBe(false));
  it('OFF untuk nilai selain aktif', () => {
    expect(bacaSakelar('true')).toBe(false);
    expect(bacaSakelar('AKTIF')).toBe(false);
  });
  it('ON hanya untuk aktif', () => expect(bacaSakelar('aktif')).toBe(true));
  it('default proyek OFF', () => {
    expect(fitur.extraGuest).toBe(false);
    expect(fitur.receipt58mm).toBe(false);
  });
});
