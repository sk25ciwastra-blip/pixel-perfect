import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { bacaTransaksiOperasional } from './demo-archive';
import { filterTransaksi, periodeWib, rentangTransaksi, TRANSAKSI_PER_HALAMAN } from './transaksi-filter';

export type FilterDaftarTransaksi = { bulan: number; tahun: number; cari: string; halaman: number };
const selectTransaksi = '*, guests(full_name,phone), rooms(room_number,room_types(name))' as const;

export function transaksiQuery(filter: FilterDaftarTransaksi) {
  return queryOptions({
    queryKey: ['daftar-transaksi', filter],
    queryFn: async () => {
      const kriteria = filterTransaksi(filter.bulan, filter.tahun, filter.cari);
      const baca = (halaman: number) => bacaTransaksiOperasional(hanyaAktif => {
        const range = rentangTransaksi(halaman);
        let query = supabase.from('transactions').select(selectTransaksi, { count: 'exact' });
        if (hanyaAktif) query = query.is('demo_archived_at', null);
        if (kriteria.nomor) query = query.or(kriteria.nomor);
        else if (kriteria.teks) query = query.ilike('transaction_number', kriteria.teks);
        else if (kriteria.mulai && kriteria.akhir) query = query.gte('created_at', kriteria.mulai).lt('created_at', kriteria.akhir);
        return query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(range.awal, range.akhir);
      });
      let halaman = filter.halaman;
      let result = await baca(halaman);
      if (halaman > 1 && result.error?.code === 'PGRST103') {
        halaman = 1;
        result = await baca(halaman);
      }
      if (result.error) throw new Error('Daftar transaksi tidak dapat dimuat. Silakan coba lagi.');
      const akhir = Math.min(filter.halaman, Math.max(1, Math.ceil((result.count ?? 0) / TRANSAKSI_PER_HALAMAN)));
      if (akhir !== halaman) result = await baca(akhir);
      if (result.error) throw new Error('Daftar transaksi tidak dapat dimuat. Silakan coba lagi.');
      return { rows: result.data ?? [], total: result.count ?? 0, halaman: akhir };
    },
    staleTime: 15_000,
  });
}

export const tahunTransaksiQuery = queryOptions({
  queryKey: ['tahun-transaksi'],
  queryFn: async () => {
    const batas = (ascending: boolean) => bacaTransaksiOperasional(hanyaAktif => {
      const query = supabase.from('transactions').select('created_at');
      return (hanyaAktif ? query.is('demo_archived_at', null) : query).order('created_at', { ascending }).limit(1);
    });
    const [first, last] = await Promise.all([
      batas(true), batas(false),
    ]);
    if (first.error || last.error) throw new Error('Pilihan tahun tidak dapat dimuat. Silakan coba lagi.');
    const current = periodeWib().tahun;
    const awal = Math.min(current, first.data?.[0] ? periodeWib(new Date(first.data[0].created_at)).tahun : current);
    const akhir = Math.max(current, last.data?.[0] ? periodeWib(new Date(last.data[0].created_at)).tahun : current);
    return Array.from({ length: akhir - awal + 1 }, (_, i) => akhir - i);
  },
  staleTime: 60_000,
});
