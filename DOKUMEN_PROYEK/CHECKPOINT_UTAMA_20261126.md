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
