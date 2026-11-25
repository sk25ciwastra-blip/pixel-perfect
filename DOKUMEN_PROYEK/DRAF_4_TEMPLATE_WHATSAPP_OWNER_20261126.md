# DRAF — Empat Template WhatsApp yang Diminta Owner (26 November 2026)

**Status:** DRAF REDAKSI untuk peninjauan Owner. **BELUM diterapkan di halaman Pengaturan, belum disimpan sebagai versi ACTIVE, bukan izin migrasi Cloud/ubah tarif.** Permintaan Owner memperbaiki daftar empat template; dokumen ini menggantikan **rencana pilihan di UI** dari daftar lama, bukan otomatis menghapus data historis atau jalur Reservasi Satu Pintu.

## Daftar resmi yang diminta Owner untuk pilihan Pengaturan

1. **Konfirmasi Reservasi** — setelah pembayaran diverifikasi dan Booking resmi diterbitkan. Jenis backend saat ini: `KONFIRMASI_BOOKING`, **nama tampilan yang diinginkan:** Konfirmasi Reservasi.
2. **Pengingat Booking** — 30 menit sebelum jadwal Check-in, Receptionist mengirim manual. Backend: `PENGINGAT_BOOKING_30_MENIT`.
3. **Pengingat Waktu Habis** — saat waktu menginap berakhir, pesan toleransi 15 menit. Backend: `PENGINGAT_WAKTU_HABIS`.
4. **Pemberitahuan Overtime** — setelah waktu Check-out dan toleransi 15 menit, petugas meminta tamu menghubungi admin untuk mengonfirmasi biaya overtime **Rp50.000/jam** atau perpanjangan menginap. **Jenis backend baru BELUM ADA**; perlu peninjauan implementasi, gating manual, dan persetujuan migrasi terpisah.

**Yang tidak ditampilkan sebagai pilihan di Pengaturan:** `PENAWARAN_RESERVASI` dan `KONFIRMASI_PEMBAYARAN`. **Jangan langsung DELETE** tabel/versi/RPC kedua jenis: `PENAWARAN_RESERVASI` masih digunakan Detail Reservasi untuk menyalin rincian sebelum pembayaran, sedangkan `KONFIRMASI_PEMBAYARAN` masih direferensikan pendamping PDF. Sembunyikan dari menu Owner *hanya setelah* memastikan alur layanan tetap berjalan; jangan mematikan template prepayment yang sudah ACTIVE.

**Batas waktu:** Nomor #4 baru pesan **pemberitahuan**; kode biaya, kebijakan overtime, charge event, atau pencatatan keuangan tidak boleh diubah oleh revisi redaksi template ini. Pengiriman tetap **manual**.

## 1. Konfirmasi Reservasi — draf revisi Owner, 26 November 2026

**Maksud Owner:** mengikuti struktur *Rincian Penawaran Reservasi* sebelumnya, tetapi menjadi bukti rincian pemesanan yang **sudah resmi tercatat setelah pembayaran diverifikasi**. Tamu harus dapat mengecek kamar, paket/jadwal, rincian harga, pembayaran yang telah diterima, serta sisa tagihan dalam satu pesan. Draf ini **belum disetujui sebagai teks ACTIVE**.

```text
*BATURADEN 25 HOMESTAY*
*— KONFIRMASI RESERVASI —*

Halo Kak [NAMA_TAMU] 👋

Terima kasih telah melakukan reservasi di *Baturaden 25 Homestay*.

Kami informasikan bahwa pembayaran telah kami terima dan verifikasi. Berikut rincian pemesanan kamar Kakak yang telah resmi tercatat.

*DETAIL RESERVASI*
No. Transaksi : [NOMOR_TRANSAKSI]
Nama Tamu : [NAMA_TAMU]
Tipe Kamar : [TIPE_KAMAR]
No. Kamar : [NOMOR_KAMAR]
Paket : [PAKET]
Check-in : [CHECKIN_WIB]
Check-out : [CHECKOUT_WIB]
Jumlah Tamu : [JUMLAH_TAMU] Orang

*RINCIAN HARGA*
Harga Kamar : [HARGA_KAMAR]
Biaya Tambahan : [BIAYA_TAMBAHAN]
*Total Tagihan : [TOTAL_TAGIHAN]*

*RINCIAN PEMBAYARAN*
Pembayaran Diterima : [TOTAL_DIBAYAR_BERSIH]
Sisa Pembayaran : [SISA_TAGIHAN]
Status Pembayaran : [STATUS_PEMBAYARAN]

*STATUS RESERVASI*
✅ *RESERVASI TELAH DIKONFIRMASI*

Reservasi Kakak telah tercatat sesuai tipe kamar, paket, serta jadwal Check-in dan Check-out yang tertera di atas.

Mohon simpan bukti reservasi ini dan tunjukkan kepada Receptionist saat Check-in.

Apabila membutuhkan bantuan atau ingin mengajukan perubahan jadwal, silakan menghubungi admin kami.

Terima kasih telah memilih *Baturaden 25 Homestay*.

Kami menantikan kedatangan Kakak! ✨

*BATURADEN 25 HOMESTAY*
_Your Comfort, Our Priority._
```

**Gate implementasi:** backend saat ini `KONFIRMASI_BOOKING` baru menyediakan `TOTAL_TAGIHAN`, `DP_DITERIMA`, `SISA_TAGIHAN`, `STATUS_PEMBAYARAN` dan detail kamar/jadwal; tiga token baru di rancangan ini (`HARGA_KAMAR`, `BIAYA_TAMBAHAN`, `TOTAL_DIBAYAR_BERSIH`) **belum terdaftar dalam allowlist `KONFIRMASI_BOOKING`**. Saat implementasi, hubungkan ke snapshot harga/transaksi dan net payment yang benar, termasuk guard refund; jangan gunakan data dummy atau membocorkan ledger. Jangan simpan teks ini ke versi ACTIVE sebelum renderer dan tes backend memvalidasi seluruh placeholder serta Owner menyetujui redaksi final.

## 2. Pengingat Booking — 30 Menit

```text
*BATURADEN 25 HOMESTAY*
*— PENGINGAT CHECK-IN —*

Halo Kak [NAMA_TAMU] 👋

Kami ingin mengingatkan bahwa jadwal Check-in Kakak akan dimulai dalam *30 menit lagi*.

*DETAIL RESERVASI*
No. Transaksi: [NOMOR_TRANSAKSI]
Tipe Kamar: [TIPE_KAMAR]
No. Kamar: [NOMOR_KAMAR]
Jadwal Check-in: [CHECKIN_WIB]

Mohon memastikan kedatangan Kakak sesuai jadwal yang telah ditentukan.

Hati-hati dalam perjalanan. Kami menantikan kedatangan Kakak! ✨

*Baturaden 25 Homestay*
```

## 3. Pengingat Waktu Habis

```text
*BATURADEN 25 HOMESTAY*
*— PENGINGAT CHECK-OUT —*

Halo Kak [NAMA_TAMU] 👋

Kami ingin menginformasikan bahwa *waktu menginap Kakak telah berakhir*.

*DETAIL MENGINAP*
No. Transaksi: [NOMOR_TRANSAKSI]
No. Kamar: [NOMOR_KAMAR]
Batas Check-out: [BATAS_CHECKOUT_WIB]

Kami memberikan *waktu toleransi 15 menit* setelah batas Check-out sebelum ketentuan overtime berlaku.

Mohon segera melakukan Check-out atau menghubungi Receptionist apabila Kakak ingin memperpanjang waktu menginap.

Terima kasih atas perhatian dan kerja sama Kakak. 🙏

*Baturaden 25 Homestay*
```

## 4. Pemberitahuan Overtime

```text
*BATURADEN 25 HOMESTAY*
*— PEMBERITAHUAN OVERTIME —*

Halo Kak [NAMA_TAMU] 👋

Kami informasikan bahwa masa menginap Kakak telah melewati batas Check-out beserta waktu toleransi 15 menit, sehingga saat ini telah memasuki *waktu overtime*.

*DETAIL MENGINAP*
No. Transaksi: [NOMOR_TRANSAKSI]
No. Kamar: [NOMOR_KAMAR]
Batas Check-out: [BATAS_CHECKOUT_WIB]

*PILIHAN LAYANAN*

*Overtime:* Rp50.000 per jam, dengan konfirmasi dari admin.

*Perpanjangan Menginap:* Menyesuaikan paket, tarif, dan ketersediaan kamar.

Mohon segera menghubungi Receptionist untuk mengonfirmasi pilihan Kakak agar biaya dan waktu menginap dapat ditangani dengan tepat.

Terima kasih atas pengertian dan kerja sama Kakak. 🙏

*Baturaden 25 Homestay*
```

## Pelaksanaan aman

- **Saat ini:** empat template lama masih ada di source/DB; PR #176 yang sudah MERGED hanya memperjelas tampilan, **belum mengubah pilihan**.
- **Langkah kode berikutnya (perlu review):** mapping empat pilihan baru di Pengaturan tanpa memutus ketergantungan lama; jenis Overtime perlu dukungan backend/manual reminder dan uji role + waktu, bukan sekadar menambah tab tidak berfungsi.
- **Setelah teks disetujui Owner:** simpan versi ACTIVE melalui jalur Owner/audit resmi. Jangan mengganti ACTIVE diam-diam melalui kode, GitHub, atau SQL.
- **Status UAT:** empat redaksi di atas DRAF; khusus notifikasi overtime **belum tersedia sebagai fungsi**, jangan dinyatakan PASS.
