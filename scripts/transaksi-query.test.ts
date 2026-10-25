import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
const { calls, hasil } = vi.hoisted(() => ({ calls: [] as [string, ...unknown[]][], hasil: { data: [{ id: 'baris-1001' }], count: 1001, error: null } }));
vi.mock('../src/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    calls.push(['from', table]);
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ['select', 'gte', 'lt', 'ilike', 'or', 'order']) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
    chain['range'] = (...args) => { calls.push(['range', ...args]); return Promise.resolve(hasil); };
    return chain;
  },
} }));
import { transaksiQuery } from '../src/lib/transaksi-query';
describe('Query seluruh transaksi berizin', () => {
  it('halaman 51 meminta baris 1000–1019 dan jumlah keseluruhan langsung dari database', async () => {
    calls.length = 0;
    const data = await new QueryClient().fetchQuery(transaksiQuery({ bulan: 10, tahun: 2026, cari: '', halaman: 51 }));
    expect(calls).toContainEqual(['range', 1000, 1019]);
    expect(calls).toContainEqual(['select', '*, guests(full_name,phone), rooms(room_number,room_types(name))', { count: 'exact' }]);
    expect(calls).toContainEqual(['gte', 'created_at', '2026-10-01T00:00:00+07:00']);
    expect(calls).toContainEqual(['order', 'id', { ascending: false }]);
    expect(data.total).toBe(1001);
    expect(data.rows[0]?.id).toBe('baris-1001');
  });
  it('pencarian diterapkan sebelum pagination tanpa batas bulan/tahun', async () => {
    calls.length = 0;
    await new QueryClient().fetchQuery(transaksiQuery({ bulan: 1, tahun: 2025, cari: 'BTRDTRX-000020', halaman: 1 }));
    expect(calls).toContainEqual(['ilike', 'transaction_number', '%BTRDTRX-000020%']);
    expect(calls.some(c => c[0] === 'gte' || c[0] === 'lt')).toBe(false);
    expect(calls.findIndex(c => c[0] === 'ilike')).toBeLessThan(calls.findIndex(c => c[0] === 'range'));
  });
});