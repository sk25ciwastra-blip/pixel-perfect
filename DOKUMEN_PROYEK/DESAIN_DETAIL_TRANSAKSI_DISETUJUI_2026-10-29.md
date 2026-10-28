# Desain Detail Transaksi — DISETUJUI OWNER (29 Oktober 2026)

**Status: SUDAH DIKERJAKAN DI LOVABLE DAN DISETUJUI OWNER SECARA VISUAL (29 Oktober 2026).** Bukan sekadar sketsa/referensi; screenshot menunjukkan hasil implementasi Lovable yang sudah sesuai ekspektasi Owner. Belum berarti fitur lokal Codex dan migrasi Cloud sudah terintegrasi.

Bukti hasil yang telah disetujui: screenshot Lovable yang Owner unggah pada 29 Oktober 2026 sekitar 02:16 WIB, `Cuplikan layar 2026-10-29 021653.png`. Tampilan ini **sudah dikerjakan di Lovable**, bukan desain konseptual untuk dikerjakan ulang. **Jangan mengulang atau mengubah tampilannya tanpa instruksi baru Owner.**

## Struktur final disetujui
- Modal Detail Transaksi **di tengah**, lebar kompak, target seluruh informasi terlihat tanpa scroll pada desktop dengan data normal; tidak ada ruang kosong besar.
- Header **hitam–emas**: logo/teks asli Baturaden 25 Homestay seperti sidebar dalam ukuran proporsional, `MANAJEMEN`, separator, `Detail Transaksi`, nomor resmi `BTRDTRX-######`, badge status di kanan. Tanpa ikon X; tombol Tutup di kanan bawah.
- Body **warm white** dengan teks gelap yang mudah dibaca, aksen emas dan garis pembatas tipis.
- **Baris pertama tiga kolom sejajar:** `INFORMASI TAMU` | `DETAIL KAMAR & PAKET` | `JADWAL & STATUS`.
- **Baris kedua:** `RINCIAN HARGA` (tabel item dan total) | `PEMBAYARAN` (total harga, uang muka/terbayar, sisa).
- **Baris ketiga:** `RIWAYAT PEMBAYARAN` (tabel ringkas) | `SESI KAS & PERUBAHAN` (Sesi Kas dan Terakhir Diubah) dan tombol `TUTUP`.
- Judul bagian `INFORMASI TAMBAHAN` **dihapus**, tetapi isi Sesi Kas dan Terakhir Diubah dipindah ke bagian bawah, tidak dihapus.
- Tombol WhatsApp `Hubungi` tetap **sejajar satu baris** dengan nomor HP, tidak pindah ke bawah atau keluar kolom.
- Tidak ada scroll horizontal di tabel untuk jumlah data normal.
- **Isi, aksi, status, dan nominal mengikuti data nyata; gambar adalah contoh, bukan sumber kebenaran transaksi.** Jangan menciptakan field/fungsi yang belum tersedia.

## Ruang lingkup
- Desain hanya untuk popup Detail Transaksi. Jangan mengganti header/sidebar/halaman lain, fungsi bisnis, RPC, database, maupun komponen yang sudah PASS.
- **Codex mengerjakan fungsi; Lovable desain.**
- **Implementasi visual Lovable dinyatakan sesuai ekspektasi oleh Owner.** Tidak perlu mengirim ulang instruksi desain atau implementasi. Status integrasi fungsi dan aktivasi Cloud tetap pekerjaan terpisah.

## Checkpoint integrasi terkait
- Commit lokal patch RPC `38511e8` sudah dibuat dan worktree bersih menurut laporan Codex; **belum push/merge/deploy/migrasi Cloud**. Ini terpisah dari desain popup.
