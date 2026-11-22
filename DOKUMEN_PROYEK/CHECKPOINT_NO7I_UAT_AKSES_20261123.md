# Baturaden 25 Homestay — Checkpoint 7I: Paket UAT Hak Akses Karyawan

**23 November 2026 WIB. Status: REVIEW / NO-GO.** Dokumen audit dan paket pengujian baca-saja; bukan izin transaksi DEMO atau LIVE. Induk: [Issue #119](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/119). Finance residual: [#111](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/111).

## Bukti terdahulu yang dipertahankan
- Supervisor berhasil membuka Operasional, Tugas Petugas, Perlengkapan, Perawatan (Kipas Angin/Sprei/Toilet), dan Riwayat HK, serta dialog Riwayat Kamar 03. Ini PASS browser baca/tampilan, bukan PASS mutasi.
- Audit Cloud SELECT-only: 3 CHECK-IN aktif cocok dengan 3 kamar occupied; nol double occupancy dan nol FK orphan pembayaran/HK; fungsi anon Housekeeping dan package timing ditutup di PR #121/#122 dengan postcheck PASS.
- Tes source PR #123 mengonfirmasi Checkout role/konfirmasi/pelunasan, sesi Trainee, dan receipt fail-closed (source-level PASS, bukan browser).
- Cloud saat 7H: 5 receptionist aktif, 4 housekeeping aktif, 2 supervisor aktif; 0 assignment Training; 0 rekening Owner aktif; 3 cash OPEN + 3 FINAL; 0 deposit, 0 audit counted Closing. Semua DEMO.

## UAT browser tanpa mutasi: lakukan dalam satu paket
**Larangan selama UAT:** jangan membuat Booking/Check-in, Checkout, pembayaran, Refund, Setoran, Closing, Catat Perawatan, Mulai/Selesai Bersihkan, mengubah data karyawan, mengarsipkan DEMO, mereset, atau membuka data pribadi untuk screenshot. Jangan bagikan token, password, NIK, HP tamu, detail pribadi, atau uang sensitif.

| Peran | Harus dapat dibuka | Harus ditolak pada URL langsung | Bukti minimum |
|---|---|---|---|
| Receptionist aktif | Dashboard, Kamar, Booking, Transaksi, Tamu, Keuangan, Laporan, Pengaturan pribadi | /karyawan, /housekeeping, /pengaturan-keuangan | Satu screenshot halaman + satu screenshot penolakan URL |
| Housekeeping aktif | Dashboard, Kamar, Housekeeping, Pengaturan pribadi | /booking, /keuangan, /karyawan, /pengaturan-keuangan | Satu screenshot Housekeeping + satu penolakan URL |
| Supervisor | Operasional dan Housekeeping (baca sudah PASS) | /karyawan, /pengaturan-keuangan | Tidak perlu ulang screenshot baca; hanya URL ditolak jika belum terbukti |
| Trainee | Hanya pada assignment Training dua hari aktif dan OPEN sesi milik penanggung jawab | Tidak bisa membuka/menutup sesi sendiri atau bypass konteks | TERTUNDA: 0 assignment, tidak membuat fixture tanpa izin terpisah |
| Owner | Tim & Akses, Pengaturan bisnis, konfirmasi Setoran | Tidak ada pembatasan staf | Tidak mengulang pemeriksaan bila bukti lama sudah PASS |

**Cara uji URL terlarang:** masuk menggunakan akun staf yang sah lalu ketik URL halaman terlarang langsung pada address bar. Pastikan isi tidak tampil, dialihkan ke halaman aman, dan tidak ada perubahan data. Menu yang disembunyikan di sidebar saja bukan bukti otorisasi.
**Kirim bukti dalam satu batch peran**, bukan screenshot satu per satu per tombol. Catat peran, halaman yang diterima, halaman yang ditolak, dan kesalahan. UAT bersifat baca-saja.

## Audit kode dan Cloud
- AccessGate src/routes/__root.tsx: Receptionist tidak boleh /housekeeping atau /karyawan, Housekeeping tidak boleh /booking atau /keuangan, Supervisor menggunakan src/lib/supervisor-routes.ts. Pengaturan pribadi diperbolehkan bagi staf, bisnis Owner-only.
- Finance session src/lib/sesi-kas.ts: Trainee tidak mempunyai sesi sendiri; wrapper Booking/Payment/Checkout Training bergantung pada assignment aktif dan OPEN sesi penanggung jawab. Trigger Finance menjaga konteks sesi dan audit.
- employee_profiles berisi data identitas pribadi; RLS policy authenticated Owner-only. employees basic dapat dibaca Supervisor sesuai role. RLS policy ada, tetapi belum diuji terhadap sesi browser role nyata semuanya.
- SECURITY DEFINER dengan anon grant lainnya perlu dipilah per fungsi; jangan revoke massal. resolve_housekeeping_transaction(uuid) read-only menurut definisi, tetapi dapat mengembalikan ID relasi HK; audit lanjut secara terarah, bukan klaim eksploitasi.

## Gate rilis yang masih NO-GO
1. UAT Receptionist dan Housekeeping akun nyata belum lengkap. Trainee butuh approval untuk fixture Training (0 assignment Cloud).
2. UAT positif Closing dengan hitung fisik serta Setoran dan konfirmasi Owner belum ada; 0 rekening Owner aktif.
3. Klasifikasi delapan transaksi DEMO historis bukan izin arsip; sembilan TRX aktif belum boleh disentuh. BTRD25-000006 berbayar tanpa jadwal sudah ada dalam Issue #102.
4. Backup restore, publish bundle version dan printer thermal 58mm fisik memerlukan bukti.
5. Data tidak boleh diubah hanya untuk menciptakan PASS. Status yang tanpa bukti adalah BELUM UAT/TERTUNDA.
