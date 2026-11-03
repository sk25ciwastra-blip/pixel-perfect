import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filterTransaksi, periodeWib, rentangTransaksi, TRANSAKSI_PER_HALAMAN } from './transaksi-filter';

export type FilterDaftarTransaksi = { bulan: number; tahun: number; cari: string; halaman: number };
const selectTransaksi = '*, guests(full_name,phone), rooms(room_number,room_types(name))' as const;

export function transaksiQuery(filter: FilterDaftarTransaksi) {
  return queryOptions({
    queryKey: ['daftar-transaksi', filter],
    queryFn: async () => {
      const kriteria = filterTransaksi(filter.bulan, filter.tahun, filter.cari);
      const baca = (halaman: number) => {
        const range = rentangTransaksi(halaman);
        let query = supabase.from('transactions').select(selectTransaksi, { count: 'exact' });
        if (kriteria.nomor) query = query.or(kriteria.nomor);
        else if (kriteria.teks) query = query.ilike('transaction_number', kriteria.teks);
        else if (kriteria.mulai && kriteria.akhir) query = query.gte('created_at', kriteria.mulai).lt('created_at', kriteria.akhir);
        return query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(range.awal, range.akhir);
      };
      let result = await baca(filter.halaman);
      if (result.error) throw new Error('Daftar transaksi tidak dapat dimuat. Silakan coba lagi.');
      const total = result.count ?? 0;
      const halaman = Math.min(filter.halaman, Math.max(1, Math.ceil(total / TRANSAKSI_PER_HALAMAN)));
      if (halaman !== filter.halaman) result = await baca(halaman);
      if (result.error) throw new Error('Daftar transaksi tidak dapat dimuat. Silakan coba lagi.');
      return { rows: result.data ?? [], total, halaman };
    },
    staleTime: 15_000,
  });
}

export const tahunTransaksiQuery = queryOptions({
  queryKey: ['tahun-transaksi'],
  queryFn: async () => {
    const [first, last] = await Promise.all([
      supabase.from('transactions').select('created_at').order('created_at').limit(1),
      supabase.from('transactions').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]);
    if (first.error || last.error) throw new Error('Pilihan tahun tidak dapat dimuat. Silakan coba lagi.');
    const current = periodeWib().tahun;
    const awal = Math.min(current, first.data?.[0] ? periodeWib(new Date(first.data[0].created_at)).tahun : current);
    const akhir = Math.max(current, last.data?.[0] ? periodeWib(new Date(last.data[0].created_at)).tahun : current);
    return Array.from({ length: akhir - awal + 1 }, (_, i) => akhir - i);
  },
  staleTime: 60_000,
});