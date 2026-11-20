# Baturaden 25 Homestay — Reset Transaksi DEMO Only & Estimasi GO (21 November 2026)

## Keputusan Owner sekarang
- Tunda dahulu **penghapusan 11 akun karyawan DEMO**, fokus hapus transaksi DEMO dan seluruh relasi operasional terkait.
- Jangan mengubah dua karyawan ASLI `B25EMP-001` Supervisor dan `B25EMP-002` Receptionist, profil, foto, password, Auth user, role, maupun penomorannya.
- Owner sudah mengonfirmasi bahwa data operasional historis adalah DEMO.
- Status LIVE **BELUM ADA YANG DIHAPUS**. Operasi destruktif sebelumnya diblokir pengamanan alat; jangan mencoba mengakali pemblokiran atau menjalankan skrip retired.

## Pengecekan LIVE SELECT-only
- `transactions` = **17** (pertama 2026-10-02; terakhir 2026-11-17 UTC).
- `payments` = **24**, terakhir 2026-11-17 UTC.
- Sejak 20 November 2026 00.00 WIB, jumlah transaksi dan pembayaran baru = **0**.
- `finance_cash_sessions` = **5**, masih OPEN = **2**.
- `guests` = **19**.
- `rooms` = 12, **4 occupied** oleh data DEMO dan **1 dirty**.
- 23 tabel operasional DEMO berisi tepat **102 baris** (termasuk transaksi, payment, guest, HK, receipt, finance session, refund/idempotency).
- `employees`: 13 = 11 DEMO lama + 2 ASLI.
- FK di DB menghubungkan transactions dengan payments, reservations, receipts, HK, refund, guests; beberapa ON DELETE SET NULL meninggalkan catatan gantung. **Hapus 17 transactions saja TIDAK aman**. TRUNCATE CASCADE juga tidak direkomendasikan.
- Finance session mempunyai FINAL guard dan Training guard, payments/transactions mempunyai Training guard. Jalur penghapusan harus diaudit sebagai prosedur terisolasi dengan postcheck, bukan perintah SQL lepas.

## Backup gate
- Export terakhir di Storage `database_export_20_11_26/pixel-perfect-homestay-hub_261120.backup` dibuat 2026-11-20 20:47 UTC / 21 November 03:47 WIB, **sebelum** dua akun asli dibuat.
- Lovable UI menolak permintaan export kedua karena 24-hour limit. **Tidak tersedia backup baru yang mencakup dua karyawan ASLI**.
- Verifikasi restore penuh belum PASS. Jangan mengandalkan `Restore to this backup`, karena akan menghilangkan dua akun ASLI yang dibuat setelahnya.

## Strategi aman ketika backup memungkinkan
1. Hasilkan ekspor database terbaru setelah jendela 24h berlalu, tambah backup file foto dari Storage dan pastikan keduanya tersedia.
2. Review prosedur transaksi-only terpisah yang mempertahankan 13 karyawan (2 asli + 11 lama), semua Auth, user roles, employee profiles, bucket fotos, 12 rooms, 9 packages, 5 room types, settings/commission/templates/sequence.
3. Di dalam *satu transaksi atomik* dengan exact-count preflight, bersihkan hanya operasi DEMO dari 23 tabel yang sudah diaudit, tanpa CASCADE dan tanpa RESET IDENTITY. Seluruh trigger/constraint dan external references harus diperiksa ulang saat eksekusi.
4. Kamar occupied karena transaksi DEMO ditandai **dirty untuk inspeksi fisik**, tidak otomatis READY. Setelah pemeriksaan fisik dan HK authorized, barulah READY.
5. Postcheck: transaksi/payment/guest/sesi kas/demo HK semua 0 sesuai manifest, tabel config dan 13 staff tetap utuh, dua foto nyata tetap, ID allocator intact, login dua staf dan owner tetap berfungsi.

## Syarat GO walaupun karyawan DEMO belum dihapus
- 11 Auth DEMO dapat menunggu untuk *deletion*, tetapi **akses mereka harus dicabut sebelum GO**, termasuk sesi lama. Jangan menyamakan menyembunyikan staff dari UI dengan mencabut akses server.
- Minimal satu siklus LIVE atau rehearsal yang disetujui Owner: Booking DP, Check-in same TRX, pembayaran & kas, checkout, HK→READY, closing minus, refund sesuai aturan, receipt 58mm, serta role/guard sesuai Owner.
- Runtime/deployment/flags, backup/restore dan acceptance fisik wajib. Checkpoint lokal PASS tidak ditafsir sebagai Cloud PASS.

## Estimasi progres GO
**~65% siap teknis, sisa ~35% (estimasi manajemen, bukan pengukuran objektif atau persetujuan GO)**.
Dasar: kode core logic dan uji lokal yang PASS dipertahankan; master config dan uji login/role dua karyawan nyata PASS; UI/dashboard dasar diverifikasi Owner. Tetapi data operasional DEMO belum dibersihkan, backup dua akun baru belum tersedia, aktivasi/publish dan flag belum dibuktikan, E2E transaksi Cloud + printer fisik belum di-accept, Auth DEMO masih aktif. **NO-GO** sampai semua gate kritis PASS.

## Hasil
Audit completed; perintah destruktif tidak dilakukan; database LIVE belum berubah oleh pekerjaan ini.
