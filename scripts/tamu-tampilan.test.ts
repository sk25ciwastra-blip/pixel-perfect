import { describe, it, expect } from 'vitest';
import { empatDigitWA, kunjunganTamu, urutTamu } from '../src/lib/tamu-tampilan';
const guests = [{ id: 'a', full_name: 'Andin' }, { id: 'b', full_name: 'Budi' }];
const transactions = [
  { guest_id: 'a', status: 'booking', created_at: '2026-10-23', started_at: null },
  { guest_id: 'a', status: 'cancelled', created_at: '2026-10-23', started_at: null },
  { guest_id: 'b', status: 'check_in', created_at: '2026-10-23', started_at: '2026-10-23' },
  { guest_id: 'b', status: 'check_out', created_at: '2026-10-22', started_at: '2026-10-22' },
];
describe('Aturan tampilan Tamu', () => {
  it('WA hanya empat digit terakhir', () => expect(empatDigitWA('+62 812-3456-0349')).toBe('0349'));
  it('kunjungan hanya check-in dan check-out', () => { expect(kunjunganTamu(transactions, 'a')).toHaveLength(0); expect(kunjunganTamu(transactions, 'b')).toHaveLength(2); });
  it('default nama A-Z', () => expect(urutTamu([...guests].reverse(), transactions, 'nama').map(g => g.id)).toEqual(['a', 'b']));
  it('kunjungan terbanyak lebih dulu', () => expect(urutTamu(guests, transactions, 'terbanyak').map(g => g.id)).toEqual(['b', 'a']));
  it('kunjungan tersedikit lebih dulu', () => expect(urutTamu(guests, transactions, 'tersedikit').map(g => g.id)).toEqual(['a', 'b']));
});