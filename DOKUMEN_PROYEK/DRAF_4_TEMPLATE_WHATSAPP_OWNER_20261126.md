# DRAF — Empat Template WhatsApp yang Diminta Owner (26 November 2026)

**Status:** DRAF REDAKSI untuk peninjauan Owner. **BELUM diterapkan di halaman Pengaturan, belum disimpan sebagai versi ACTIVE, bukan izin migrasi Cloud/ubah tarif.** Permintaan Owner memperbaiki daftar empat template; dokumen ini menggantikan **rencana pilihan di UI** dari daftar lama, bukan otomatis menghapus data historis atau jalur Reservasi Satu Pintu.

## Daftar resmi yang diminta Owner untuk pilihan Pengaturan

1. **Konfirmasi Reservasi** — *konfirmasi rincian permintaan sebelum pembayaran*, status **MENUNGGU PEMBAYARAN**; **BELUM Booking resmi, belum ada TRX, kamar belum terkunci**. Jenis backend yang tepat untuk teks ini adalah `PENAWARAN_RESERVASI` (nama internal lama), dengan nama tampilan baru **Konfirmasi Reservasi**. Jenis `KONFIRMASI_BOOKING` adalah jalur lain sesudah pembayaran dan tidak boleh dicampur.
2. **Pengingat Booking** — 30 menit sebelum jadwal Check-in, Receptionist mengirim manual. Backend: `PENGINGAT_BOOKING_30_MENIT`.
3. **Pengingat Waktu Habis** — saat waktu menginap berakhir, pesan toleransi 15 menit. Backend: `PENGINGAT_WAKTU_HABIS`.
4. **Pemberitahuan Overtime** — setelah waktu Check-out dan toleransi 15 menit, petugas meminta tamu menghubungi admin untuk mengonfirmasi biaya overtime **Rp50.000/jam** atau perpanjangan menginap. **Jenis backend baru BELUM ADA**; perlu peninjauan implementasi, gating manual, dan persetujuan migrasi terpisah.

**Label tampilan yang diperbarui:** jenis backend `PENAWARAN_RESERVASI` tetap dipakai sebagai **Konfirmasi Reservasi sebelum pembayaran**, bukan dihapus. `KONFIRMASI_BOOKING` tetap dipertahankan untuk alur Booking resmi sesudah pembayaran meskipun tidak termasuk empat pilihan utama yang diminta Owner. `KONFIRMASI_PEMBAYARAN` juga masih direferensikan pendamping PDF historis. **Jangan DELETE** jenis, versi ACTIVE, riwayat, RPC, atau data tanpa audit alur terpisah.

**Batas waktu:** Nomor #4 baru pesan **pemberitahuan**; kode biaya, kebijakan overtime, charge event, atau pencatatan keuangan tidak boleh diubah oleh revisi redaksi template ini. Pengiriman tetap **manual**.

## 1. Konfirmasi Reservasi — draf revisi Owner, 26 November 2026

**Koreksi Owner:** ini adalah *konfirmasi rincian permintaan sebelum pembayaran*, dengan susunan seperti template Penawaran sebelumnya. Pesan menyatakan permintaan tamu sudah dicatat sementara dan menampilkan kamar, jadwal, tarif, DP minimum serta opsi lunas. **Belum menerima pembayaran, belum ada nomor TRX, kamar belum terkunci, dan bukan bukti Booking resmi.** Draf ini **belum disetujui sebagai versi ACTIVE**.

```text
*BATURADEN 25 HOMESTAY*
*— KONFIRMASI RESERVASI —*

Halo Kak [NAMA_TAMU] 👋

Terima kasih telah memilih *Baturaden 25 Homestay*.

Permintaan reservasi Kakak telah kami catat. Berikut rincian pemesanan kamar dan informasi pembayaran yang perlu Kakak konfirmasi.

*DETAIL RESERVASI*
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

*PILIHAN PEMBAYARAN*
Minimum DP (50%) : *[DP_MINIMUM]*
Pembayaran Lunas : *[TOTAL_TAGIHAN]*

*STATUS RESERVASI*
⏳ *MENUNGGU PEMBAYARAN*

Silakan memilih pembayaran DP minimum atau pelunasan sesuai rincian di atas.

Setelah pembayaran kami terima dan verifikasi, reservasi Kakak akan dikonfirmasi sebagai *Booking resmi* dan bukti reservasi akan kami berikan.

*PENTING*
Pesan ini bukan bukti Booking resmi. Kamar belum terkunci dan ketersediaannya dapat berubah hingga pembayaran berhasil diverifikasi.

Jika membutuhkan bantuan, silakan menghubungi admin kami.

Terima kasih telah memilih *Baturaden 25 Homestay*. ✨

_Your Comfort, Our Priority._
```

**Pemetaan teknis yang benar:** template ini harus memanfaatkan kind `PENAWARAN_RESERVASI` yang sudah tersedia; label di Pengaturan dapat menjadi `Konfirmasi Reservasi`, **tanpa menciptakan Booking resmi** atau mengubah versi ACTIVE secara diam-diam. Semua token di atas termasuk allowlist `PENAWARAN_RESERVASI`: `NAMA_TAMU`, `TIPE_KAMAR`, `NOMOR_KAMAR`, `PAKET`, `CHECKIN_WIB`, `CHECKOUT_WIB`, `JUMLAH_TAMU`, `HARGA_KAMAR`, `BIAYA_TAMBAHAN`, `TOTAL_TAGIHAN`, dan `DP_MINIMUM`. Label 50% mengikuti ketentuan Owner saat ini; nilai `DP_MINIMUM` tetap dari sistem resmi. Tidak ada `NOMOR_TRANSAKSI`, `DP_DITERIMA`, `TOTAL_DIBAYAR_BERSIH` atau klaim sukses pembayaran dalam template pra-Booking ini.

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
- **Langkah kode berikutnya (perlu review):** label `Konfirmasi Reservasi` memakai jenis `PENAWARAN_RESERVASI` pra-pembayaran yang sudah ada; `KONFIRMASI_BOOKING` tetap dipertahankan untuk Booking resmi sesudah pembayaran. Jenis Overtime perlu dukungan backend/manual reminder dan uji role + waktu, bukan sekadar menambah tab tidak berfungsi.
- **Setelah teks disetujui Owner:** simpan versi ACTIVE melalui jalur Owner/audit resmi. Jangan mengganti ACTIVE diam-diam melalui kode, GitHub, atau SQL.
- **Status UAT:** empat redaksi di atas DRAF; khusus notifikasi overtime **belum tersedia sebagai fungsi**, jangan dinyatakan PASS.
