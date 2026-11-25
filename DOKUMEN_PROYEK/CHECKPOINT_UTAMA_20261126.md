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

## 7. Pekerjaan berikutnya (tanpa mengulang PASS)

1. **Dokumentasikan checkpoint ini di `main`**, jadikan satu pintu pembukaan obrolan baru; ubah status hanya berdasarkan bukti yang ada.
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
