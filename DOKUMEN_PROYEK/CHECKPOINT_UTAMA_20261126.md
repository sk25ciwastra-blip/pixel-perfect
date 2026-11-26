# BATURADEN 25 HOMESTAY — CHECKPOINT UTAMA 26 NOVEMBER 2026

**Tanggal:** Kamis, 26 November 2026 (WIB)  
**Status:** checkpoint serah-terima lintas obrolan. **Bukan keputusan GO-LIVE, bukan bukti publish, dan bukan izin mengubah Cloud.**  
**Sumber prioritas:** persetujuan dan UAT Owner pada obrolan 25–26 November, PR GitHub ter-merge #167–#172, source `main`, serta checkpoint lama yang tetap berlaku sepanjang tidak digantikan keputusan lebih baru.  
**Repository:** https://github.com/sk25ciwastra-blip/pixel-perfect  
**Lovable project:** https://lovable.dev/projects/017f6e78-15f2-4d07-a38c-87cb185279bf

> **WAJIB BACA PADA OBROLAN BARU:** mulai dari [PANDUAN_MULAI_OBROLAN_BARU.md](PANDUAN_MULAI_OBROLAN_BARU.md), lalu dokumen ini. Jangan mengulang UAT yang sudah PASS. Jangan mencampur **kode MERGED**, **sinkron source Lovable**, **UAT browser**, **publish LIVE**, dan **sketsa UI**. Status masing-masing terpisah.

## 1. Posisi repository dan integrasi

- **Baseline kode aplikasi pada `main` sebelum commit dokumentasi ini:** merge [PR #172](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/172), commit `a3426fba11c3da7482311edf1df0c74c4d41e380` (26 November).
- **Lovable:** pembacaan metadata setelah PR #172 menunjukkan source Lovable pada commit yang sama; kode yang disinkronkan **tidak** membuktikan preview berhasil dibangun atau situs yang telah dipublish memakai versi baru. Saat pemeriksaan, Lovable melaporkan `needs_attention / out_of_credits`. Tidak ada publish baru yang diotorisasi dalam rangkaian perbaikan ini.
- **GitHub CI:** 16/16 workflow PASS sebelum merge untuk PR #169, #170, #171, dan #172 (PR #168 juga lulus CI). Ini bukti build/kontrak kode, **bukan** bukti seluruh alur browser dan Cloud.
- PR berikut tidak diperlakukan sebagai langkah yang masih perlu di-merge. **Semuanya MERGED**:

| PR | Lingkup yang benar-benar masuk source `main` | Bukti / batas |
| --- | --- | --- |
| [#167](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/167) | Satu pintu permintaan Reservasi dan antrean menunggu pembayaran; TRX baru setelah verifikasi resmi; kartu QRIS JPG | Implementasi; pembayaran/konversi LIVE belum dibuktikan dengan UAT baru |
| [#168](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/168) | Uji jalur `wa.me` dengan nomor dan caption | Jalur redirect sempat menghasilkan `ERR_BLOCKED_BY_RESPONSE` di Edge |
| [#169](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/169) | WhatsApp Web nomor-tujuan tanpa caption panjang dan fallback salin nomor/caption | Link minimal dibuka langsung berhasil, **tombol Lovable masih membuka WhatsApp tanpa otomatis membuka chat tujuan** |
| [#170](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/170) | Preview template ACTIVE Penawaran Reservasi, Salin Pesan/Nomor/Link Chat, JPG dilampirkan manual | **UAT Owner: template muncul & Salin Pesan berfungsi = PASS** |
| [#171](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/171) | Booking: kolom Check-in dan Check-out menggunakan track desktop tetap, sejajar | CI PASS; screenshot pemeriksaan akhir desktop belum dicatat PASS |
| [#172](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/172) | Booking: hilangkan spacer di atas status, pusatkan badge status + durasi secara vertikal | CI PASS; **UAT visual pasca-merge belum dikonfirmasi PASS** |

**Jangan membuka PR baru untuk sesuatu yang sudah masuk PR #167–#172 atau mengulang suite yang sudah PASS** tanpa temuan/regresi baru.

## 2. Aturan operasional yang berlaku (reservasi satu pintu)

Dokumen detail: [ALUR_RESERVASI_SATU_PINTU_20261125.md](ALUR_RESERVASI_SATU_PINTU_20261125.md).

1. Aksi Cepat Dashboard: **CHECK-IN, RESERVASI, EXPENSE**; bukan pintu PENAWARAN terpisah.
2. Form Booking WhatsApp dari calon tamu diterima secara **manual**. Petugas memasukkan permintaan ke form **Reservasi**: identitas, nomor WA, kamar, paket, jadwal WIB, jumlah tamu, Weekday/Weekend, harga resmi.
3. **Minimum DP final 50%**, rupiah dibulatkan ke atas; aturan historis 40% di dokumen lama **bukan keputusan terkini**. Harga berasal dari harga resmi sistem, bukan angka contoh dalam screenshot. Tamu lebih dari 2 mengikuti biaya tambahan yang disetujui Owner (tamu ke-3 +Rp50.000, ke-4 +Rp100.000).
4. Saat permintaan disimpan, antrean **Menunggu Pembayaran** (`DRAFT` / `SENT`), kamar **belum dikunci**, **belum ada nomor TRX resmi**, dan kartu JPG/QRIS + rincian harga dapat diberikan secara manual.
5. Karyawan **mengunduh JPG** dan **menyalin template WA resmi** dari Detail Reservasi, membuka chat penerima dengan WA Desktop/Web lalu **menempel teks dan melampirkan foto sendiri**. Tombol membuka WhatsApp tidak otomatis mengirim; hanya tekan **Sudah Dikirim** setelah pengiriman benar-benar dilakukan.
6. **Telah Dibayar · Verifikasi** hanya membuka proses verifikasi pembayaran yang sah; petugas memeriksa nominal, metode, kewenangan dan sesi kas. **TRX baru diterbitkan** setelah pembayaran terverifikasi/Booking resmi berhasil atomik. Jangan membuat pembayaran uji baru tanpa izin.
7. Kamar yang didahului Booking resmi orang lain dapat menutup permintaan menjadi gagal karena bentrok; catatan riwayat tamu dan jejak audit tetap dipertahankan. Tidak boleh ada penguncian ganda.

**Empat template WhatsApp resmi tetap:** (1) Penawaran Reservasi, (2) Konfirmasi Booking, (3) Pengingat 30 menit sebelum waktu Booking, (4) Pengingat waktu habis + toleransi 15 menit sebelum charge overtime. Keempatnya **manual**, bukan pengiriman otomatis. Jangan menambah kebijakan overtime baru atau mengubah versi ACTIVE tanpa alur Owner.

Status pemeriksaan 26 Nov: di Lovable LIVE, template `PENAWARAN_RESERVASI` **ACTIVE versi 1** terdeteksi; Owner mengonfirmasi preview teks muncul dan tombol **Salin Pesan berfungsi**. Jangan mengklaim semua peran/tiga template lain sudah UAT PASS hanya berdasarkan ini.

## 3. Matriks UAT / fakta yang tidak boleh tertukar

| Pemeriksaan | Status tepat per 26 Nov | Catatan |
| --- | --- | --- |
| JPG kartu Reservasi: unduh | **PASS laporan Owner** | Karyawan mengunduh file; jangan klaim terkirim ke WhatsApp otomatis |
| Template WA Reservasi: tampil dan Salin Pesan | **PASS laporan Owner** | Uji nyata Detail Reservasi; tidak perlu diulang tanpa regresi |
| WhatsApp dari tombol Lovable langsung ke nomor | **BELUM PASS / kendala diketahui** | WhatsApp Desktop bisa terbuka tetapi tidak otomatis masuk chat tujuan; gunakan Salin Nomor, Salin Pesan dan lampiran manual. Link minimal dibuka terpisah pernah berhasil |
| QRIS di JPG dipindai memakai kamera HP + merchant resmi | **BELUM TERCATAT PASS** | Pemeriksaan kode/aset tidak sama dengan uji scan HP; jangan melakukan pembayaran |
| Konversi permintaan Reservasi menjadi Booking berbayar resmi di browser | **BELUM UAT baru** | Tidak buat TRX/pembayaran demi uji ini tanpa persetujuan |
| Booking kolom waktu/kolom status PR #171–#172 | **PASS CI / sinkron source, UAT visual akhir tertunda** | Lihat tanggal/kolom kamar 09, 10, 06 tanpa mengubah data |
| Finance Closing positif/negatif, Refund kecil, cancellation UAT terdahulu | **PASS historis menurut [NO9_WORK_UAT_FINANCE_20261123.md](NO9_WORK_UAT_FINANCE_20261123.md)** | Tidak diulang di checkpoint ini; status global UAT bukan otomatis 100% |
| Desain Daftar Transaksi / form Reservasi / Global Result Dialog terbaru | **SKETSA / BELUM IMPLEMENTASI** | Gambar dalam obrolan menjadi referensi visual; tidak sama dengan source Lovable |

**Release gate:** belum ada keputusan GO-LIVE baru. Data DEMO, cash session, Closing, refunds, audit, backup, rollback dan akses tetap mengikuti keputusan Owner dan dokumen terdahulu. Bukti backup terbaru/integritas historis tidak otomatis membuktikan restore penuh; lihat [POIN4_WHATSAPP_RELEASE_GATE_20261125.md](POIN4_WHATSAPP_RELEASE_GATE_20261125.md) dan addendumnya.

## 4. Spesifikasi visual terakhir — Daftar Transaksi (DESAIN, bukan source)

Owner meminta **sidebar dan header asli tetap**; revisi hanya isi halaman **Daftar Transaksi**. Referensi terakhir berupa sketsa iteratif 26 Nov (bukan implementasi). **Jangan mengubah logika finance, akses, query, atau pembayaran ketika mengerjakan desain.**

- Konsep **black–gold–warm white**, gaya luxury yang sama dengan aplikasi. Panel filter bulan, tahun, pencarian serta ringkasan bulan memakai **warm cream** dengan aksen emas, selaras dengan tabel di bawah. **Garis kotak merah hanya penanda revisi** pada screenshot, bukan elemen UI.
- Daftar per tanggal `created_at` WIB tetap ada; tabel cream ber-header gradient emas, baris rapat/rapi tanpa kartu hitam untuk tipe atau nomor kamar. Gunakan teks biasa untuk **Tipe Kamar** dan **No. Kamar**.
- **Susunan kolom visual terbaru, persis:** **No. → Tipe Kamar → No. Kamar → Nama Tamu → ID Transaksi → Check-in → Check-out → Nominal → Pembayaran → Status**.
- Kolom **Nama Tamu hanya nama tamu**, jangan gabungkan kode tambahan/suffix identitas atau nomor TRX. ID transaksi dipisah dan mempertahankan format resmi `BTRDTRX-…`. Nominal sesuai sumber keuangan, jangan memakai data/angka contoh dari sketsa sebagai fakta.
- Kolom **Pembayaran** menggambarkan **metode yang benar-benar tercatat**: Cash, QRIS, Transfer, atau gabungan seperti Cash + QRIS bila data/policy server mendukung. Jangan menyimpulkan metode dari gambar contoh atau mengaktifkan multi-method yang belum resmi.
- **Status di paling kanan** (contoh data uji dapat tampil SELESAI/DIBATALKAN; label aktual mengikuti data/status resmi). **Kolom dan ikon Aksi/WA/Print dihilangkan dari sketsa tabel.** *Sebelum mengimplementasikan*, audit dan pastikan tindakan yang sudah berizin (termasuk hapus demo, WhatsApp, print/detail) tidak hilang secara fungsional atau melemahkan hak akses; laporkan bila perlu keputusan Owner untuk lokasi baru tombol. Jangan menghapus handler/otorisasi secara diam-diam.
- Pagination dan angka transaksi harus berdasarkan data asli serta filter yang berlaku. Responsivitas tabel perlu diperiksa pada desktop dan mobile, tanpa mengubah sidebar/header.
- **Status:** keputusan arah visual/rancangan terbaru. **Belum ada PR implementasi dan belum ada UAT di browser** untuk tabel baru. Jangan menyebut desain ini sudah terlihat di Lovable LIVE.

## 5. Spesifikasi visual terakhir — Form Reservasi (DESAIN, bukan source)

- Gaya **persis keluarga Form Check-in + Form Pengeluaran**: font sans-serif, teks label dan heading, proporsi panel, input dan tombol konsisten; **tidak memakai font serif untuk judul**.
- Header hitam: label atas **OPERASIONAL / PERMINTAAN RESERVASI**; judul besar **RESERVASI**; indikator **Reservasi menunggu pembayaran**. Ikon tutup form biasa tetap boleh ada; larangan tombol X pada bagian 6 hanya untuk *ActionResultDialog*.
- Isi dua kolom warm white: **Identitas Tamu** (Nomor WhatsApp, Nama Tamu, Alamat, Jumlah Tamu) dan **Rincian Menginap** (Tipe Kamar, Nomor Kamar, Tanggal Check-in, Jam Check-in, Paket Menginap, Tarif serta Weekday/Weekend). Pertahankan form validasi dan pencarian tamu.
- Ringkasan horizontal: **Harga Kamar, Total Tagihan, Minimum DP (50%)**, berikut penyesuaian tamu tambahan bila berlaku. Tidak ada nominal yang di-hardcode.
- Pesan kebijakan: **menunggu verifikasi pembayaran, kamar belum terkunci, TRX belum diterbitkan**. Setelah simpan: lihat JPG + QRIS resmi, salin template WA, kirim manual.
- Footer konsisten: **Batal** dan **Simpan Reservasi & Lihat Kartu**. Tidak mengubah alur transaksi/server yang sudah dibuat di PR #167/#170.
- **Status:** sketsa revisi terakhir di obrolan 26 Nov; **belum dipindahkan ke source**. Source `formulir-pemesanan.tsx` masih memakai judul bagian `BATURADEN 25 HOMESTAY / PERMINTAAN RESERVASI` untuk kondisi reservasi, sehingga instruksi header baru memang belum diterapkan.

## 6. Komponen standar popup (DESAIN/USULAN — belum implementasi)

Nama lintas tim: **B25 — Global Action Result Dialog**; nama komponen kode yang direkomendasikan: **`ActionResultDialog`**.

- Satu komponen reusable **Success** dan **Error** untuk hasil tindakan yang sudah tereksekusi, dengan **teks berbeda sesuai aksi**: tambah rekening, ubah harga, tambah/edit karyawan, ubah password, simpan pengaturan, ubah data tamu, dan aksi lain yang relevan.
- Desain sesuai dua contoh sketsa Owner: **sukses hijau + warm cream/gold; gagal merah + warm cream/gold**, posisi pusat/overlay, konsisten dengan tema aplikasi. **Tidak ada tombol X di sudut atas**; ada tombol **Tutup** di bawah.
- Judul/kalimat hasil spesifik, bukan teks generik yang tidak menyebut aksi. Kesalahan harus jelas tetapi tidak menampilkan rincian teknis/PII.
- Hanya tampilkan berhasil setelah server/handler mengonfirmasi sukses. Error ditampilkan bila gagal. Hindari popup ganda. **Coba Lagi** hanya bila operasi aman/idempoten, tidak berisiko transaksi ganda.
- **Pengecualian wajib:** popup berhasil **Check-in** dan popup berhasil **Reservasi/Booking** yang sudah mempunyai alur bukti/struk. Dialog konfirmasi **sebelum** hapus, refund, pembatalan dan tindakan sensitif **bukan** ActionResultDialog dan tetap dilindungi.
- **Status:** konsep dan desain telah dibahas; **BELUM ADA implementasi global, PR, atau UAT**. Jangan memasang massal tanpa memetakan seluruh handler, role dan feedback agar tidak merusak alur operasional.

## 6A. ADDENDUM OWNER — 12 revisi desain Lovable aktif (26 November 2026)

**Sumber:** permintaan Owner dan koreksi lanjutan pada 26 November 2026. **Status 12 item aktif: BACKLOG DESAIN / BELUM DIKERJAKAN DALAM ADDENDUM INI.** Item asli `UI-26-01` (popup dan tombol Aksi Cepat Penawaran) **DICABUT ATAS KOREKSI OWNER** dan tidak lagi menjadi pekerjaan. ID lama tidak dipakai ulang agar riwayat konsisten. Urutan di bawah mengikuti urutan permintaan aktif Owner, **bukan prioritas teknis atau persetujuan publish**.

| ID | Revisi desain yang akan dikerjakan di Lovable | Batas pekerjaan / catatan agar tidak salah alur | Status |
| --- | --- | --- | --- |
| UI-26-02 | **Popup berhasil atau gagal di semua fitur** | Gunakan acuan **B25 Global Action Result Dialog / `ActionResultDialog`** yang dibahas pada §6: dua varian Success dan Error, teks dinamis per aksi, **tanpa tombol X di atas**, tombol Tutup di bawah. **Kecualikan popup berhasil Check-in dan Reservasi/Booking**; jangan mengganti konfirmasi sebelum aksi destruktif. | BELUM REVISI |
| UI-26-03 | **Rapikan susunan histori Booking** | Rapikan komposisi/posisi visual Riwayat Booking; **jangan mengulang** perbaikan kode kolom Check-in/Check-out PR #171 dan pusat status PR #172 tanpa temuan baru. Pertahankan pengelompokan, data, status, dan fungsi Booking. | BELUM REVISI |
| UI-26-04 | **Rapikan grafik pada Dashboard** | Revisi tampilan/penataan grafik, bukan rumus, data pendapatan, atau sumber hitungan; pertahankan widget operasional yang tidak sedang direvisi. | BELUM REVISI |
| UI-26-05 | **Ubah warna tabel pada fitur Transaksi** | Ikuti tema **black–gold–warm white** dan arah desain tabel Transaksi yang sudah tercatat di §4. Sidebar/header tetap, data dan status transaksi tetap mengikuti backend. | BELUM REVISI |
| UI-26-06 | **Hilangkan agenda pada Dashboard status kamar dan tampilkan kamar sampai bawah panel** | Ubah komposisi visual panel Dashboard sehingga daftar/status kamar memakai ruang vertikal yang sebelumnya dipakai agenda. Jangan menghapus data atau merusak operasi/tombol kamar; periksa dampak responsif. | BELUM REVISI |
| UI-26-07 | **Tampilan Pengaturan semua fungsi** | Perapian visual area Pengaturan dan seluruh subfungsinya, bertahap per layar. Jangan mengubah hak Owner/staf, pricing, rekening, penyimpanan, atau logika perubahan nilai. | BELUM REVISI |
| UI-26-08 | **Tampilan Bantu Sesi Aktif** | Revisi tampilan fitur Bantu Sesi Aktif. Pertahankan aturan Owner/Supervisor, sesi kas aktif, identitas operator, dan audit yang sudah disetujui. | BELUM REVISI |
| UI-26-09 | **Popup Logout** | Revisi visual dialog/logout; pertahankan fungsi keluar akun dan perilaku sesi keamanan yang sudah berjalan. | BELUM REVISI |
| UI-26-10 | **Kartu Reservasi** | Revisi **desain visual** kartu Reservasi; fitur pembuatan/unduh JPG dan template WA yang sudah PASS **tetap PASS**, QRIS harus resmi, bukan dibuat ulang, dan foto tetap dilampirkan manual. | BELUM REVISI |
| UI-26-11 | **Popup ketika ingin menghapus** | Revisi **dialog konfirmasi sebelum penghapusan**, **bukan** popup hasil Success/Error. Tetap wajib mematuhi izin, pengecekan identitas/ID, proteksi transaksi & data historis, dan audit. | BELUM REVISI |
| UI-26-12 | **Popup Check-out Dashboard** | Revisi UI popup Check-out yang dipanggil dari Dashboard; jangan melemahkan pemeriksaan pembayaran/settlement, izin role, transisi Housekeeping, audit, atau fungsi server. | BELUM REVISI |
| UI-26-13 | **Form Reservasi** | Ikuti §5: font/gaya **sama seperti form Check-in & Pengeluaran**, header **OPERASIONAL / PERMINTAAN RESERVASI**, dua panel identitas/rincian, ringkasan DP minimum 50%, footer **Simpan Reservasi & Lihat Kartu**. Alur tetap Reservasi menunggu pembayaran, belum TRX/kamar terkunci. | BELUM REVISI |

**Aturan pengerjaan:**
1. Ini adalah **daftar 12 tugas desain aktif di Lovable**, **bukan** persetujuan untuk mengubah backend, SQL Cloud, uang, data UAT, akses, atau publish. Tidak ada dari 12 item aktif dinyatakan PASS, MERGED, atau selesai hanya karena tercatat di sini.
2. Kerjakan satu item per iterasi, gunakan screenshot dan persetujuan visual Owner yang benar, lalu tandai status secara faktual: **BELUM REVISI → SKETSA / OWNER REVIEW → IMPLEMENTASI → UAT VISUAL PASS**. Bukti sinkron GitHub ≠ publish ≠ UAT.
3. Item yang sudah memiliki rancangan (§4–§6) **tidak dianggap implementasi**. Contoh: tabel Transaksi, Form Reservasi, dan `ActionResultDialog`.
4. Setelah item dikerjakan di Lovable, simpan **file/PR/commit, lingkup perubahan, hasil tes dan UAT, status publish** ke checkpoint ini agar obrolan selanjutnya tidak memulai ulang. Jangan otomatis memindahkan status item lain.
5. Fitur yang berhubungan dengan finance, refund, logout, penghapusan, Check-out dan Reservasi **tidak boleh berubah perilaku** hanya karena revisi tampilan.

---

### Koreksi UI-26-06 — Panel kamar ketika daftar berisi (26 November 2026)

**Owner masih melaporkan area yang disebut "Agenda" pada panel Status Kamar setelah PR #186.** Foto terbaru yang tersedia dalam percakapan adalah kartu Target Omzet, bukan screenshot baru Status Kamar; **belum dapat dipastikan ada widget Agenda terpisah yang benar-benar dirender.** Pemeriksaan source menunjukkan **tidak ada label/komponen Agenda dalam `src/`**. Jangan menebak nama komponen atau menghapus pengingat operasional.

Temuan source terverifikasi: PR #186 hanya memperpanjang **empty state**. Jalur **daftar berisi** masih memakai `max-h-[400px]` pada pembungkus tabel di `src/routes/index.tsx`, sehingga tidak mengisi ruang panel setinggi kartu di sebelahnya. Koreksi UI saat ini:
- `db-room-status-table` menjadi `flex-1` di panel yang sudah `flex-col`, menghapus cap kaku 400px dan tetap menjaga scroll untuk daftar panjang.
- Batas panjang viewport dipakai agar baris kamar banyak tidak memanjangkan halaman berlebihan; footer enam status tetap di bawah.
- Teks empty state PR #186, indikator, hitung status, pengingat booking/overtime, tombol WhatsApp/Check-out serta data transaksi **tidak disentuh**.
- Source/CI hanya dapat membuktikan kontrak layout; **tidak membuktikan widget Agenda benar-benar hilang dari build Owner.** Jika label atau elemen Agenda masih ada setelah versi UI terbaru dimuat, minta screenshot **yang memperlihatkan panel Status Kamar lengkap** agar bisa mengidentifikasi sumbernya. Jangan menutup UI-26-06 sebagai UAT visual PASS sampai bukti ada.

**Status:** koreksi kode/tabel dalam PR review, tidak ada publish Lovable, SQL Cloud, atau mutasi keuangan.

---

### Tambahan UI-26-06 — Dashboard Status Kamar (26 November 2026)

Berdasarkan screenshot Owner: saat daftar kamar terisi/booking kosong, kotak empty state terlalu pendek sementara ruang bawah panel masih luas. Owner menghendaki kotak memanjang hingga mendekati enam indikator bawah, dengan teks yang sesuai dan tanpa Agenda.

- Pemeriksaan **source GitHub main** menemukan **tidak ada lagi komponen/teks Agenda dalam src/**; jangan membuat penghapusan palsu atau memodifikasi fungsi lain.
- Pekerjaan layout dalam cabang review: `src/routes/index.tsx` + `src/components/dashboard-panel.css` memperbesar empty state menjadi `flex-1` dengan tinggi minimum responsif, dan memusatkan ikon, judul, deskripsi sebagai satu blok. Footer enam indikator serta popup overtime, tombol WhatsApp/Check-out dan status real-time **tidak diubah**.
- Naskah saat semua status kosong: **"Belum ada kamar yang perlu dipantau saat ini"** dengan keterangan enam status real-time. Bila ada kamar `dirty/cleaning` atau `needs_action` namun tidak ada stay/booking, pesan berubah menjadi **"Tidak ada kamar terisi atau booking hari ini"** agar tidak salah mengatakan tidak ada kamar untuk dipantau.
- Tes kontrak offline baru melindungi empty-state, indikator, link, dan handlers. **Belum UAT visual/publish**; status UI-26-06 belum dianggap selesai sepenuhnya sampai screenshot versi benar terverifikasi. Penghapusan Agenda tidak perlu dilakukan ulang karena tidak ada di source.
- Tidak ada perubahan SQL Cloud, transaksi, tarif, room operational rules, akses role, atau publish Lovable.

---

### Catatan audit Pengaturan → Template WhatsApp (26 November 2026)

- Review **READ-ONLY** pada LIVE membuktikan empat template resmi mempunyai versi `ACTIVE v1`: Penawaran Reservasi, Konfirmasi Booking, Pengingat Booking 30 Menit, dan Pengingat Waktu Habis. Keempatnya **tidak dihapus** karena jalur Reservasi, PDF konfirmasi dan pengingat manual memakainya.
- Jenis kompatibilitas lama `KONFIRMASI_PEMBAYARAN` **tidak punya versi ACTIVE LIVE** tetapi masih direferensikan dari pendamping PDF historis. Tetap tersembunyi dari empat pilihan resmi dan **belum dihapus** dari schema/validator sampai ketergantungan lama dievaluasi. Tidak ada migrasi data atau perubahan teks template.
- Perbaikan terbatas pada **[PR #176](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/176)**: informasi status aktif/versi, keterangan penggunaan manual, indikator memuat/error, hitung karakter, keamanan klik tab terpilih, dan umpan balik simpan ketika reload gagal; tes kontrak baru. **Jangan menganggap PR di-merge atau UAT PASS hanya berdasarkan catatan ini**; cek status PR dan source `main` terbaru.
- Item desain besar **UI-26-07 Pengaturan semua fungsi** tetap **BELUM SELESAI** sampai seluruh bagian direview; perbaikan subhalaman Template tidak otomatis menutup seluruh item.

---

### Koreksi Owner — pilihan Template WhatsApp (26 November 2026)

**Daftar template yang diminta Owner kini berbeda dari empat jenis yang tampil pada source hasil PR #176.** Revisi redaksi sudah ditulis dalam [Draf Empat Template WhatsApp](DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md), dengan empat pilihan yang diinginkan:
1. **Konfirmasi Reservasi** (ringkasan permintaan **sebelum pembayaran**, tanpa nomor TRX; bukan Booking resmi).
2. **Pengingat Booking** (30 menit sebelum Check-in).
3. **Pengingat Waktu Habis** (saat batas Check-out; toleransi 15 menit).
4. **Pemberitahuan Overtime** (setelah masa toleransi; minta tamu menghubungi admin untuk konfirmasi overtime Rp50.000/jam atau perpanjangan).

**Jangan menganggap implementasi selesai:** PR #176 yang sudah MERGED hanya menyempurnakan pilihan lama dan **belum mengganti label Penawaran Reservasi menjadi Konfirmasi Reservasi** maupun menyediakan jenis keempat Overtime. Versi ACTIVE LIVE tidak diubah pada revisi redaksi ini. Template pra-pembayaran `PENAWARAN_RESERVASI` harus tetap dipakai Detail Reservasi; jangan hapus versi/servisnya. Jenis `KONFIRMASI_BOOKING` tetap berbeda untuk Booking resmi sesudah pembayaran, sedangkan `KONFIRMASI_PEMBAYARAN` masih memiliki pembaca historis. Jenis backend Overtime **belum ada** dan membutuhkan implementasi serta release gate terpisah.

**Status:** KEPUTUSAN KATEGORI OWNER TERCATAT; **TEKS BARU DRAF / BELUM ACTIVE / BELUM UAT**. Pengiriman tetap manual. Biaya Rp50.000/jam adalah isi pesan yang diminta Owner, **bukan perubahan otomatis pada tarif/charge keuangan**. Prioritas saat memperbaiki UI-26-07 adalah menghapus pilihan lama dari menu secara aman, menyiapkan opsi keempat hanya saat jalur benar-benar berfungsi, dan mempertahankan alur sebelum pembayaran yang sudah PASS.

---

### Koreksi Owner — Konfirmasi Reservasi sebelum pembayaran (26 November 2026)

**Keputusan Owner yang benar:** istilah **Konfirmasi Reservasi** pada empat pilihan Pengaturan adalah pesan *konfirmasi rincian permintaan reservasi* **SEBELUM pembayaran**, bukan Konfirmasi Booking berbayar. Format seperti penawaran lama: nama tamu, kamar, paket, jadwal Check-in/Check-out, harga kamar, biaya tambahan, total tagihan, **DP minimum 50% atau bayar lunas**, dan status **MENUNGGU PEMBAYARAN**. **Belum menerima uang, tidak boleh menampilkan TRX, dan kamar belum terkunci.** Pesan harus secara jelas mengatakan ini **bukan bukti Booking resmi**.

- [Teks koreksi Template 1](DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md#1-konfirmasi-reservasi--draf-revisi-owner-26-november-2026) disusun sesuai permintaan Owner. **DRAF / BELUM ACTIVE / BELUM DIIMPLEMENTASI.**
- **Pemetaan kode yang sesuai:** kind `PENAWARAN_RESERVASI` (nama internal kompatibilitas lama) tetap digunakan untuk rincian pra-pembayaran. Dalam Pengaturan, labelnya yang diubah menjadi **Konfirmasi Reservasi** ketika diimplementasikan. Token harga/DP sudah disediakan kind ini; jangan memakai `KONFIRMASI_BOOKING`, `DP_DITERIMA`, atau nominal pembayaran yang belum ada.
- `KONFIRMASI_BOOKING` tetap berguna untuk Booking resmi *setelah* pembayaran terverifikasi, tetapi **bukan** Template 1 pra-pembayaran yang dimaksud Owner. Jangan hapus fungsi/riwayatnya tanpa audit terpisah.
- Tiga template lainnya tidak diubah dalam koreksi ini. Tidak ada perubahan versi ACTIVE LIVE, SQL, pembayaran, atau publish; pembuatan notifikasi overtime tetap pekerjaan terpisah.
- **Catatan koreksi:** penafsiran sebelumnya yang menyebut pembayaran telah diterima atau Booking resmi terbit pada Template 1 adalah **SALAH dan DIBATALKAN oleh Owner**. Jangan mengulangi kekeliruan tersebut di obrolan baru.

---

### Pekerjaan implementasi empat Template WhatsApp — 26 November 2026

**Status historis ketika PR #179 disiapkan:** kode semula di branch / PR belum di-merge. **PEMBARUAN 26 NOV: PR #179 TELAH MERGED ke `main` (commit `be3eedd6f1437d65399e36bfca03731dba6685ac`), source Lovable tersinkron; 16/16 CI PASS.** **UAT browser / publish versi baru / aktivasi template baru belum PASS.** SQL overtime belum dijalankan dan template versi ACTIVE lama tetap terjaga.

- **Permintaan Owner:** tepat empat pilihan dalam **Pengaturan → Template WhatsApp**: (1) Konfirmasi Reservasi *sebelum pembayaran*, (2) Pengingat Booking 30 menit sebelum Check-in, (3) Pengingat Waktu Habis pada batas Check-out dengan toleransi 15 menit, (4) Pemberitahuan Overtime setelah batas toleransi, mengarahkan tamu ke admin untuk konfirmasi Rp50.000/jam atau perpanjangan. Pengiriman tetap **manual**.
- **Jenis internal kompatibel:** pilihan Konfirmasi Reservasi tetap memakai `PENAWARAN_RESERVASI`, **tidak** memakai `KONFIRMASI_BOOKING`. Jenis Konfirmasi Booking dan Konfirmasi Pembayaran historis tetap disimpan dalam kode/database, tetapi tidak tampil sebagai pilihan utama di Pengaturan.
- **Draf teks Konfirmasi Reservasi yang benar** disiapkan sebagai pilihan **Gunakan Draf Revisi (Belum Disimpan)**. Tidak mengubah isi ACTIVE v1 secara diam-diam. Belum ada TRX, belum pembayaran diterima, kamar belum terkunci. Lihat [DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md](DRAF_4_TEMPLATE_WHATSAPP_OWNER_20261126.md).
- **Pemberitahuan Overtime** adalah jenis baru `PEMBERITAHUAN_OVERTIME`. Hanya pratinjau dan **MENUNGGU BACKEND** pada Cloud yang belum mendukung; penyimpanan dinonaktifkan jika RPC tidak menerima jenis tersebut. Pengingat di Dashboard hanya ditampilkan jika RPC membaca versi **ACTIVE** yang berizin. Fungsinya *pemberitahuan manual*, bukan kalkulasi otomatis atau mutasi finance.
- **SQL PENDING** `supabase/pending/20261126_whatsapp_overtime_notice_kind.sql` dibuat untuk migrasi additive jenis dan RPC yang diperlukan, tetapi **TIDAK DIEKSEKUSI KE CLOUD**. Membutuhkan audit baseline/role, rollback, dan izin Owner terpisah. Tidak ada data dihapus atau di-seed.
- **QA gate berikutnya:** TypeScript/build, tes kind/placeholder, role + batas waktu 15 menit, perizinan Owner vs Receptionist/HK/Training, dan status LIVE setelah Lovable publish. PR merge/publish/aktivasi Cloud adalah keputusan terpisah.
- **Jangan menutup UI-26-07** (Pengaturan semua fungsi) hanya karena subhalaman Template telah diperbarui.

---

### Audit READ-ONLY setelah PR #179 MERGED — 26 November 2026

**Bukti langsung:** GitHub merge `be3eedd6f1437d65399e36bfca03731dba6685ac` berada pada source Lovable; project Lovable berstatus `needs_attention / out_of_credits`. Pemeriksaan web pada URL preview Pengaturan Template gagal diakses, sehingga **UAT VISUAL BELUM TERBUKTI** dan flag `is_published=true` **tidak** berarti commit baru dipublish.

| Pemeriksaan | Status faktual |
| --- | --- |
| Source empat tab di `src/routes/pengaturan-template-whatsapp.tsx` | **PASS verifikasi kode**: Konfirmasi Reservasi (jenis internal `PENAWARAN_RESERVASI`), Pengingat Booking, Pengingat Waktu Habis, Pemberitahuan Overtime |
| GitHub PR #179 | **MERGED, 16/16 CI PASS**; bukan hasil UAT visual |
| GitHub `main` → source Lovable | **SYNC PASS** pada `be3eedd`; build/publish versi terbaru belum terverifikasi |
| Versi LIVE `ACTIVE` | Empat jenis lama `PENAWARAN_RESERVASI`, `KONFIRMASI_BOOKING`, `PENGINGAT_BOOKING_30_MENIT`, `PENGINGAT_WAKTU_HABIS` masing-masing **v1** |
| Overtime kind di constraint database LIVE | **BELUM ADA** (`PEMBERITAHUAN_OVERTIME` ditolak oleh constraint lama); Cloud SQL belum diubah |
| Overtime RPC | Fungsi read/save reminder masih whitelist **dua** jenis lama; opsi Overtime di UI sengaja **MENUNGGU BACKEND**, tidak dapat simpan atau kirim |
| Draf Konfirmasi Reservasi baru | Disediakan dalam kode tetapi **belum ACTIVE**. Owner harus meninjau dan memilih **Gunakan Draf Revisi (Belum Disimpan)** sebelum menyimpan versi melalui RPC resmi |
| Browser Owner/Receptionist | **BELUM UAT**: tidak ada akses login interaktif dari pemeriksaan ini; jangan klaim sudah tampil di LIVE |
| Biaya/pembayaran/publish | **TIDAK DIUBAH**; Rp50.000/jam tetap hanya naskah pemberitahuan yang akan dikonfirmasi admin |

**Gate tindakan berikutnya:** akses browser Owner untuk UAT *tanpa membuat transaksi*, atau tinjau kesiapan migrasi Overtime **read-only**, rollback, dan kontrol hak akses. **Jangan jalankan SQL pending atau aktifkan template Overtime tanpa izin Owner terpisah.** Template Konfirmasi Reservasi tidak boleh menyatakan pembayaran diterima/Booking resmi.

---

### Audit lanjutan SQL Cloud dan rollback Overtime — 26 November 2026

**Bukti read-only LIVE:** `whatsapp_template_versions` dan `whatsapp_template_audit` RLS aktif; `anon` tak dapat SELECT; `authenticated` tak memiliki INSERT/UPDATE langsung; RPC menyimpan pengingat hanya Owner dengan riwayat audit, pembaca menegakkan Receptionist aktif/non-Training. Keempat jenis ACTIVE v1 terpelihara. Jenis `PEMBERITAHUAN_OVERTIME` belum ada pada constraint LIVE maupun whitelist RPC.

- **File pending yang ada:** `supabase/pending/20261126_whatsapp_overtime_notice_kind.sql`, **BELUM APPLY**.
- **Tambahan pekerjaan persiapan:** file rollback konservatif `supabase/pending/20261126_whatsapp_overtime_notice_rollback.sql` dan pengujian Postgres 17 sintetis untuk role, migrasi dan rollback. **Rollback menolak jika ada versi/audit Overtime**; tidak pernah menghapus sejarah untuk memaksanya. Lihat [Gate Overtime WhatsApp](POIN4_OVERTIME_WHATSAPP_RELEASE_GATE_20261126.md).
- **Status pengujian:** **PASS PostgreSQL 17 sintetis**, GitHub Actions run `45724403589`, job `139590467572`; log membuktikan migrasi, pembatasan role, rollback aman saat ada histori, dan rollback berhasil saat belum ada histori. Audit metadata dan tes sintetis **bukan UAT peran LIVE** atau bukti restore backup Cloud. PR pengaman ini tetap perlu diperiksa status merge-nya.
- **Gate:** Owner belum memberi persetujuan untuk menjalankan SQL Cloud, mengganti versi ACTIVE, atau publish. `NO-GO CLOUD` tetap berlaku sampai pengujian dan strategi pemulihan nyata tervalidasi.

---

### **GATE BACKUP TERBARU — NO-GO SQL OVERTIME (26 November 2026)**

**Audit READ-ONLY baru** membandingkan **backup asli ZIP privat 25 Nov** dengan inventaris tabel LIVE terkini. Backup utuh/checksum cocok tetapi hanya berisi **45 tabel `public`**, sementara LIVE saat ini mempunyai **51 tabel**. Enam tabel **tidak ada di backup**: `b25_homestay_profile`, `b25_homestay_profile_audit`, `reservation_offers`, `reservation_offer_events`, `whatsapp_template_versions`, `whatsapp_template_audit`. Nama 45 tabel lama tetap cocok; **belum ada bukti kecocokan isi/ACL/restore**.

Supabase **Staging** terhubung saat audit hanya mempunyai **33 tabel**, lebih sedikit **18 tabel dari LIVE**; **JANGAN** gunakan sebagai tempat uji restore backup LIVE atau mengira skema setara. Bucket backup LIVE yang dapat diinventarisasi hanya menunjukkan ekspor terakhir bertanggal **25 Nov**. PostgreSQL 18/pg_restore belum tersedia di runtime ChatGPT. Runner Windows privat PG18 yang tersedia di Library dipatok ke backup 25 Nov sehingga **tidak boleh dipakai mentah untuk backup baru**.

**Keputusan:** **NO-GO APPLY Cloud SQL Overtime** hingga tersedia **backup LIVE baru** yang mencakup 51 tabel, bukti `pg_restore --list` dan restore dalam PostgreSQL lokal **terisolasi**, pemeriksaan parity RLS/ACL/Auth/Storage, lalu izin Owner khusus SQL. Tes sintetis PR #181 **tetap PASS**, jangan diulang; tidak menggantikan gate LIVE ini. **Tidak ada backup dikirim ke GitHub/CI, dan tidak ada database LIVE maupun Staging yang diubah.** Detail di [Release Gate Overtime](POIN4_OVERTIME_WHATSAPP_RELEASE_GATE_20261126.md#addendum-read-only--backup-25-november-belum-mencakup-skema-live-26-november).

---

### Persiapan runner restore privat untuk backup LIVE terbaru — 26 November 2026

**Bukti terbaru dari READ-ONLY:** 51 tabel publik LIVE, 123 fungsi, 51 tabel RLS, 63 kebijakan, 134 indeks, 55 trigger, 95 foreign key. Metadata saja tersimpan di [snapshot katalog](B25_LIVE_CATALOG_SNAPSHOT_20261126.json), **bukan** data tamu atau dump. Backup 25 November berisi 45 tabel; enam tambahan belum dicakup. Tidak ada ekspor LIVE baru sesudah 25 Nov yang dapat diakses melalui connector.

- **File alat baru dalam branch/PR review:** `scripts/b25_restore_private_windows_pg18.py`, dapat menerima nama ZIP/cek SHA baru; hanya restore ke cluster Windows PostgreSQL 18 sementara `127.0.0.1` dan dapat memeriksa TOC/nama tabel dahulu.
- **Panduan tindakan privat:** [PANDUAN_RESTORE_PRIVAT_PG18_BACKUP_TERBARU_20261126.md](PANDUAN_RESTORE_PRIVAT_PG18_BACKUP_TERBARU_20261126.md), menjelaskan `inspect` sebelum `restore`, hash ZIP independen, pembatasan no-ACL/no-owner, dan larangan memakai Staging/LIVE.
- **Tes kontrak runner:** **9/9 PASS** dari log GitHub Actions [run #45753838684](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45753838684), termasuk manifest LIVE metadata 51 tabel dan enam tabel baru, parsing TOC, ZIP, checksum, pencegahan path traversal, dan sanitasi environment koneksi. **Tidak ada dump privat yang diproses dalam CI. Ini BUKAN full restore LIVE**; arsip baru tetap harus dipulihkan secara lokal oleh pemegang akses.
- **Release gate masih:** **NO-GO SQL CLOUD OVERTIME**, backup segar mencakup seluruh skema terkini + uji restore terisolasi + audit role/ACL/Auth/Storage + persetujuan Owner Cloud khusus. Jangan mengulang tes Postgres sintetis PR #181 yang sudah PASS.

---

### UI Dashboard Target Omzet — 3 tingkatan pencapaian (Owner, 26 November 2026)

**Keputusan Owner:** tombol `Atur target` membuka **popup kecil**, bukan form melebar dalam kartu. Isi terdiri dari **(1) Realisasi** omzet dari sistem (baca saja), **(2) Standard Operasional** target minimum bulanan, **(3) Target Bonus** target omzet bulanan yang lebih tinggi. Angka Rp40.000.000 dan Rp70.000.000 adalah **contoh batas** saat diskusi, **bukan target yang otomatis disetel**.

- **Merah:** realisasi di bawah Standard; **Hijau:** mencapai Standard tetapi belum Bonus; **Biru:** mencapai atau melewati Bonus. Warna **satu kesatuan**, bukan gradien tiga warna; kemajuan cincin dihitung terhadap Bonus dan dibatasi 100% secara visual.
- Dua input target hanya disimpan bila rupiah bulat positif dan **Bonus > Standard**; realisasi tidak bisa diedit dari popup. Dialog memiliki Batal, Simpan Target, pemberitahuan validasi/gagal simpan, dan tidak melakukan pembayaran bonus otomatis.
- **Batasan persistence saat ini:** fitur target lama sudah memakai `localStorage` **per browser**, belum tersinkron ke akun/LIVE Cloud. Versi baru mempertahankan sifat lokal itu; satu nilai target historis **dipertahankan sebagai referensi untuk ditinjau**, tidak dianggap kedua batas disetujui sampai Owner menyimpan dua target baru. Target yang sudah disetujui disimpan dalam key browser baru, sedangkan key lama **tidak dihapus**.
- **Sumber realisasi tidak diubah:** tetap dihitung dari baris pembayaran bulan berjalan seperti sebelum revisi UI. Tidak ada perubahan schema, finance calculation, tarif, bonus karyawan, RLS, atau publish.
- **Status:** perubahan kode dan tes dalam PR review khusus; **belum UAT visual**, belum dinyatakan sudah tampil di LIVE, dan **tidak ada angka default Rp40 juta/Rp70 juta**.

---

## 7. Pekerjaan berikutnya (tanpa mengulang PASS)

1. **Checkpoint utama dan panduan obrolan sudah masuk `main` melalui PR #173; lanjutkan pemeliharaan addendum §6A (12 revisi desain Lovable aktif; item UI-26-01 dicabut Owner) dan jangan menyebutnya sudah selesai sebelum ada bukti implementasi/UAT.**, jadikan satu pintu pembukaan obrolan baru; ubah status hanya berdasarkan bukti yang ada.
2. Tahap berikutnya fokus **desain** yang diminta Owner: mulai form Reservasi atau Daftar Transaksi berdasarkan pilihan pekerjaan saat sesi baru; **pilih satu layar per iterasi**, jaga handler/perizinan.
3. Jika implementasi desain dimulai, buat branch/PR khusus, review diff terfokus, test TypeScript/build/kontrak baru, lalu minta approval untuk **merge**; publish Lovable dan perubahan Cloud tetap meminta otorisasi terpisah.
4. UAT desain baru harus dilakukan di browser Owner/Receptionist pada versi yang benar; jangan menyebut CI atau sinkronisasi source sebagai PASS visual.
5. QRIS scan dengan HP, tombol WhatsApp langsung ke nomor, dan konversi Reservasi resmi adalah **gate terpisah**. Jika tombol WA tetap membuka Desktop tanpa chat tujuan, gunakan alur manual yang sudah terbukti, jangan kembali ke percobaan URL panjang.
6. Tidak ada pembersihan data UAT, SQL migration, reset, perubahan feature flag, pembayaran baru, atau publish tanpa izin Owner yang spesifik.

## 8. Hierarki dokumen dan batas pembacaan

- [Panduan obrolan baru](PANDUAN_MULAI_OBROLAN_BARU.md) → **dokumen ini** → [Alur Reservasi Satu Pintu](ALUR_RESERVASI_SATU_PINTU_20261125.md) → [Aturan Bisnis](02_ATURAN_BISNIS.md) → [Status Fitur](03_STATUS_FITUR.md) → [Riwayat Perubahan](04_RIWAYAT_PERUBAHAN.md) → dokumen UAT/gate khusus sesuai modul.
- Informasi lama dalam Buku Induk/Status Fitur/Riwayat yang diberi tanggal Oktober/12 Nov adalah **riwayat**, bukan pembatal status baru 26 Nov. Revisi lebih baru wajib ditulis sebagai addendum yang jelas, bukan diam-diam menghapus sejarah.
- **Acuan final adalah perubahan yang benar-benar terbukti:** keputusan Owner ≠ PR MERGED ≠ Lovable source sync ≠ build preview ≠ publish LIVE ≠ UAT nyata.

**Checkpoint selesai hanya setelah file ini dan panduan ada di GitHub `main`.** Jangan mengeklaimnya selesai ketika masih sebatas branch atau PR draft.

---

### Addendum UAT Status Kamar dan UI-26-02 — 26 November 2026 (Owner)

**UI-26-06 (Dashboard → Status Kamar):** Owner mengirim screenshot pukul 13:44 WIB yang memperlihatkan empty-state memanjang sampai footer, tanpa elemen Agenda, dengan enam indikator status terlihat dan panel Transaksi Terbaru tetap rapi. **PASS UAT visual hanya untuk kondisi daftar kosong.** PR #186 memperbaiki empty-state; [PR #190](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/190), merge `bc9e086f1c745d1702533c9d782b0135423402c0`, melanjutkan pengisian tinggi untuk daftar *berisi*. **Belum UAT visual ketika ada kamar terisi/Booking;** jangan membuat pembayaran atau transaksi baru untuk simulasi.

**UI-26-02 (popup Berhasil/Gagal):** Owner menyetujui merge tahap pertama pada obrolan 26 November. [PR #191](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/191) telah **MERGED** ke `main` pada commit `23d700b2afea9d78c4056d4811c6c35ca900d8fb`. Komponen reusable `src/components/action-result-dialog.tsx` dengan hasil hijau/merah, tema warm cream-gold, tombol **Tutup** tanpa X, terintegrasi **hanya** dengan aksi tambah/ubah/aktif/nonaktif pada Pengaturan → Rekening Owner. RPC, otorisasi Owner, bank account data, dan backend tidak diubah. Guard hanya melaporkan sukses sesudah penulisan RPC dan pembacaan ulang daftar berhasil; hasil meragukan tidak dinyatakan sukses.

**Bukti pengujian:** workflow GitHub Actions `B25 UI26-02 Action Result Dialog Review` dan `B25 Owner Settings Separate Finance and Payments` pada head PR #191 selesai **SUCCESS**, mencakup tes source, build, dan TypeScript. Ini **BUKAN UAT visual**.

**Lovable:** source setelah merge terverifikasi tersinkron ke `23d700b`, tetapi proyek masih `needs_attention / out_of_credits`. Status `is_published=true` tidak membuktikan kode baru sudah tersedia di LIVE; **tidak ada deploy/publish oleh pekerjaan ini**. **UI-26-02 status PARTIAL — code merged / UAT visual belum PASS; penerapan ke fitur lain tetap bertahap.** Popup hasil Check-in/Booking/Reservasi dan konfirmasi hapus/refund tidak diubah.

**Gate tetap berlaku:** NO-GO SQL Cloud Overtime karena backup/restore, tidak ada perubahan tarif, transaksi, data rekening LIVE, feature flags, role, atau aktivasi template tanpa persetujuan spesifik. 


---

### Addendum UI-26-02 tahap 2 — Profil Homestay, PR #192 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** pada percakapan Owner menyetujui secara eksplisit merge [PR #192](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/192) ke GitHub `main`. Merge **berhasil** (squash) dengan commit `a30c8311c33d386cb06cf5ed3fdf515727202d68`. Lingkup hanya integrasi `ActionResultDialog` pada `src/routes/pengaturan-profil-homestay.tsx`, kontrak uji `scripts/ui-26-02-profile-result.test.cjs`, dan update workflow `.github/workflows/b25-ui26-action-result-review.yml`. Komponen popup reusable dari PR #191 **tidak diubah**.

- **Pesan berhasil:** sesudah `b25_save_homestay_profile` berhasil dan `b25_read_homestay_profile` mengembalikan profil terbaru. Hasil yang belum pasti tidak dilaporkan sebagai sukses; tidak menyarankan pengulangan penulisan sembarangan.
- **Fungsi/role:** Owner saja; validasi nama, alamat, nomor, nama RPC dan pembacaan profil tetap. Toast sukses dan notice inline duplikat pada Profil Homestay diganti dengan satu dialog hasil.
- **Bukti kode/CI:** head PR `bc1e9ab075c0a094565c4cd28ee3027a2f8195b9` memiliki **16/16 workflow SUCCESS**, termasuk UI26-02 source guards, whole-app build/TypeScript dan regressi profil.
- **Lovable source:** tersinkron ke commit merge `a30c831` saat pemeriksaan. Namun status tetap `needs_attention / out_of_credits`; *source sync* bukan bukti preview/publish. Tidak dilakukan deploy/publish.
- **UAT visual & status:** **BELUM UAT visual** Profil Homestay dan Rekening Owner menggunakan versi baru. UI-26-02 **PARTIAL (dua halaman telah MERGED)**, bukan seluruh aplikasi. UAT berikutnya lakukan di preview yang benar tanpa mengganti data profil/rekening LIVE untuk tes. Konfirmasi sebelum hapus/refund, serta popup Check-in/Booking/Reservasi tetap tidak tersentuh.
- **Batas mutasi:** tidak ada SQL Cloud, keuangan, tarif, data profil asli, ataupun migrasi/feature flags. Gate backup/restore dan keputusan NO-GO SQL Overtime tetap.

**Tindak lanjut:** setelah preview dapat dibangun, verifikasi modal kedua halaman (sukses/gagal/close/role) secara aman; kemudian pilih satu subfitur Pengaturan lain untuk penerapan bertahap setelah meninjau handler, tanpa mengulang tes PASS.


---

### Addendum UAT Visual Popup Rekening Owner — 26 Nov 2026 14:06 WIB

Owner mengirim bukti screenshot **Pengaturan → Rekening Owner** dengan popup **“Rekening berhasil ditambahkan”**. **PASS visual hanya untuk varian hasil sukses tambah rekening**: panel terpusat warna warm cream-gold, overlay gelap, ikon sukses hijau, judul dan teks sesuai tindakan, tombol **Tutup** di bawah, tanpa tombol X. Bukti dicatat pada komentar UAT [PR #191](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/191).

**Belum diverifikasi dari screenshot:** hasil gagal, tindakan ubah/aktifkan/nonaktifkan rekening, tombol Tutup dapat digunakan, persistensi data sesudah reload, izin peran, versi commit build yang dilihat Owner, serta popup Profil Homestay PR #192. Jangan menyebut seluruh UI-26-02 telah UAT PASS hanya berdasarkan satu screenshot ini; status tetap **PARTIAL (kode dua halaman merged; visual sukses tambah rekening PASS)**. Tidak ada data rekening/PII disalin, tidak ada mutasi Cloud, transaksi, tarif, atau publish dalam pembaruan checkpoint.


---

### Addendum UI-26-02 tahap 3 — Manajemen Kamar, PR #193 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner secara eksplisit menyetujui merge PR #193 dalam percakapan 26 November 2026. [PR #193](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/193) **MERGED** ke GitHub `main`, squash commit `d75614d19fcd95389acd943fcbf665df4e487b84`.

**Lingkup kode:** `src/routes/pengaturan-manajemen-kamar.tsx` menggunakan komponen `ActionResultDialog` yang sudah dibuat di PR #191 untuk umpan balik hasil **Tambah Kamar, Ubah Kamar, Aktifkan, dan Nonaktifkan**, beserta penolakan validasi/pengaman. `scripts/ui-26-02-room-management-result.test.cjs` dan workflow `.github/workflows/b25-ui26-action-result-review.yml` diperbarui. Tidak ada perubahan nama/query write ke tabel rooms; aturan Owner, nomor/lantai, tipe kamar saat edit, dan pengaman kamar `occupied`, `check_in` atau `booking` aktif tetap dipertahankan. Pesan sukses hanya setelah write diakui dan daftar kamar berhasil di-refresh; kondisi tidak pasti meminta pemeriksaan dahulu.

**Bukti CI:** 17/17 GitHub Actions pada head PR `47c222cf598687c2a4959820d808239dc6a59085` berstatus **SUCCESS**, termasuk source contract UI26-02 (tahap 1–3), whole-app build, TypeScript, review manajemen kamar, dan pengaman paket. **Ini PASS kode/CI, bukan UAT browser.**

**Lovable:** sesudah merge, source terverifikasi sinkron pada `d75614d`, namun proyek masih `needs_attention / out_of_credits`. `is_published=true` bukan bukti versi merge telah dipublikasikan. Tidak ada publish/deploy dari pekerjaan ini.

**Status keseluruhan UI-26-02:** **PARTIAL**, implementasi kode di `main` untuk tiga subhalaman (Rekening Owner, Profil Homestay, Manajemen Kamar). **PASS UAT visual hanya popup sukses Tambah Rekening dari screenshot Owner sebelumnya.** UAT varian gagal, interaksi lain, Profil Homestay dan Manajemen Kamar masih belum dibuktikan. Jangan buat/edit/aktifkan/nonaktifkan kamar nyata, transaksi, atau mengubah pengaturan keuangan demi UAT tanpa persetujuan khusus.

**Batas:** Tidak ada perubahan SQL Cloud, finance, tarif, transaksi, rekening/profil/kamar LIVE, feature flags, role, atau publish. Gate NO-GO SQL Overtime/backup-restore tetap berlaku.

**Pekerjaan berikutnya:** cek popup tiga halaman pada preview/build yang benar saat tersedia; lanjut satu subfitur Pengaturan lain secara bertahap setelah audit handler dan guard, tanpa mengulang PASS.


---

### Addendum UI-26-02 tahap 4 — Minimum DP & Komisi, PR #194 MERGED (26 November 2026 WIB)

**Keputusan Owner:** Owner secara eksplisit menyetujui merge PR #194 pada obrolan 26 November 2026. [PR #194](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/194) berhasil **MERGED** (squash) ke `main`, commit `421a6d898f1ad800e5478c6a0d0770393db6476d`.

**Scope:** `src/routes/pengaturan-keuangan.tsx` menggunakan komponen `ActionResultDialog` dari PR #191 untuk tampilan hasil Simpan Konfigurasi **Minimum DP & Komisi**. `scripts/ui-26-02-finance-settings-result.test.cjs` menambah guard kontrak; `.github/workflows/b25-ui26-action-result-review.yml` diperluas. Dua RPC lama tetap `set_finance_settings` disusul `set_finance_commission_config`, tanpa mengubah nilainya, algoritme, urutan, hak akses Owner, komisi, atau tarif.

**Khusus hasil tidak atomik:** jika Minimum DP tersimpan namun Komisi gagal, tampilkan pesan jelas **“Konfigurasi tersimpan sebagian”**, bukan sukses penuh. Jika satu/both pembacaan ulang gagal, popup tidak mengklaim hasil sudah terverifikasi; Owner diminta memeriksa kembali sebelum mengulangi. Sukses hanya jika dua write tanpa error dan refresh kedua sumber tanpa error. Tidak ada retry otomatis, toast ganda, atau pesan backend mentah/PII.

**CI:** pada head `8914f533d5c6b395f177bf07af0de03457689376`, **17/17 workflow SUCCESS**, termasuk source contract UI26-02 tahap 1–4, whole-app build, TypeScript, dan review Owner Settings/finance. Ini **PASS kode/CI**, bukan UAT visual.

**Lovable:** source terverifikasi tersinkron pada `421a6d8` setelah merge, namun status proyek `needs_attention / out_of_credits`. Status `is_published=true` **bukan** bukti versi ini telah dipublish; tidak dilakukan publish/deploy.

**Status UI-26-02:** **PARTIAL** (kode sudah merged di empat halaman: Rekening Owner, Profil Homestay, Manajemen Kamar, Minimum DP & Komisi). Bukti PASS visual sebelumnya hanya untuk **popup sukses Tambah Rekening**; varian error, popup halaman lain, dan kemampuan tombol Tutup pada versi baru belum UAT. Tidak mengubah SQL Cloud, tarif, data minimum DP, komisi LIVE, pembayaran, transaksi, hak akses, ataupun menyalakan fitur baru. Gate backup/restore Overtime tetap **NO-GO**.

**Tindak lanjut:** UAT popup pada build yang tepat secara aman tanpa memodifikasi konfigurasi finance LIVE untuk pengujian; lanjut modul Pengaturan lain secara bertahap dengan audit handler terlebih dahulu.


---

### Addendum UAT Visual Minimum DP & Komisi — 26 Nov 2026 14:34 WIB

Owner mengirim screenshot hasil **Pengaturan → Minimum DP & Komisi** dengan pesan **“Minimum DP dan komisi berhasil disimpan”** (popup hijau). **PASS visual varian sukses**: panel cream-gold terpusat dengan overlay gelap, ikon centang hijau, judul dan deskripsi sesuai fungsi, tombol **Tutup** di bawah, tanpa tombol X. Bukti UAT juga tercatat pada komentar [PR #194](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/194).

**Batas bukti:** screenshot tidak membuktikan persistensi nilai pada reload, kondisi parsial DP berhasil/Komisi gagal, pesan error, tombol Tutup diklik, atau versi build/publish. Jangan mengubah pengaturan keuangan LIVE untuk mensimulasikan kegagalan. **UI-26-02 tetap PARTIAL**: kode empat halaman sudah MERGED; yang UAT visual PASS adalah popup sukses Tambah Rekening dan popup sukses Minimum DP & Komisi. Tidak ada perubahan SQL, finance, transaksi, data LIVE atau publish dalam pencatatan ini.

**Selanjutnya:** audit lalu perluas dialog ke satu halaman Pengaturan lain, menjaga aturan backend/empat template WA resmi dan tanpa aktivasi migrasi Overtime.


---

### Addendum UI-26-02 tahap 5 — Template WhatsApp, PR #195 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner menyetujui secara eksplisit merge [PR #195](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/195) pada percakapan 26 November 2026. PR **MERGED** ke GitHub `main` memakai squash commit `6d5ca78161dfe6942261ad3fbde51e6ec45a1613`.

**Lingkup perubahan kode:** `src/routes/pengaturan-template-whatsapp.tsx` memakai `ActionResultDialog` resmi untuk umpan balik penyimpanan Template WhatsApp; kontrak `scripts/ui-26-02-whatsapp-template-result.test.cjs` dan workflow `B25 UI26-02 Action Result Dialog Review` ditambahkan cakupannya. Toast berhasil/gagal lama di halaman tersebut diganti dengan dialog terpusat; komponen popup reusable dari PR #191 tidak berubah.

**Aturan tetap:** Empat tab resmi `Konfirmasi Reservasi`, `Pengingat Booking`, `Pengingat Waktu Habis`, `Pemberitahuan Overtime` tidak berubah. Kategori `PEMBERITAHUAN_OVERTIME` tetap **MENUNGGU BACKEND** bila capability RPC menolak. Tidak ada perubahan teks template, versi ACTIVE, validator, RPC, audit, aturan status reservasi sebelum pembayaran, pengiriman WhatsApp otomatis, ataupun charge overtime. Hasil **sukses** baru setelah RPC save diakui **dan** daftar versi berhasil dimuat ulang. Bila readback gagal atau hasil belum pasti, popup tidak mengklaim versi sudah terverifikasi dan meminta Owner memeriksa status sebelum mencoba ulang.

**Bukti CI:** head PR `eb4e12e3acbe60bca9c9487a83843cb05f72bbfc` memiliki **17/17 workflow SUCCESS**, termasuk `B25 UI26-02 Action Result Dialog Review` (kontrak tahap 1–5, build, TypeScript) dan `B25 WhatsApp Template Core Focused Gate`. **PASS kode/CI bukan UAT visual.**

**Lovable:** source tersinkron pada commit merge `6d5ca78`, tetapi proyek masih `needs_attention / out_of_credits`. `is_published=true` tidak membuktikan versi baru sudah tersedia pada situs LIVE. **Tidak ada publish/deploy oleh pekerjaan ini.**

**Status UI-26-02:** **PARTIAL** (implementasi kode di `main` untuk lima subfitur: Rekening Owner, Profil Homestay, Manajemen Kamar, Minimum DP & Komisi, Template WhatsApp). Bukti PASS visual yang telah disampaikan Owner hanyalah popup sukses **Tambah Rekening** dan popup sukses **Minimum DP & Komisi**; varian gagal/hasil parsial dan popup tiga subfitur lain belum UAT visual. Tidak ada perubahan SQL Cloud, data template atau pengaturan LIVE, finance, transaksi, tarif, hak akses, atau publish.

**Gate berikutnya:** Verifikasi popup lima subfitur pada build yang dapat dibuktikan tanpa memutasi template/finance/kamar LIVE hanya demi UAT. Pertahankan NO-GO migrasi Overtime hingga approval dan bukti backup/restore cukup.


---

### Addendum UI-26-02 tahap 6 — Pengumuman Owner, PR #196 MERGED (26 November 2026 WIB)

**Keputusan Owner:** Owner menyetujui secara eksplisit merge [PR #196](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/196) di percakapan pada 26 November 2026. Merge **berhasil** dengan squash commit `1955bb7075d7bc9280be64626a9600c6af0b8461`.

**Lingkup:** Pengumuman Owner `src/components/papan-informasi.tsx` menggunakan `ActionResultDialog` untuk **Tambah/Ubah/Hapus Pengumuman**. Hasil sukses mensyaratkan write ID dari Supabase lalu refresh yang membuktikan ID dan teks tersimpan, atau ID sudah hilang sesudah delete. Jika refresh gagal, stale, atau perubahan belum dapat diperiksa, popup secara eksplisit meminta verifikasi dan tidak mengklaim sukses. **Konfirmasi `window.confirm('Hapus pengumuman ini?')` sebelum DELETE tetap ada.** Tidak diubah aturan edit Owner, akses baca staf, batas karakter, atau rotasi.

**Inventaris:** dokumen baru `DOKUMEN_PROYEK/UI26_02_INVENTARIS_POPUP_20261126.md` membedakan hasil aksi, dialog konfirmasi sebelum tindakan, dan struk/receipt transaksi. Popup Booking, Check-in, refund, closing, Housekeeping, popup kamar terisi dan toast penyalinan WhatsApp **tidak diganti secara massal**. Tes kontrak `scripts/ui-26-02-announcement-result.test.cjs` dan workflow `B25 UI26-02 Action Result Dialog Review` telah diperluas.

**Bukti kode/CI:** pada head PR `dea918e3433b7e1ab8274b7cfb4d315f93b0670c`, seluruh **16/16 GitHub Actions SUCCESS** (termasuk tes UI26-02 tahap 1–6, whole-app build dan TypeScript). Ini **PASS kode/CI**, bukan bukti popup pengumuman sudah diuji di browser.

**Lovable:** source tersinkron dengan commit merge `1955bb7`, tetapi proyek masih `needs_attention / out_of_credits`. `is_published=true` tidak membuktikan versi terbaru sudah terpublikasi. **Tidak ada publish/deploy** dalam pekerjaan ini.

**Status UI-26-02: PARTIAL** — enam modul kode MERGED (Rekening Owner, Profil Homestay, Manajemen Kamar, Minimum DP & Komisi, Template WhatsApp, Kelola Pengumuman). Bukti UAT visual Owner **hanya** varian sukses Tambah Rekening dan varian sukses Minimum DP & Komisi. Varian gagal, hasil tidak pasti, popup pengumuman dan modul lain belum terverifikasi secara visual.

**Batas mutasi:** Tidak ada SQL Cloud, data Pengumuman nyata, pembayaran, transaksi, tarif, konfigurasi keuangan, Template ACTIVE, atau aktivasi Overtime. Gate backup/restore tetap **NO-GO**.

**Lanjutan:** setelah preview/build yang benar dapat diuji, lakukan UAT visual dan klik tombol Tutup tanpa memutasi data LIVE semata untuk pengujian. Jangan mengulang bukti PASS yang sudah ada.


---

### Addendum UI-26-02 tahap 7 — Browser Sintetis, PR #197 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner menyetujui merge PR #197 secara eksplisit dalam percakapan. [PR #197](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/197) telah **MERGED** (squash) ke GitHub `main` pada commit `910af9266031483227f1a39282858afc2d66506a`.

**Apa yang ditambahkan:** fasilitas UAT browser **sintetis** untuk komponen produksi `ActionResultDialog`. Halaman HTML QA, harness React dengan hasil dummy, server Vite lokal, skrip Chromium, workflow GitHub Actions, dan dokumentasi gate, seluruhnya **tanpa mengubah komponen popup operasional atau enam halaman aplikasi**. Pengujian tidak memakai autentikasi, SDK Cloud, pembayaran, transaksi, ataupun data nyata.

**Bukti pengujian:** head PR `19074713d8e5a52f8443c2d74636ad121b444c17` memiliki **15/15 workflow SUCCESS**, termasuk workflow `B25 UI26-02 Synthetic Browser UAT` run `45779087499`, job `139769866409`. Log Chromium menegaskan **PASS desktop 1280×800** dan **PASS mobile 375×812** untuk pembukaan dialog sukses/gagal, judul dan deskripsi, ikon hijau/merah, warm cream, satu tombol **Tutup**, penutupan lewat klik Tutup/Escape, dan batas lebar viewport. Browser memblokir permintaan nonlokal. Screenshot sintetis disimpan dalam artifact GitHub Actions `b25-ui26-synthetic-browser-evidence` ID `15097108049` (retensi tujuh hari).

**Makna PASS:** bukti **interaksi komponen di browser sintetis**, bukan UAT integrasi keenam halaman ataupun penyimpanan data pada akun Owner. Kasus gagal/parsial di RPC, persistensi sesudah reload, status publikasi dan identitas build LIVE **belum terverifikasi**. Jangan membuat transaksi, mengubah komisi/DP, menghapus pengumuman, atau mengaktifkan template hanya untuk menguji popup.

**Lovable:** source project tersinkron ke commit merge `910af92`, tetapi status proyek masih `needs_attention / out_of_credits`; `is_published=true` tidak berarti versi ini dipublikasikan. **Tidak dilakukan deploy/publish atau perubahan SQL Cloud**. Gate Overtime tetap NO-GO.

**Status UI-26-02:** **PARTIAL** — enam modul popup code MERGED + komponen browser sintetis PASS, sementara UAT LIVE tetap belum lengkap. Bukti screenshot Owner sebelumnya hanya PASS visual sukses Tambah Rekening dan sukses Minimum DP & Komisi. Tidak mengulang checkpoint PASS tersebut.


---

### Addendum UI-26-02 tahap 8 — Minimum DP & Komisi, PR #198 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner menyetujui secara eksplisit merge [PR #198](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/198). PR telah **MERGED** ke GitHub `main` menggunakan squash commit `fce136a5aed1a68f0264f7e8fc2d82b67510c716`.

**Lingkup:** logika umpan balik penyimpanan keuangan non-atomik dipisahkan ke fungsi `resolveFinanceSettingsOutcome` di `src/lib/finance-settings-outcome.ts` agar dapat diuji dengan callback lokal. Rute Owner `src/routes/pengaturan-keuangan.tsx` tetap memakai dua RPC asli `set_finance_settings` lalu `set_finance_commission_config` pada urutan lama, batas validasi, opsi komisi, pembatasan Owner dan satu dialog resmi. Tidak ada perubahan SQL Cloud, rumus, tarif, nilai Minimum DP/komisi, ataupun fungsi pembayaran.

**Bukti QA:** head PR `fffe9af80df10e7e46c0cc35ac3c26341d0017c9` **17/17 GitHub Actions SUCCESS**, termasuk build dan TypeScript. Tes `scripts/ui-26-02-finance-outcome-runtime.test.ts` menjalankan **8/8 skenario sintetis PASS** dengan stub: dua write & reread sukses, input DP tidak valid, RPC pertama gagal, DP diterima/Komisi gagal, hasil parsial+reread gagal, dua write diterima+reread gagal, exception tidak pasti, dan tidak ada retry otomatis. Kontrak source tetap memeriksa urutan kedua RPC serta guard. **Simulasi bukan bukti hasil RPC LIVE** dan tidak perlu membuat transaksi atau mengubah setting keuangan asli untuk UAT.

**Status Lovable:** source tersinkron pada commit merge `fce136a`; proyek masih `needs_attention / out_of_credits`. Nilai `is_published=true` tidak membuktikan bahwa versi tersebut sudah terpublikasi. **Tidak ada publish/deploy** dalam pekerjaan ini.

**Status keseluruhan UI-26-02:** **PARTIAL** — kode popup enam modul sudah merged, Chromium popup sintetis desktop/mobile PASS (PR #197), dan delapan jalur feedback keuangan tersimulasi PASS (PR #198). UAT integrasi di enam modul, persistensi setelah reload, penanganan gagal parsial secara nyata serta identitas build LIVE tetap belum dibuktikan. Bukti screenshot Owner yang sudah PASS visual untuk **sukses Tambah Rekening** dan **sukses Minimum DP & Komisi** tidak diulang.

**Gate tetap:** tidak ada mutasi SQL Cloud, dana/transaksi, nilai keuangan LIVE, kamar, Booking, Pengumuman asli atau Template ACTIVE; aktivasi Overtime tetap NO-GO sampai bukti backup/restore dan persetujuan khusus.


---

### Addendum UI-26-02 tahap 9 — Persistensi Minimum DP & Komisi, PR #199 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner menyetujui merge [PR #199](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/199) secara eksplisit (“ok gasss”). PR **MERGED** ke GitHub `main` melalui squash commit `d78d24bd13e95635176fadf47a1f5673ee7e66ed`.

**Temuan:** hasil sukses RPC dan refresh saja belum membuktikan nilai Minimum DP serta Komisi yang terbaca identik dengan konfigurasi yang diminta Owner. PR #199 menambahkan verifikasi baca ulang nilai sebelum popup hasil sukses penuh.

**Lingkup perubahan:** `src/lib/finance-settings-readback.ts` berisi pembanding pure mode dan nominal Minimum DP serta konfigurasi Komisi mode OFF/PERCENTAGE/PER_ROOM. `src/lib/finance-settings-outcome.ts` meminta `verifyPersisted` yang cocok setelah dua write diakui dan refresh berhasil sebelum menampilkan success. `src/routes/pengaturan-keuangan.tsx` melakukan query SELECT read-only untuk membandingkan nilai terakhir yang terbaca dengan snapshot formulir saat Simpan. Jika berbeda atau tidak terverifikasi, popup meminta pemeriksaan, bukan mengklaim sukses. **RPC penulisan `set_finance_settings` lalu `set_finance_commission_config`, role Owner, validasi, angka, dan aturan tarif/komisi tidak diubah**. Tidak ada retry otomatis.

**Bukti CI:** head PR `8fcb563641c61b5134d339676f79dbebd849a05f` memiliki **17/17 workflow SUCCESS** tanpa failure/pending, termasuk build dan TypeScript, **10/10 simulasi runtime** logika hasil serta **12/12 simulasi pembanding** nilai persisten. Bukti ini bersifat **pengujian sintetis**, bukan UAT penyimpanan database LIVE.

**Lovable:** source project terverifikasi sinkron dengan merge `d78d24b`, namun status masih `needs_attention / out_of_credits`. `is_published=true` tidak membuktikan commit terbaru tersedia di aplikasi publik. **Tidak ada publish/deploy oleh pekerjaan ini.**

**Status UI-26-02 tetap PARTIAL:** enam modul popup berada di `main`; uji komponen Chromium sintetis dan logika finance PASS. Bukti screenshot Owner yang sudah PASS visual hanya sukses Tambah Rekening serta sukses Minimum DP & Komisi. UAT integrasi ke LIVE, validasi data setelah reload dengan sumber nyata, versi publish, dan seluruh jalur gagal/parsial belum diselesaikan. Jangan mengulang PASS, membuat transaksi, memodifikasi DP/Komisi real, template, pengumuman atau SQL Cloud hanya untuk uji. Gate Overtime masih NO-GO.


---

### Addendum UI-26-02 tahap 10 — Profil Homestay PR #200 MERGED (26 November 2026 WIB)

**Keputusan Owner:** Owner secara eksplisit menyetujui merge PR #200 dalam percakapan (“ok boleh”). [PR #200](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/200) telah **MERGED** ke `main` dengan squash commit `d9c584f833a96920774228ef8abab853893b2e6b`.

**Tujuan dan lingkup:** memperkuat popup hasil **Pengaturan → Profil Homestay**. Sebelumnya respons `b25_save_homestay_profile` dan `b25_read_homestay_profile` berhasil sudah cukup untuk memunculkan popup sukses meskipun isinya belum dibandingkan. Kini helper pure `src/lib/homestay-profile-readback.ts` membandingkan **business_name, address, phone, whatsapp** dengan nilai yang dikirim Owner. Bila pembacaan ulang berhasil tetapi nilai berbeda, formulir mengikuti data terakhir yang dibaca, sementara popup **Periksa kembali perubahan profil** muncul; sukses hanya bila keempat nilai cocok. Tidak mencetak kontak/data sensitif di log.

**Backend & akses:** satu write RPC `b25_save_homestay_profile` serta dua pemanggilan read RPC `b25_read_homestay_profile` (saat load dan sesudah save) tetap; hanya Owner di luar Training dapat menyimpan. Validasi form, batas input, komponen ActionResultDialog, fungsi lain, SQL Cloud, dan data profil LIVE tidak diubah. Tidak ada retry otomatis.

**Bukti CI:** head PR `39e831296c2956698f57dcd61e7e334576457f87` menyelesaikan **16/16 GitHub Actions SUCCESS** tanpa failure/pending, termasuk **12 source guards Profil Homestay, 10/10 tes perbandingan readback sintetis, full-app build dan TypeScript**. Kegagalan awal regex tes di branch sudah diperbaiki sebelum CI akhir PASS. Bukti ini bukan UAT persistensi profil LIVE.

**Lovable:** source telah tersinkron ke commit `d9c584f`, tetapi proyek masih `needs_attention / out_of_credits`. `is_published=true` tidak membuktikan build baru sudah dipublikasikan. **Tidak ada publish/deploy**.

**Status UI-26-02:** **PARTIAL**, enam modul popup kode MERGED; Chromium sintetis dan kontrak/readback untuk keuangan + profil PASS. Bukti visual Owner sebelumnya hanya popup sukses Tambah Rekening dan Minimum DP & Komisi. UAT integrasi halaman Profil Homestay serta hasil readback dengan data nyata, jalur gagal, identitas build/publish LIVE tetap belum terverifikasi. Jangan mengulang tes PASS, mengubah data asli, membuat transaksi/Booking, atau menyalakan Overtime untuk sekadar UAT.

**Langkah selanjutnya:** audit guard readback pada `Pengaturan → Rekening Owner` untuk tambah/ubah/aktif/nonaktif menggunakan data sintetis, tanpa mengubah rekening nyata. Merge/deploy perubahan lanjutan harus melalui gate tersendiri.


---

### Addendum UI-26-02 tahap 11 — Rekening Owner PR #201 MERGED (26 November 2026 WIB)

**Persetujuan Owner:** Owner menyetujui secara eksplisit merge [PR #201](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/201) dalam percakapan (“boleh”). PR **MERGED** (squash) ke GitHub `main` dengan commit `bac5f497acaabf32ccc016fa0c1c5ba8b20052b3`.

**Tujuan/lingkup:** pengamanan popup sukses **Pengaturan → Rekening Owner** untuk Tambah/Ubah/Aktifkan/Nonaktifkan. Sebelumnya RPC `upsert_finance_bank_account` yang sukses dan `banks.refresh()` saja dianggap cukup tanpa membandingkan nilai yang tersimpan. Definisi fungsi dalam `supabase/migrations/20261015000000_finance_foundation.sql` mengembalikan UUID. Sekarang halaman `src/routes/pengaturan-rekening-owner.tsx` melakukan SELECT read-only `finance_bank_accounts` berdasarkan ID balikan RPC, lalu helper pure `src/lib/owner-bank-readback.ts` memastikan **id, bank_name, account_name, account_number, logo_key, active** cocok dengan tindakan Owner. Jika ID, status atau data tidak cocok / tak terbaca, popup **tidak mengklaim sukses**; pengguna diminta memeriksa sebelum mengulangi. Form tidak direset sebelum hasil terverifikasi; tidak ada retry otomatis maupun detail rekening dalam pesan popup.

**Aturan tetap:** satu nama RPC lama dipanggil di masing-masing jalur save/toggle; Owner-only di luar Training, validasi nomor rekening 5–30 digit, nama bank/pemilik, dan kontrol busy tidak diubah. Tidak ada SQL/migrasi, perbaikan komisi, transaksi, pembayaran, perubahan rekening sungguhan ataupun publish.

**Bukti CI:** head PR `5b48fcb2580ed69e7ca8c7a2451a79328b1a569e` memiliki **17/17 GitHub Actions SUCCESS**, termasuk **15 source guards popup**, **14/14 kasus verifikasi rekening sintetis**, full-app build dan TypeScript. Bukti ini **PASS source/simulasi**, bukan verifikasi mutasi rekening pada LIVE.

**Lovable:** source sinkron pada merge commit `bac5f49` saat diperiksa; proyek tetap `needs_attention / out_of_credits`. `is_published=true` tidak berarti commit terbaru sudah dipublikasikan. **Tidak ada deploy/publish** selama pekerjaan ini.

**Status UI-26-02 tetap PARTIAL:** kode popup enam modul MERGED; komponen Chromium sintetis, finance readback dan profil, dan Rekening Owner readback sintetis PASS. UAT visual Owner sebelumnya hanya sukses Tambah Rekening dan sukses Minimum DP & Komisi, bukan bukti seluruh jalur gagal/mismatch, persistensi LIVE, atau versi aplikasi published. Jangan mengubah rekening, profil, keuangan, kamar, booking, pengumuman, template, SQL Cloud, atau transaksi hanya untuk UAT.

**Pekerjaan berikutnya:** pilih modul selanjutnya untuk audit hasil baca ulang dan guard yang benar-benar belum PASS, tanpa mengulang tes sukses yang telah dicatat. Status Gate Overtime SQL tetap NO-GO.


---

### Addendum LIVE UAT NO9 — Reset Empat Tamu Demo dan Dua Closing FINAL (26 November 2026)

**Persetujuan Owner:** Owner meminta menghapus keempat tamu demo **beserta transaksi/riwayatnya**, lalu memberi persetujuan eksplisit untuk mereset **dua sesi kas FINAL 23 November 2026**, termasuk closing/setoran/pengeluaran, **dengan syarat semua isi terbukti simulasi**. Operasi dilakukan pada database Lovable Cloud **LIVE Baturaden 25 Homestay**, **bukan** proyek Supabase Staging yang berbeda.

**Target tamu berdasarkan nama + empat digit WA (identitas lengkap tidak ditulis ulang di dokumen):**
- Lato (0310): sebelumnya terhapus permanen dari tabel operasional bersama dua penawaran (DRAFT/SENT) dan event penawaran terkait; tanpa transaksi.
- UAT NO9 BOOKING 20261123 (9001): transaksi `BTRDTRX-000032` check_out.
- UAT NO9 CANCEL 20261123 (9003): transaksi `BTRDTRX-000034` cancelled.
- UAT NO9 WALKIN 20261123 (9002): transaksi `BTRDTRX-000033` check_out.

**Preflight nyata:** ketiga transaksi punya total **5 pembayaran Rp188.000**, **1 refund Rp1.000** sumber `OWNER_FUNDS`, catatan tamu, ID idempotency, booking event dan riwayat HK (2 jobs, 4 history, 2 checklist). Kedua sesi kas `FINAL` tanggal 2026-11-23 berisi persis kelima pembayaran itu (tanpa pembayaran transaksi lain), dua pengeluaran kategori `DEMO WORK` masing-masing Rp10.000 dengan catatan simulasi/tanpa uang nyata, satu setoran Rp10.000 bertanda `UAT NO9 SIMULASI`, tiga alokasi closing, serta dua audit hitung fisik yang alasan closing-nya juga eksplisit simulasi tanpa uang nyata. **Koreksi:** angka Rp238.000 yang sempat dikatakan dalam percakapan adalah salah penjumlahan; data pembayaran terverifikasi **Rp188.000**.

**Pengaman dan backup:** sebelum menghapus transaksi/closing, dibuat backup pemulihan **37 row / 17 tabel yang berisi data** di tabel privat `b25_maintenance_private.demo_reset_backup_20261126` (tidak ada akses schema untuk `anon` atau `authenticated`, RLS tabel aktif). Ini backup privat untuk pemulihan, **bukan data operasional aplikasi**; jangan menghapus tanpa keputusan pemeliharaan tersendiri. Semua pemilihan baris dibatasi UUID target, dihitung dan diperiksa sebelum pemrosesan.

**Eksekusi reset LIVE:** Satu blok SQL atomik berisi pemeriksaan identitas UAT, jumlah pembayaran, pengeluaran, setoran, refund, closing dan dependencies; penghapusan hanya baris target dalam 25 tabel relasi yang diperiksa (termasuk tabel tanpa baris). Trigger pembatas mutasi pembayaran transaksi tertutup, audit closing append-only, dan sesi kas FINAL **dinonaktifkan hanya di dalam transaksi reset**, kemudian **diaktifkan kembali sebelum commit**. Bila salah satu pengaman/jumlah tidak cocok, seluruh transaksi rollback; percobaan yang gagal sebelumnya sudah rollback tanpa penghapusan parsial. **Tidak ada perubahan permanen pada definisi trigger, fungsi, RLS atau aturan bisnis aplikasi.** Penghapusan tidak menyentuh status/daftar kamar, harga, komisi, rekening Owner, maupun data tamu lain.

**Bukti setelah reset dari query LIVE:** **0/4 profil tamu target tersisa; 0/3 transaksi target; 0 pembayaran/refund target; 0/2 sesi kas FINAL target; 0 setoran, pengeluaran, audit closing, alokasi sesi, guest notes, idempotency, booking events serta riwayat HK target.** Ketiga trigger khusus terverifikasi `tgenabled='O'` (aktif). Backup privat tetap **37 row / 17 tabel**, akses `anon` dan `authenticated` ke schema = false. Total database operasional sesudah reset: **9 tamu lainnya, 0 transaksi, 0 pembayaran, 0 sesi kas**. Angka ini bukan jaminan seluruh data lain adalah data asli; hanya empat tamu yang disebut Owner yang diproses.

**Status:** **DONE — data demo yang diminta telah dibersihkan dan diverifikasi di tabel operasional LIVE**. Ini reset data UAT, bukan pengujian popup UI-26-02 dan **bukan** izin publish Lovable/merge PR/aktivasi SQL Overtime. Owner dapat menyegarkan halaman Daftar Tamu dan mulai menginput tamu asli. Sesi kas operasional baru perlu dibuka sesuai prosedur ketika mulai menerima pembayaran. Backup privat perlu keputusan retensi/penghapusan terpisah setelah verifikasi operasional.


---

### Addendum Daftar Tamu — Kolom Alamat & Format Input PR #202 MERGED (26 November 2026 WIB)

**Instruksi Owner:** Owner meminta ChatGPT langsung memperbaiki kode pada GitHub dari dua screenshot Daftar Tamu dan Popup Tambah Tamu, bukan hanya memberi instruksi ke Codex/Lovable. [PR #202](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/202) **MERGED** (squash) ke `main`, commit `36ce46ed660624719c4cb79189f9f49311afa05a`.

**Lingkup implementasi** (kode saja):
- Tabel `src/routes/tamu.tsx` berisi **7 kolom**: No. | Nama Tamu | **Alamat** | WhatsApp | Kunjungan | Status | Aksi. Alamat adalah data `guests.address` existing, fallback `—`; teks panjang ditruncate dengan tooltip. Lebar kolom dan CSS penekanan angka Kunjungan diperbaiki pada `src/components/tamu.css`.
- Popup **Tambah/Edit Tamu**: nama otomatis uppercase saat mengetik, blur, dan disimpan. Alamat diberi kapital awal kata pada blur dan saat disimpan; spasi berulang dirapikan, RT/RW tetap uppercase.
- Input WA otomatis membersihkan spasi, tanda hubung, kurung, dan titik saat mengetik/paste/blur/save. `+62 856-5980-8499`, `+62 856 5980 8499` menjadi `+6285659808499`; `0856 5980 8499` menjadi `085659808499`; awalan `08` tidak diam-diam dikonversi ke `+62`. Input `628...` tanpa plus juga diterima dan dirapikan menjadi `+628...`.
- Pemeriksaan duplikat didasarkan pada nomor kanonik agar dua format `+62` dan `08` dipahami sebagai nomor yang sama. Validasi format dan digit berjalan sebelum insert/update. Jalur tambah catatan saja **tetap hanya mengubah catatan**, tidak mengubah identitas. Tidak ada pembaruan massal tamu lama maupun perubahan normalisasi WhatsApp global.
- Helper baru `src/lib/guest-entry-format.ts`, test runtime `scripts/guest-entry-format.test.ts`, test source UI `scripts/guest-entry-ui-contract.test.cjs`, workflow `B25 Guest Entry Format and Address Column Review`.

**Bukti kode:** 16/16 workflow GitHub Actions SUCCESS di head PR `719c9a4ea33bb3d851da2b1c24092e9a4f7f8fde`, termasuk tes input sintetis, struktur UI, full-app build dan TypeScript. **PASS CI bukan bukti UAT visual**.

**Lovable:** metadata source project sudah tersinkron pada commit merge `36ce46e`, tetapi proyek masih `needs_attention / out_of_credits`. `is_published=true` **tidak membuktikan** bahwa perubahan terbaru sudah tampil di aplikasi yang dipublikasikan. Tidak dilakukan publish/deploy dan tidak ada perubahan data tamu LIVE, SQL Cloud, kamar, transaksi, harga, pembayaran, atau Overtime oleh perbaikan ini.

**UAT berikutnya:** setelah tersedia build yang benar, Owner dapat melihat kolom Alamat dan mengetes format input Tambah/Edit dengan data tamu **asli ketika memang akan disimpan**, tanpa membuat atau menghapus record demo semata demi UAT. Pertahankan status UAT visual **BELUM PASS** sampai ada bukti.
