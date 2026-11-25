# PANDUAN RESMI MEMULAI OBROLAN BARU — BATURADEN 25 HOMESTAY

**Diperbarui:** 26 November 2026 (WIB)  
**Dokumen utama:** [CHECKPOINT_UTAMA_20261126.md](CHECKPOINT_UTAMA_20261126.md)  
**GitHub:** https://github.com/sk25ciwastra-blip/pixel-perfect

## Baca berurutan

1. **[Checkpoint Utama 26 Nov](CHECKPOINT_UTAMA_20261126.md)** — sumber checkpoint terkini untuk keputusan, PR, UAT dan desain yang belum masuk kode.
2. [Alur Reservasi Satu Pintu 25 Nov](ALUR_RESERVASI_SATU_PINTU_20261125.md) — status permintaan, kartu QRIS, DP dan konversi menjadi Booking resmi.
3. [Buku Induk](01_BUKU_INDUK.md), [Aturan Bisnis](02_ATURAN_BISNIS.md), [Status Fitur](03_STATUS_FITUR.md), [Riwayat Perubahan](04_RIWAYAT_PERUBAHAN.md) — baca untuk detail dan sejarah; jangan salah menganggap paragraf bertanggal Oktober sebagai status mutakhir.
4. Dokumen spesifik modul hanya bila sedang mengerjakannya, misalnya [Poin 4 Template WA](POIN4_WHATSAPP_RELEASE_GATE_20261125.md), [No9 UAT Finance](NO9_WORK_UAT_FINANCE_20261123.md), [Transisi DEMO→LIVE](CHECKPOINT_TRANSISI_DEMO_LIVE_20261122.md).
5. **Lakukan pemeriksaan GitHub `main` terbaru sebelum bekerja.** Bila ada PR/commit lebih baru daripada checkpoint, bandingkan source dan keputusan terlebih dahulu; buat addendum, bukan menebak.

## Pesan pembuka siap tempel ke ChatGPT/Work/Codex

> Kita melanjutkan proyek **Baturaden 25 Homestay**. Sebelum bekerja, buka GitHub repo `sk25ciwastra-blip/pixel-perfect` dan baca `DOKUMEN_PROYEK/PANDUAN_MULAI_OBROLAN_BARU.md` serta `DOKUMEN_PROYEK/CHECKPOINT_UTAMA_20261126.md` dari branch `main`. Baca dokumen modul yang relevan saja. Periksa apakah ada commit/PR lebih baru. **Jangan mengulang pekerjaan atau UAT yang sudah PASS.** Bedakan keputusan desain, kode MERGED, sinkron Lovable, hasil publish, dan UAT nyata. Jangan mengubah Cloud SQL, transaksi, data UAT, hak akses, feature flag, atau publish tanpa persetujuan spesifik. Codex untuk fungsi/PR, Lovable untuk desain/UI, dan ChatGPT untuk audit, koordinasi serta eksekusi langsung sesuai akses. Laporkan **posisi terakhir dan satu pekerjaan berikutnya**; jangan membuat rencana baru yang bertentangan dengan checkpoint.

## Handoff ringkas yang wajib dijaga

- Source GitHub/Lovable terverifikasi terakhir pada merge **PR #172**, SHA `a3426fb`, tetapi Lovable sebelumnya melaporkan `out_of_credits`; **jangan asumsikan versi published/preview sudah berfungsi hanya karena source sinkron**.
- **PR #167–#172 MERGED**. Template WA Reservasi + Salin Pesan dan unduh JPG memiliki UAT Owner **PASS**. WhatsApp direct chat dari tombol Lovable **belum PASS**; gunakan cara manual. Scan QRIS HP dan konversi pembayaran resmi **belum PASS UAT baru**.
- **Gate SQL Overtime WhatsApp:** baca [POIN4_OVERTIME_WHATSAPP_RELEASE_GATE_20261126.md](POIN4_OVERTIME_WHATSAPP_RELEASE_GATE_20261126.md) sebelum perubahan Cloud. Jenis Overtime belum ada di LIVE; preflight metadata/RLS READ-ONLY sudah dilakukan. Rollback konservatif dan tes PostgreSQL 17 sintetis disiapkan pada branch/PR release gate; **jangan sebut PASS sebelum CI**, dan jangan pernah apply SQL/publish dari persetujuan merge kode saja.
- **Koreksi kategori Pengaturan → Template WhatsApp (26 Nov):** empat pilihan UI yang diminta Owner: **Konfirmasi Reservasi, Pengingat Booking, Pengingat Waktu Habis, Pemberitahuan Overtime**. **WAJIB: Konfirmasi Reservasi = rincian permintaan SEBELUM pembayaran, masih MENUNGGU PEMBAYARAN, belum TRX, belum Booking, kamar belum dikunci.** Jenis teknis yang digunakan adalah `PENAWARAN_RESERVASI` (label UI baru), **BUKAN** `KONFIRMASI_BOOKING` sesudah pembayaran. Draf benar ada di [DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md](DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md). **PR #179 MERGED**, commit `be3eedd6f1437d65399e36bfca03731dba6685ac`, 16/16 CI PASS dan source Lovable tersinkron. **Ini bukan bukti versi publish/UAT browser**: Lovable `out_of_credits`, preview tidak dapat diakses oleh pemeriksa. Template ACTIVE lama tetap tidak berubah hingga Owner menyimpan versi baru; SQL penambahan kind Overtime hanya **PENDING**, tidak di-apply tanpa persetujuan terpisah. Tarif Rp50.000/jam adalah teks pemberitahuan, bukan perubahan hitungan biaya.
- **Daftar Transaksi tabel cream-gold, form Reservasi font Check-in/Pengeluaran, dan `ActionResultDialog`** masih **rancangan visual**, belum ada implementasi kode atau validasi LIVE. Jangan membongkar fitur lama hanya untuk mengikuti screenshot sketsa.
- **Addendum §6A di Checkpoint Utama: 12 revisi desain Lovable aktif dari Owner (UI-26-02 s.d. UI-26-13), semuanya BELUM REVISI.** Item `UI-26-01` (popup/tombol Aksi Cepat Penawaran) **DICABUT OWNER** dan bukan pekerjaan tertunda; nomor ID tidak digunakan ulang. Pekerjaan aktif: popup Success/Error, histori Booking, grafik & agenda Dashboard, warna tabel Transaksi, Pengaturan, Bantu Sesi Aktif, Logout, Kartu Reservasi, konfirmasi penghapusan, Check-out Dashboard, dan Form Reservasi. **Baca §6A sebelum mengerjakan desain; jangan menandai selesai dari sketsa.**
- Pusatkan pekerjaan pada **satu target** setiap kali; hanya perbaiki temuan baru. Tidak ada persetujuan GO-LIVE baru.

## Protokol anti-berputar-putar setelah setiap pekerjaan

Setelah **setiap** keputusan Owner atau PR yang di-merge:

1. Perbarui checkpoint bertanggal terbaru atau addendum pada dokumen ini sebelum mengakhiri pekerjaan. Jangan menyatakan sudah tersimpan sebelum commit ditemukan di **GitHub `main`**.
2. Catat **keputusan**, **lokasi file**, **PR dan commit**, **hasil CI**, **status sinkron Lovable**, **status publish**, **UAT browser PASS/FAIL/BLOCKED**, dan **pekerjaan berikutnya** sebagai kolom/status terpisah.
3. Tulis perubahan visual baru sebagai **DESAIN / BELUM IMPLEMENTASI** sampai source benar-benar berubah. Tulis kode berubah sebagai **MERGED / UAT BELUM** sampai Owner memeriksa browser.
4. Tidak mengulang UAT historis yang sudah PASS kecuali regresi spesifik; jangan membuat pembayaran/refund/closing baru untuk membuktikan layout.
5. Bila changelog historis konflik dengan checkpoint terbaru, buat **addendum tanggal baru yang mengacu sumber**, jangan menghapus keputusan lama atau menebak migrasi telah dijalankan.
6. **Jangan unggah backup database, data pribadi tamu, informasi rekening privat, token atau kredensial ke GitHub checkpoint.**
7. Apabila checkpoint sudah lebih tua daripada PR terkini, **perbarui dokumen dahulu** sebelum lanjut kode/desain berikutnya.

**Kalimat penting:** Obrolan ChatGPT boleh berganti; status proyek di GitHub tidak boleh ikut hilang. Arsipkan obrolan lama bila perlu, jangan jadikan penghapusan chat sebagai solusi hilangnya checkpoint.
