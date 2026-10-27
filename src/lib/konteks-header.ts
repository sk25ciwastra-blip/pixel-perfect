// Teks konteks singkat (maks. dua baris) yang tampil di sisi kanan header halaman.
// Hanya presentasi: tidak memengaruhi data, izin, maupun aturan bisnis.
// Dashboard sengaja tidak disertakan agar tampilannya tetap sama persis.
export const konteksHeader: Record<string, string> = {
  "/kamar": "Kondisi seluruh kamar hari ini, dari tersedia hingga perlu dibersihkan.",
  "/booking": "Pemesanan yang sudah masuk dan menunggu tanggal check-in.",
  "/transaksi": "Telusuri transaksi per bulan dan tahun, dari terbaru hingga arsip.",
  "/tamu": "Data tamu, riwayat kunjungan, dan catatan pelayanan tersimpan di sini.",
  "/housekeeping": "Kebersihan dan kerapian kamar menjadi kenyamanan pertama bagi tamu.",
  "/keuangan": "Penerimaan, pengeluaran, dan sesi kas terpantau tertib dan akurat.",
  "/laporan": "Rekap operasional dan pendapatan sebagai dasar keputusan harian.",
  "/karyawan": "Kelola anggota tim serta hak akses sesuai tanggung jawab masing-masing.",
  "/pengaturan": "Aturan operasional dan preferensi aplikasi ditetapkan di sini.",
};
