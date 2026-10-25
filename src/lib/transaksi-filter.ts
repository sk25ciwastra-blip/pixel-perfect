export const TRANSAKSI_PER_HALAMAN = 20;
export const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function periodeWib(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric' }).formatToParts(now);
  return { bulan: Number(parts.find(p => p.type === 'month')?.value), tahun: Number(parts.find(p => p.type === 'year')?.value) };
}

export function filterTransaksi(bulan: number, tahun: number, pencarian: string) {
  const term = pencarian.trim();
  if (term) {
    // Only numeral characters enter PostgREST patterns; text searches are passed as a single ilike value.
    if (/^\d+$/.test(term)) {
      if (term.length === 1) return { nomor: `transaction_number.ilike.BTRDTRX-*${term}*,transaction_number.ilike.BTRD25-TRX-*${term}*-__,transaction_number.ilike.BTRD25-*${term}*` };
      const sequence = term.replace(/^0+/, '') || '0';
      const padded = sequence.padStart(6, '0');
      return { nomor: `transaction_number.eq.BTRDTRX-${padded},transaction_number.eq.BTRDTRX-${sequence},transaction_number.ilike.BTRD25-TRX-${padded}-__,transaction_number.ilike.BTRD25-TRX-${sequence}-__,transaction_number.eq.BTRD25-${padded},transaction_number.eq.BTRD25-${sequence}` };
    }
    return { teks: `%${term.replace(/[\\%_]/g, '\\$&')}%` };
  }
  const mulai = bulan === 0 ? `${tahun}-01-01` : `${tahun}-${String(bulan).padStart(2, '0')}-01`;
  const akhir = bulan === 0 || bulan === 12 ? `${tahun + 1}-01-01` : `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
  return { mulai: `${mulai}T00:00:00+07:00`, akhir: `${akhir}T00:00:00+07:00` };
}

export function rentangTransaksi(halaman: number) {
  const awal = (Math.max(1, Math.floor(halaman)) - 1) * TRANSAKSI_PER_HALAMAN;
  return { awal, akhir: awal + TRANSAKSI_PER_HALAMAN - 1 };
}

export function tanggalTransaksi(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}