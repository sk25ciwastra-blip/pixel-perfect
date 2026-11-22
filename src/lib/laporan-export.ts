/** Spreadsheet-safe export of aggregated operational reporting (no guest or staff PII). */
import { hitungArusKasBersih, labelHasilArusKas } from './laporan-arus-kas';
export type RekapHari = { tgl: string; transaksi: number; masuk: number; keluar: number; refund?: number; arsipDemo?: number };
type LaporanCsv = {
  awal: string; akhir: string; penerimaan: number; pengeluaran: number; refund?: number;
  jumlahTransaksi: number; rekap: RekapHari[]; metode: Record<string, number>; jumlahArsipDemo?: number;
};

function csvCell(value: string | number): string {
  const raw = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '0') : value;
  // Microsoft Excel and other spreadsheets can execute formula strings on import.
  const safe = typeof value === 'string' && /^[\s=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function buatCsvLaporan(data: LaporanCsv): string {
  const hasRefundCoverage = typeof data.refund === 'number';
  const labelHasil = labelHasilArusKas(hasRefundCoverage);
  const hasil = hitungArusKasBersih(data.penerimaan, data.pengeluaran,
    hasRefundCoverage ? data.refund! : null);
  const rows: (string | number)[][] = [
    ['Baturaden 25 Homestay', 'Laporan Operasional'],
    ['Periode', data.awal + ' s.d. ' + data.akhir],
    ['Keterangan', 'Total historis mencakup Arsip DEMO dan pembayarannya'],
    ['Total Penerimaan Bruto', data.penerimaan],
    ['Total Pengeluaran Operasional', data.pengeluaran],
    ['Total Refund', hasRefundCoverage ? data.refund! : 'Tidak tersedia untuk peran ini'],
    [labelHasil, hasil ?? data.penerimaan - data.pengeluaran],
    ['Cakupan Refund', hasRefundCoverage
      ? 'Refund bisnis diperhitungkan; pergerakan internal sesi kas tidak dihitung sebagai pendapatan'
      : 'Refund dan sebagian pengeluaran tidak terlihat bagi peran ini; selisih bukan arus kas bersih'],
    ['Total Transaksi Baru', data.jumlahTransaksi],
    ['Di antaranya Arsip DEMO', data.jumlahArsipDemo ?? 0],
    [],
    ['Tanggal WIB', 'Transaksi Baru', 'Penerimaan Bruto (Rp)', 'Pengeluaran (Rp)', 'Refund (Rp)', labelHasil, 'Di antaranya Arsip DEMO'],
    ...data.rekap.map(row => [
      row.tgl, row.transaksi, row.masuk, row.keluar,
      hasRefundCoverage ? row.refund ?? 0 : 'Tidak tersedia',
      hitungArusKasBersih(row.masuk, row.keluar, hasRefundCoverage ? row.refund ?? 0 : null)
        ?? row.masuk - row.keluar,
      row.arsipDemo ?? 0,
    ]),
    [],
    ['Metode Pembayaran', 'Penerimaan (Rp)'],
    ...Object.entries(data.metode).sort(([a],[b]) => a.localeCompare(b)).map(([metode, nominal]) => [metode, nominal]),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
