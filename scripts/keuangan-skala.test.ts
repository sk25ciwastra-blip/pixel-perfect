import { describe, expect, it } from 'vitest';
import { labelSkala, skalaArusKas } from '@/lib/keuangan-skala';

describe('skalaArusKas', () => {
  it('memakai nilai tertinggi aktual dengan interval proporsional', () => {
    const { ticks, domain } = skalaArusKas([250_000, 900_000, 100_000]);
    expect(domain[1]).toBeGreaterThanOrEqual(900_000);
    expect(ticks[0]).toBe(0);
    const interval = ticks[1] - ticks[0];
    expect(ticks.every((t, i) => i === 0 || t - ticks[i - 1] === interval)).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });

  it('mendukung arus kas bersih negatif', () => {
    const { ticks, domain } = skalaArusKas([100_000, -350_000]);
    expect(domain[0]).toBeLessThanOrEqual(-350_000);
    expect(ticks).toContain(0);
    expect(ticks.some(t => t < 0)).toBe(true);
  });

  it('aman untuk data kosong dan nol', () => {
    expect(skalaArusKas([])).toEqual({ ticks: [0], domain: [0, 0] });
    expect(skalaArusKas([0, 0])).toEqual({ ticks: [0], domain: [0, 0] });
  });
});

describe('labelSkala', () => {
  it('menulis rupiah ringkas', () => {
    expect(labelSkala(250_000)).toBe('Rp250 rb');
    expect(labelSkala(1_000_000)).toBe('Rp1 jt');
    expect(labelSkala(1_500_000)).toBe('Rp1,5 jt');
    expect(labelSkala(500)).toBe('Rp500');
    expect(labelSkala(-250_000)).toBe('-Rp250 rb');
  });
});
