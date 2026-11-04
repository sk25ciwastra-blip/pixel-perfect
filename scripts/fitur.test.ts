import { describe, expect, it } from 'bun:test';
import { bacaSakelar, fitur } from '../src/lib/fitur';
import { minimumDpAmount, shouldUseCombinedPayment } from '../src/lib/combined-payments';
import { featureGateOn } from '../src/lib/feature-flags';

describe('sakelar fitur', () => {
  it('OFF tanpa variabel', () => expect(bacaSakelar(undefined)).toBe(false));
  it('OFF untuk nilai selain aktif', () => {
    expect(bacaSakelar('true')).toBe(false);
    expect(bacaSakelar('AKTIF')).toBe(false);
  });
  it('ON hanya untuk aktif', () => expect(bacaSakelar('aktif')).toBe(true));
  it('default proyek OFF', () => {
    expect(fitur.combinedPayment).toBe(false);
    expect(fitur.extraGuest).toBe(false);
    expect(fitur.receipt58mm).toBe(false);
  });
  it('combined payment hanya aktif untuk dua metode saat flag ON', () => {
    expect(shouldUseCombinedPayment(1, true)).toBe(false);
    expect(shouldUseCombinedPayment(2, false)).toBe(false);
    expect(shouldUseCombinedPayment(2, true)).toBe(true);
  });
  it('feature gate ON membutuhkan tiga persetujuan', () => {
    expect(featureGateOn('true', 'true', 'true')).toBe(true);
    expect(featureGateOn('true', 'true', undefined)).toBe(false);
    expect(featureGateOn('true', 'false', 'true')).toBe(false);
  });
  it('DP percentage memakai ceil dan mode amount tetap dinamis', () => {
    expect(minimumDpAmount(100001, { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 40 })).toBe(40001);
    expect(minimumDpAmount(100001, { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 33.333 })).toBe(33334);
    expect(minimumDpAmount(100001, { minimum_dp_mode: 'AMOUNT', minimum_dp_value: 50000 })).toBe(50000);
  });
});
