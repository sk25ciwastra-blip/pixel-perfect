# Revisi tampilan Baturaden 25 Homestay

## Halaman Pengaturan — 15 November
- [x] Dashboard menu Owner di `src/routes/pengaturan.tsx` (satu-satunya file berubah): tiga kelompok serif (Operasional, Keuangan, Akun & Keamanan), kartu warm white semi-3D dengan medali ikon hitam-emas, grid 3 kolom desktop / 1 kolom HP; Kerangka, sidebar, dan latar header asli tidak disentuh.
- [x] Hanya rute sah yang dapat diklik: Tipe Kamar, Paket & Harga, Daftar Pengeluaran, Minimum DP & Komisi, Rekening Owner (5 kartu aktif); Manajemen Kamar, Profil Homestay, Metode Pembayaran, Keamanan tampil nonaktif berlencana "Belum tersedia" tanpa link palsu.
- [x] Preview akun uji Owner 1280×1800/390×844: 5 kartu aktif + 4 nonaktif tampil, klik Tipe Kamar menuju /tipe-kamar, tanpa overflow HP, tanpa error runtime, build OK; tanpa perubahan hak akses/database dan tanpa publikasi.

## Layar sambutan setelah login — 15 November
- [x] Revisi final Owner: satu gambar panel tetap `src/assets/sambutan-panel.png` (dipotong persis mengikuti lekukan bingkai emas dari tangkapan layar referensi, latar transparan) untuk semua jabatan, menggantikan versi teks dinamis per peran; overlay hitam polos, panel kecil pas di tengah (desktop 560px, HP 420px) dengan glow emas halus, durasi tampil 2 detik.
- [x] Alur: penanda sesi disetel hanya setelah `signInWithPassword` berhasil; gambar dimuat penuh dulu sebelum hitungan mulai; fade CSS lalu otomatis hilang, dapat dilewati klik/keyboard, tidak tampil saat refresh atau sesi aktif; tanpa mengubah login, otorisasi, Training, sesi kas, database, maupun halaman lain.
- [x] Preview akun uji Owner 1280×1800: panel tampil kecil terpusat di layar hitam dengan tepi bingkai emas rapi, hilang otomatis ke Dashboard, tanpa error runtime, build OK; tanpa publikasi.

## ID transaksi seragam warna emas — 15 November
- [x] Samakan warna nomor transaksi di seluruh halaman dengan milik tabel Status Kamar: emas tua di latar terang (tabel krem Housekeeping, daftar Booking, kartu Kamar) dan champagne gold di latar gelap (Transaksi Terbaru, daftar Transaksi, riwayat Tamu, kepala Detail Transaksi, tabel aktivitas Keuangan); isi, hak akses, dan tindakan tetap.
- [x] Preview akun aktif terukur: latar krem/kertas memakai oklch(0.46 0.12 70) sama persis dengan tabel Status Kamar, latar gelap memakai oklch(0.76 0.115 82); tidak ada nomor abu-abu tersisa, tanpa runtime error, build OK; tanpa publikasi.

## ID transaksi tabel krem lebih jelas — 15 November
- [x] Perdalam warna emas nomor transaksi di tabel Status Kamar Dashboard dan perbesar sedikit teksnya agar terbaca jelas; pemutusan nomor di tanda hubung, isi, klik, izin dan proses tetap.
- [x] Preview akun aktif: kontras terukur 5,6:1 terhadap latar krem (sebelumnya 3,4:1), teks 11px tebal, nomor pecah menjadi "BTRDTRX-" dan "000025" tanpa digit terpotong, klik tetap membuka detail, tanpa runtime error, build OK; tanpa publikasi.

## Nomor transaksi emas di tabel krem — 15 November
- [x] Ganti warna nomor transaksi di tabel Status Kamar Dashboard dari abu-abu gelap menjadi emas; isi, klik, izin dan proses tetap.
- [x] Preview akun aktif: warna terukur emas kaya dan terbaca di latar krem, klik tetap membuka detail, tanpa runtime error, build OK; tanpa publikasi.

## Kas Keluar — gambar 15 November
- [x] Sesuaikan kepala, font dan panel: Sesi Kas penuh di atas, Rincian/Pembayaran berdampingan, Ringkasan penuh di bawah; CASH, data pilihan, izin dan penyimpanan tetap.
- [x] Preview akun aktif 1582×900/390×844: susunan panel sesuai referensi, nominal Rp25.000 terbaca di Ringkasan, Batal menutup, tanpa overflow/error runtime; tes keuangan/training PASS dan build OK. Pilihan pengeluaran tetap belum tersedia; tanpa menyimpan pengeluaran atau publikasi.

## Booking — pilihan tipe kamar
- [x] Hilangkan kolom input Tamu Tambahan hanya pada Booking; gunakan pilihan tipe lalu nomor terurut seperti Check-in, dengan sumber kamar Booking, tanggal/jam, DP dan penyimpanan tetap.
- [x] Preview akun aktif komputer/HP: input Tamu Tambahan tidak tampil di Booking, empat tipe berurutan dan nomor terkecil per tipe, paket/tanggal/jam/DP dapat dipilih; Check-in tetap memiliki input Tamu Tambahan. Dua tes urutan PASS, tanpa runtime error, build OK; tanpa menyimpan transaksi atau publikasi.

## Reservasi dan Kas Keluar — template Check-in Langsung
- [x] Samakan kepala hitam, isi terang, font, empat bagian dua kolom dan tombol bawah; tanggal/jam, DP, CASH, sumber pilihan, izin dan penyimpanan tetap.
- [x] Preview akun aktif 1582×900/390×844: empat bagian tampil tanpa overflow/error, Reservasi memilih kamar/paket/tanggal/jam dan DP tetap dapat diisi, Kas Keluar menampilkan nominal Rp25.000; Batal menutup kedua form. Tes urutan, training, keuangan dan frontend DP PASS; build OK. Pilihan pengeluaran tetap belum tersedia seperti sebelumnya; tanpa transaksi baru atau publikasi.

## Check-in Langsung — tampilan gambar Owner
- [x] Sesuaikan kepala hitam, isi terang, empat bagian dua kolom, font/ukuran/warna dan pengingat bawah; Booking, data, harga, pembayaran, izin dan proses simpan tetap.
- [x] Preview komputer 1582×900/HP 390×844: input tamu, ringkasan awal dan Batal berjalan, tanpa overflow/runtime error; build OK, tes training dan empat tes frontend pembayaran/autofill PASS. Pilihan berharga nyata belum terverifikasi karena daftar kamar siap kosong saat pemeriksaan; tanpa transaksi baru atau publikasi. Suite readiness lengkap menemui mock aset struk lama yang belum didukung, tes formulir terkait dijalankan selektif.

## Check-in Langsung — urutan pilihan & daftar paket 15 November
- [x] Urutkan tipe kamar Standard, Superior A, Superior B, Deluxe (tipe lain di belakang) dan tampilkan daftar paket tanpa harga; harga tetap pada Harga Kamar serta Ringkasan, aturan pilih/izin/simpan tidak berubah.
- [x] Dua tes urutan PASS; Preview akun aktif 1582×900: tipe sesuai urutan, nomor kamar terkecil per tipe (Standard 09/12, Superior A 11, Superior B 02/04, Deluxe 05/10), sembilan paket tanpa "Rp", Harga Kamar terisi, tanpa runtime error; build OK, tanpa menyimpan transaksi atau publikasi.

## Housekeeping — diagram tidak menutupi label
- [x] Tempatkan label di baris atas serta angka dan diagram di baris bawah yang terpisah; ukuran kartu, data dan fungsi tetap.
- [x] Preview akun aktif pada lebar 1582/1280/390px: keenam label dan angka tidak beririsan dengan diagram, seluruh label berada dalam kartu; tanpa error runtime, empat tes PASS dan build OK; tanpa publikasi.

## Housekeeping — tiga koreksi kesejajaran dan ketebalan
- [x] Pusatkan ikon, label, angka dan persentase kartu; samakan hierarki ketebalan tabel dengan Dashboard; sejajarkan batas bawah panel antrean dan panel kamar pada desktop, tanpa perubahan data atau fungsi.
- [x] Preview akun aktif 1582×900/390×844: pusat ikon/teks/persentase dan batas bawah kedua panel terukur identik; bobot teks 600/700, pencarian 06 serta riwayat berjalan, tanpa overflow/error. Empat tes PASS dan build OK; tanpa publikasi.

## Housekeeping — warna tabel seperti Dashboard
- [x] Tabel Status Kamar & Housekeeping memakai palet krem tabel Dashboard (latar krem, teks gelap, pemisah emas, pil kamar hitam); data, status, izin, aksi, lima tab dan panel lain tetap.
- [x] Preview akun aktif diperiksa: warna latar/teks/baris judul/pil terukur sama dengan tabel Dashboard, tanpa error runtime; empat tes antrean/izin PASS dan build OK, tanpa publikasi.

## Housekeeping — permukaan premium dari tab ke panel bawah
- [x] Perhalus relief tab, ringkasan, tabel dan panel bawah dengan sorotan satin, bayangan lembut dan teks jelas; header, data, status serta fungsi tetap.
- [x] Preview komputer/HP diperiksa dengan akun aktif: pencarian 06, filter dan riwayat berjalan, tanpa teks bertabrakan/overflow/error; empat tes PASS dan build OK, tanpa publikasi.

## Housekeeping — header seperti Daftar Transaksi
- [x] Samakan font/ukuran judul, garis emas 80px, kutipan di kanan bawah dan jarak header ke isi; latar asli, panel tabel dan fungsi tetap.
- [x] Preview komputer/HP diperiksa: garis emas, judul serif dan kutipan sejajar bawah; pencarian/filter/detail dan lima tab berjalan, empat tes PASS serta build OK, tanpa publikasi.

## Housekeeping — toolbar dan tabel saja
- [x] Pisahkan pencarian/filter, tinggi 38px, teks 13–14px/status 12px, baris minimum 56px dan kolom Aksi tetap terlihat; panel lainnya tetap. Isi panjang membungkus tanpa bertabrakan.
- [x] Preview akun aktif 1582×900/1280×900/390×844: pencarian 06/filter/detail berjalan, semua filter tampil, Aksi utuh; empat tes PASS dan build OK. Screenshot Preview disediakan, tanpa publikasi.

## Housekeeping — penyempurnaan visual akhir
- [x] Perhalus header/tab, dimensi ringkasan dan ikon, tabel lebih terbaca, diagram kosong elegan, antrean dan kartu bawah; latar asli, data dan seluruh fungsi tetap. Garis stok tanpa data dihapus, titik status ganda dan tombol mata flat diperbaiki secara lokal.
- [x] Preview akun aktif 1582×900, 1280×900 dan 390×844: pencarian 06, filter, detail riwayat dan lima tab berjalan; panel bawah HP diperiksa, empat tes antrean/izin PASS dan build OK, tanpa publikasi.

## Koreksi Housekeeping — susunan persis referensi
- [x] Lima tab, enam ringkasan, tabel tujuh kolom, diagram dan antrean kanan, serta Perlengkapan & Linen / Perawatan & Kendala di bawah tampil; data tanpa sumber resmi tetap kosong, aksi existing dipertahankan.
- [x] Preview 1582×900/390×844 diperiksa dengan akun aktif: pencarian 06, detail riwayat, filter tipe dan lima tab berjalan; empat tes antrean/izin PASS, build OK, tanpa perubahan database atau publikasi. Angka dan isi tabel tetap data nyata, bukan salinan contoh gambar.

## Housekeeping — referensi 14 November
- [x] Sesuaikan header handuk, font, tab, ringkasan, tabel warm white dan panel kanan secara lokal; seluruh sumber data, izin dan aksi existing tetap. Modul inventaris/tugas/progress contoh tidak ditambahkan karena belum ada sumber dan fungsi existing.
- [x] Empat bagian dan pencarian kamar 06 diuji dengan akun aktif pada komputer/HP tanpa overflow; empat tes antrean/izin PASS dan build OK. Tanpa menyimpan status atau publish.

## Header fitur — 14 November
- [x] Sambungkan gambar latar fitur ke atas dan hapus hari/tanggal header selain Dashboard; Housekeeping tetap tanpa foto, tanggal data operasional tetap.
- [x] Preview akun aktif 1582×900/390×844: delapan latar fitur mulai dari atas, menu profil berjalan, Housekeeping tetap tanpa foto, tanggal Dashboard tetap tampil; tanpa overflow/error dan build OK, tanpa publikasi.

## Penyempurnaan akhir Status Kamar — 14 November
- [x] Perjelas ID transaksi, keterangan HK dan legenda; label Check-in Langsung serta kedalaman lembut legenda saja, tanpa perubahan kartu, popup, data atau fungsi.
- [x] Preview akun aktif 1582×900 dan 390×844: ukuran kartu dan posisi/ukuran legenda identik sebelum/sesudah; tombol membuka form existing, popup hanya menutup kembali dan ID membuka detail. Tanpa overflow/error, 6 tes PASS, build OK; tanpa menyimpan atau publish.

## Popup semua status kamar — 14 November
- [x] Gunakan template disetujui dengan nomor dinamis dan indikator merah/amber/biru/abu; hanya aktif READY berizin membuka form. Pilih Kamar Lain hanya menutup popup, tanpa X.
- [x] Kamar terisi dan perlu dibersihkan diuji dengan data nyata, nomor dinamis, tutup kembali ke daftar, READY membuka form dan HP tanpa overflow; 6 tes PASS, build OK. Sedang dibersihkan/tidak aktif diuji helper karena belum ada baris nyata; status/alasan perbaikan belum memiliki sumber resmi terstruktur sehingga tidak dikarang.

## Popup kamar terisi — 14 November
- [x] Popup putih hangat dengan judul merah/hitam, ikon ranjang, bingkai dan gelombang emas mengikuti gambar; memakai nomor dan status tersimpan, tanpa mengubah kartu atau validasi.
- [x] Tombol Pilih Kamar Lain hanya menutup popup kembali ke daftar kamar; tombol X dihapus, tampilan lain tetap. Alur diperiksa dengan sesi aktif, daftar kembali tanpa form Check-in dan URL tetap; build OK, tanpa menyimpan atau publish.

## UX Kamar — 14 November
- [x] Legenda rapat mengikuti gambar; permukaan kartu aktif berizin menuju form Check-in, sedangkan ID transaksi sendiri membuka detail tanpa propagasi. Kamar belum tersedia tetap terlihat di form tanpa mengizinkan penyimpanan.
- [x] Lima tes PASS; Kamar 06 membuka form dengan peringatan dan simpan nonaktif, memilih kamar tersedia menghapus peringatan, Kamar 09 terpilih otomatis, ID transaksi tetap terpisah; desktop/HP tanpa overflow dan build OK, tanpa perubahan data atau publish.
- [ ] Pengaturan → Manajemen Kamar: belum ada alur existing; laporkan untuk Codex tanpa membuat fungsi administratif baru.

## Kamar — referensi Owner 14 November
- [x] Susun kartu kompak hitam–putih hangat dengan plakat ranjang emas, lampu status nyata, lima kolom desktop dan legenda; fungsi serta halaman lain tetap.
- [x] Desktop 1326×900 dan HP 390×844 tanpa overflow; Ubah Kamar, Detail Transaksi dan Check-in terbuka/tertutup dengan akun aktif tanpa menyimpan data; build otomatis OK, tanpa publikasi.

## Detail Transaksi — susun ulang mengikuti referensi Owner 28 Oktober
- [x] Popup ditata jadi tiga kolom (kiri: Informasi Tamu, Detail Kamar & Paket, Jadwal & Status; tengah: Rincian Harga, Pembayaran, Riwayat Pembayaran; kanan: Informasi Tambahan + pita status) dengan kepala berisi logo, judul, REG nomor dan tombol tutup; lebar dibatasi 960px agar tidak terlalu besar.
- [x] Desktop 1440px dan HP 390px diperiksa dengan sesi Owner: tidak ada teks terpotong, popup HP dapat digulir penuh, tanpa kesalahan konsol; typecheck dan build OK; popup Housekeeping/Keuangan/Kamar, form, data dan aturan bisnis tidak diubah; tidak dipublikasikan.

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
