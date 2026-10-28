# Revisi tampilan Baturaden 25 Homestay

## Keuangan — tujuh kotak ringkasan tanpa teks terpotong 28 Oktober
- [x] Kotak ringkasan disusun ulang menjadi tumpukan (ikon di atas, teks di bawah) sehingga judul dan nominal selalu satu baris; nilai besar sekalipun tetap utuh.
- [x] Diukur pada isi desktop 1582px dan HP 390px: tidak ada baris ganda atau terpotong untuk nilai riil maupun Rp 125.000.000; teks terbaca penuh; typecheck dan build OK; tanpa publikasi.

## Keuangan — penyempurnaan sketsa Owner 28 Oktober
- [x] Rapikan ringkasan, sesi kas, closing, setoran, refund, pengeluaran dan pengaturan existing; header/sidebar/kutipan serta seluruh perhitungan, aksi dan izin dipertahankan.
- [x] Desktop 1440px/HP 390px diperiksa dengan sesi Owner tanpa overflow atau kesalahan; isian refund dan pencarian pengeluaran diuji tanpa menyimpan data. Tes keuangan/training PASS; tanpa publikasi.

## Housekeeping — sketsa Owner 27 Oktober
- [x] Rapikan header tanpa foto, kutipan, navigasi empat bagian, ringkasan nyata, tabel kamar dan Perawatan Berkala tanpa perubahan aturan atau halaman lain.
- [x] Empat bagian diperiksa dengan sesi Owner desktop 1440px/HP 390px tanpa overflow; pencarian kamar dan riwayat terbuka memakai data asli. Build otomatis OK dan tes pembatasan training PASS; tanpa perubahan data atau publikasi.

## Koreksi skala header — cover
- [x] Kembalikan gambar sembilan header ke cover dengan fokus per halaman; ukuran header, overlay dan Dashboard tetap.
- [x] Sembilan header diperiksa dengan sesi Owner pada desktop 1440px/HP 390px: cover memenuhi area, judul terbaca, tanpa overflow atau runtime error; build otomatis OK dan checksum Dashboard identik. Tidak publish.

## Revisi header final 26 Oktober
- [x] Perbaiki framing lima gambar existing tanpa crop; ganti Tamu (Jaipong dan penonton), Housekeeping (merapikan kasur), Laporan (meja analisis operasional), Pengaturan (ruang meeting/workflow) dengan komposisi horizontal dan subjek utuh, tanpa perubahan Dashboard atau elemen lain.
- [x] Sembilan header diverifikasi dengan sesi Owner desktop 1440px/HP 390px: gambar termuat, framing contain, judul terbaca, tanpa overflow atau runtime error; build otomatis OK, checksum Dashboard identik. Tidak publish atau mengubah data.

## Latar sembilan header — referensi final Owner
- [x] Buat dan pasang sembilan latar ilustratif sesuai referensi, dengan overlay hitam–emas dalam area header existing saja; Dashboard, sidebar, isi, popup, form, aksi dan data tidak diubah.
- [x] Sembilan halaman diperiksa dengan sesi Owner pada desktop 1440px dan HP 390px: semua gambar termuat, judul terbaca, tanpa overflow/kesalahan runtime; build otomatis OK dan checksum Dashboard identik sebelum/sesudah. Tidak ada publikasi atau perubahan data.

## Paket final Owner — Kamar, Transaksi, header Priangan
- [x] Pindahkan Check-in resmi ke Kamar dengan izin dan refresh existing; tombol Kamar tetap Owner saja.
- [x] Ganti panah detail daftar Transaksi dengan WhatsApp resmi berizin/validasi nomor, nomorator tetap pembuka detail tunggal.
- [x] Variasi latar header melalui mapping bersama, Gedung Sate existing Dashboard dan pola lokal halus untuk tema lain; form/konten tetap.
- [x] Preview Owner 1440px/390px: formulir Check-in buka/tutup, nomorator membuka detail, WhatsApp memakai nomor penuh, seluruh tema header tampil tanpa overflow/error runtime; 16 tes lulus dan build otomatis OK. Tidak menyimpan transaksi baru atau mengirim pesan; peran staf/inspector diuji helper, belum sesi langsung. Typecheck tidak dijalankan manual sesuai aturan lingkungan; tidak ada laporan typecheck terpisah.

## Daftar Transaksi — referensi Owner 26 Oktober
- [x] Susun daftar hitam–emas berdasarkan tanggal, filter bulan/tahun berjalan WIB, pencarian nomor seluruh periode, pagination 20 transaksi melalui query seluruh data berizin, dan sidebar Transaksi tanpa submenu.
- [x] Uji filter/pencarian/detail dengan akun Owner dan 11 transaksi asli di desktop 1440px/HP 390px tanpa overflow atau kesalahan runtime; build otomatis lulus. Pagination di atas batas 1000 baris diuji dengan mock query, karena data asli hanya 11 transaksi; tanpa data rekaan, publikasi atau perubahan database/form/Finance.

## Tiga popup detail — referensi Owner 24 Oktober
- [x] Selaraskan Detail Transaksi, Detail Housekeeping, dan Detail Pengeluaran ke hitam–emas dengan bagian dua kolom berikon, judul serif, nominal semantik dan modal tengah 720px bergulir; sumber data, tindakan, dan formulir tetap.
- [x] Build otomatis lulus; Transaksi dan Pengeluaran diperiksa dengan akun Owner dan data tersimpan pada 1440px/390px, gulir dan Tutup berjalan tanpa overflow atau kesalahan runtime; lima tes tampilan serta tiga tes biaya lulus, tanpa publikasi.
- [ ] Screenshot Detail Housekeeping dengan data asli menunggu nomor pekerjaan HK tersimpan pada kamar; seluruh kamar yang tersedia saat pemeriksaan menampilkan HK belum tercatat. Tidak membuat pekerjaan atau memalsukan data untuk pemeriksaan.

## Halaman Tamu — rancangan final Owner
- [x] Revisi enam kolom, ikon catatan 21px rapat, tombol pada header sesuai Transaksi, detail Gedung Sate/informasi berikon/catatan dan riwayat bertumpuk; screenshot 1440px/390px tanpa overflow, build dan lima tes lulus; dua catatan tersimpan melalui tombol baru dan bertahan setelah reload, data pengujian dibersihkan.
- [ ] Lampu Active/Blocked menunggu sumber status tamu resmi: kolom saat ini menampilkan Belum tersedia, tanpa status rekaan atau perubahan skema.
- [x] Koreksi komposisi desktop: panel memenuhi konten, kolom 34/27/22/17%, toolbar sejajar, nama panjang tooltip, body 16px dan baris 57px; modal informasi dua kolom compact serta catatan/riwayat sejajar. Pemeriksaan screenshot 1440px/390px dan lima helper tests tanpa perubahan data.
- [x] Revisi visual tujuh poin: SVG WhatsApp Dashboard, header WHATSAPP, format xxxx+empat digit, tabel mengikuti isi, font satu tingkat lebih besar, modal navy-gold dua kolom dengan edit inline; lima tes aturan dan build otomatis lulus, pemeriksaan komputer/HP tanpa perubahan data.
- [x] Rapikan tabel empat kolom, urutan nama/kunjungan, modal tengah dan formulir inline.
- [x] Riwayat guest_notes append-only diterapkan dengan baca mengikuti izin guests, tanpa hak tulis langsung staf; trigger atomik menyimpan metadata aktual dan backfill legacy tetap tidak diketahui.
- [x] Uji komputer/HP, tambah tamu sementara, dua catatan persisten setelah reload, pembaruan inline, pencarian WA penuh dan DetailTransaksi existing; lima tes aturan serta build otomatis lulus. Data sementara dihapus; tanpa publikasi. Akun inspector tidak diuji langsung.

## Revisi Dashboard saat ini
- [x] Aktifkan pengumuman persisten khusus Owner: migrasi aditif diterapkan, RLS izin baca operasional/tulis Owner dan audit penulis aktual; seluruh pengumuman rotasi 60 detik, navigasi manual, jeda hover/focus, animasi 450ms/reduced-motion; CRUD, reload persisten, realtime lintas halaman, desktop/HP, satu/kosong dan tes murni terverifikasi tanpa publikasi. Sesi staf tidak diuji langsung; kebijakan remote diverifikasi.
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

# Revisi lanjutan (di luar tahapan)
- [x] Keuangan: susun ulang layout — KPI → Sesi Kas → dua kolom (Closing | Setoran/Refund) → Aktivitas Keuangan & Ringkasan Hari Ini → Pengaturan Owner; seluruh field, konfirmasi setoran, dan aturan closing dipertahankan.
