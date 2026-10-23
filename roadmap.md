# Revisi tampilan Baturaden 25 Homestay

## Revisi Dashboard saat ini
- [ ] Aktifkan pengumuman persisten khusus Owner: izin baca staf resmi, audit, rotasi semua pengumuman 60 detik, navigasi/jeda/animasi, CRUD dan verifikasi tanpa publikasi.
- [x] Tambahkan panel horizontal compact Papan Informasi di antara baris Status Kamar/Transaksi Terbaru dan tiga modul analitik; sisi kiri ikon megafon + judul + subtitle, sisi kanan area pengumuman prioritas (empty state "Belum ada pengumuman operasional" karena belum ada sistem pengumuman — tanpa data dummy/backend); responsif vertikal di HP, komputer/HP terverifikasi tanpa publikasi.
- [x] Subtitle di bawah judul panel Transaksi Terbaru ditulis tepat "Aktivitas Cash Flow Terkini" (text-xs muted, gaya sama Status Kamar); ikon dan Lihat semua tidak berubah, komputer/HP terverifikasi tanpa publikasi.
- [x] Rapikan panel Transaksi Terbaru: nama tamu nama depan huruf awal kapital + 4 digit WA, tanpa kode paket (baris 2 = nomor • Booking), nomor pengeluaran ikut bisa diklik membuka rincian pengeluaran, baris pengeluaran = jenis • keperluan dan nomor • operator; komputer/HP, detail transaksi & pengeluaran terbuka/tertutup, tanpa publikasi.
- [x] Ubah indikator di bawah tabel Status Kamar menjadi 6 kotak mini (Terisi hijau, Booking biru, Persiapan kuning, Terlambat ungu, Perlu Tindakan oranye, Overtime merah) dengan angka dinamis dari data nyata; tinggi panel tetap, komputer/HP terverifikasi.
- [x] Rapikan Overtime dan ikon tabel, tampilkan nomor transaksi yang membuka detail, pindahkan indikator ke bawah, sesuaikan subjudul, ratakan kiri Aksi Cepat dan kecilkan nama Transaksi Terbaru; komputer/HP, detail transaksi asli dan formulir Check-in terverifikasi tanpa perubahan data. Perlu Tindakan ditampilkan — karena aturan penghitungannya belum tersedia.
- [x] Tambahkan garis pemisah vertikal emas redup (1px, ±13%) antar kolom tabel Status Kamar, sejajar dari kepala sampai baris terbawah dan ikut ter-scroll; garis horizontal antar baris dipertahankan, ukuran/padding/font/urutan kolom tidak berubah; komputer/HP terverifikasi.
- [x] Rapikan hanya tabel Status Kamar menjadi sembilan kolom ringkas sesuai referensi; timer bertanda, komputer/HP, pengujian dan build lulus tanpa mengubah aturan. Persiapan, Perlu Tindakan dan pembatasan khusus pemilik belum didukung; perlu pekerjaan terpisah bila diminta.
- [x] Samakan kapsul pencarian Daftar Transaksi dengan milik Daftar Tamu ("Cari Nomor Transaksi...", teks 16px), rapikan tombol "+ Check-in Langsung", kembalikan ukuran teks pencarian Tamu, ratakan kiri nama beserta jumlah kunjungan, dan ganti tombol Tamu menjadi "+ Tambah Tamu"; komputer/HP terverifikasi.
- [x] Sesuaikan teks aksi cepat/pencarian/sapaan, tanggal singkat, tabel rata tengah/logo WhatsApp, dan tampilan formulir pengeluaran; komputer/HP dan ketiga formulir terverifikasi tanpa menyimpan transaksi.
- [x] Ganti label aksi cepat ketiga menjadi "Kas Keluar" (dua baris), hapus empat kotak ringkasan status di halaman Kamar, samakan kolom pencarian Daftar Tamu dengan gaya Dashboard ("Cari Nama atau Nomor Whatsapp...."), dan ratakan tengah kolom tabel tamu; komputer/HP terverifikasi.
- [x] Susun Aksi Cepat pertama dan tiga ringkasan sejajar bawah, redupkan latar kutipan, hapus brand di atas sapaan, tambahkan pencarian dan verifikasi komputer/HP serta rincian transaksi nyata.
- [x] Rapikan batas tabel, tampilkan timer, samakan panorama dengan Login, tampilkan Pengaturan dan hapus identitas footer sidebar.
- [x] Verifikasi Dashboard dengan sesi Owner dan uji timer.

- [x] Terapkan identitas ungu, sidebar desktop, dan navigasi bawah HP.
- [x] Tata ulang Ringkasan, Kamar, Booking, Tamu, Transaksi, Housekeeping, Keuangan, Karyawan, dan Pengaturan.
- [x] Siapkan tampilan bertahap Check-in dan informasi waktu sewa contoh.
- [x] Periksa hasil visual HP dan desktop serta kesalahan aplikasi.

# Tahap 1 — Fondasi operasional

- [ ] Siapkan autentikasi, peran terpisah, izin dan data demo aman.
- [ ] Buat struktur data kamar, tipe, paket, tamu, transaksi dan aktivitas dengan aturan akses.
- [ ] Hubungkan halaman yang ada ke data tersimpan serta tindakan pengelolaan dasar.
- [ ] Uji penyimpanan, validasi, izin, dan tampilan tanpa mengubah desain.
# Tahap 2 — Tindakan pemesanan dan check-in

- [ ] Baca INTRUKSI-TAHAP2.md dari repositori dan cocokkan dengan data tersimpan.
- [ ] Tambahkan tombol + Buat Booking Baru pada /booking beserta formulirnya.
- [ ] Tambahkan tombol + Check-in Langsung pada /transaksi beserta formulirnya.
- [ ] Uji kedua alur tanpa mengubah desain yang ada.

- [x] Sampaikan nama pengguna akun demo Owner kepada pengguna.

# P0 — Penyempurnaan Dashboard saat ini
- [x] Rapikan tabel kamar, KPI, tinggi daftar transaksi, dan tiga panel analitik tanpa mengubah aturan.
- [x] Periksa Dashboard 1580×900 dan Booking serta halaman operasional dengan data tersedia, tanpa membuat transaksi.

# Redesain "Malam Keemasan Modern"
- [x] Tahap 1: fondasi tema, sidebar/header/navigasi HP, halaman Masuk, tombol & isian bersama.
- [ ] Tahap 2: Dashboard (menunggu persetujuan Owner).
- [ ] Tahap 3: Kamar (hapus 4 kartu ringkasan di Semua Kamar), Booking, Transaksi, Tamu.
- [ ] Tahap 4: Housekeeping, Keuangan, Laporan, Tim & Akses, detail.
