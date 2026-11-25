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
- **Daftar Transaksi tabel cream-gold, form Reservasi font Check-in/Pengeluaran, dan `ActionResultDialog`** masih **rancangan visual**, belum ada implementasi kode atau validasi LIVE. Jangan membongkar fitur lama hanya untuk mengikuti screenshot sketsa.
- **Addendum §6A di Checkpoint Utama: 13 revisi desain Lovable dari Owner (UI-26-01 s.d. UI-26-13), semuanya BELUM REVISI.** Termasuk tombol/popup Aksi Cepat Penawaran (tidak menghidupkan pintu Penawaran terpisah), popup Success/Error, histori Booking, grafik & agenda Dashboard, warna tabel Transaksi, Pengaturan, Bantu Sesi Aktif, Logout, Kartu Reservasi, konfirmasi penghapusan, Check-out Dashboard, dan Form Reservasi. **Baca §6A sebelum mengerjakan desain; jangan menandai selesai dari sketsa.**
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
