/** Spreadsheet-safe export of aggregated operational reporting (no guest or staff PII). */
export type RekapHari = { tgl: string; transaksi: number; masuk: number; keluar: number };
type LaporanCsv = {
  awal: string; akhir: string; penerimaan: number; pengeluaran: number;
  jumlahTransaksi: number; rekap: RekapHari[]; metode: Record<string, number>;
};

function csvCell(value: string | number): string {
  const raw = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '0') : value;
  // Microsoft Excel and other spreadsheets can execute formula strings on import.
  const safe = typeof value === 'string' && /^[\s=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function buatCsvLaporan(data: LaporanCsv): string {
  const rows: (string | number)[][] = [
    ['Baturaden 25 Homestay', 'Laporan Operasional'],
    ['Periode', data.awal + ' s.d. ' + data.akhir],
    ['Keterangan', 'Ringkasan berdasarkan data yang dapat diakses pengguna'],
    ['Total Penerimaan', data.penerimaan],
    ['Total Pengeluaran', data.pengeluaran],
    ['Arus Kas Bersih', data.penerimaan - data.pengeluaran],
    ['Total Transaksi Baru', data.jumlahTransaksi],
    [],
    ['Tanggal WIB', 'Transaksi Baru', 'Penerimaan (Rp)', 'Pengeluaran (Rp)', 'Arus Kas Bersih (Rp)'],
    ...data.rekap.map(row => [row.tgl, row.transaksi, row.masuk, row.keluar, row.masuk - row.keluar]),
    [],
    ['Metode Pembayaran', 'Penerimaan (Rp)'],
    ...Object.entries(data.metode).sort(([a],[b]) => a.localeCompare(b)).map(([metode, nominal]) => [metode, nominal]),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
