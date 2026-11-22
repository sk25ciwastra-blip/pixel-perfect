# Baturaden 25 Homestay — Nomor 8: Matriks Pembersihan Data DEMO

**Tanggal baseline:** 23 November 2026 WIB. **Status:** persiapan eksekusi, BUKAN persetujuan perubahan data. **Pengujian tiga akun hanya dilakukan pada Nomor 9 oleh Work: Receptionist → Owner → Housekeeping.**

## Peraturan wajib
- Jangan membuat Check-in/Check-out fiktif, mengubah kamar READY via SQL, menghapus riwayat pembayaran/komisi/struk/Housekeeping, refund otomatis, menutup Closing FINAL atau mengubah nominal historis.
- Owner telah mengklasifikasi tepat 8 check_out historis sebagai DEMO (dokumen transisi 22 November), tetapi tabel izin pelaksanaan arsip `owner_delete_private.demo_transaction_approvals` **masih 0** pada audit 23 November. Fungsi `owner_archive_demo` sengaja menolak bila belum masuk allowlist; jangan menyiasatinya.
- Keseluruhan data pembayaran 24 baris Rp1.356.000 tetap utuh. 3 sesi kas OPEN belum ditutup. 3 sesi FINAL tidak boleh dimodifikasi.

## A. Delapan transaksi selesai — daftar persetujuan klasifikasi Owner

| No. Transaksi | Kamar | Pembayaran | Riwayat HK | Langkah No8 |
|---|---|---:|---:|---|
| BTRD25-000002 | 01 (legacy, dirty) | Rp90.000 | 0 | Kandidat arsip metadata setelah izin khusus |
| BTRD25-000004 | 01 (legacy, dirty) | Rp200.000 | 0 | Kandidat arsip metadata setelah izin khusus |
| BTRD25-000008 | 08 (ready) | Rp70.000 | 2 | Kandidat arsip metadata setelah izin khusus |
| BTRD25-000018 | 03 (occupied oleh TRX lain) | Rp160.000 | 2 | Kandidat arsip metadata; jangan ubah kamar 03 |
| BTRDTRX-000026 | 10 (ready) | Rp90.000 | 2 | Kandidat arsip metadata setelah izin khusus |
| BTRDTRX-000027 | 12 (ready) | Rp70.000 | 2 | Kandidat arsip metadata setelah izin khusus |
| BTRDTRX-000028 | 12 (ready) | Rp70.000 | 2 | Kandidat arsip metadata setelah izin khusus |
| BTRDTRX-000029 | 12 (ready) | Rp70.000 | 2 | Kandidat arsip metadata setelah izin khusus |

**Total 8 transaksi: Rp820.000 dalam 11 pembayaran.** Tidak boleh menghapus pembayaran dan audit yang terkait. `owner_archive_demo` hanya mengisi metadata arsip dan memerlukan nomor konfirmasi persis serta sesi Owner valid. Nilai pembayaran dan riwayat wajib tetap terbaca secara historis.

## B. Enam Booking berbayar yang masih aktif

| No. Transaksi | Kamar | Dana diterima | Tindakan yang sah |
|---|---|---:|---|
| BTRD25-000006 | 05 | Rp100.000 | Tanpa jadwal; verifikasi administratif Owner dahulu |
| BTRD25-000010 | 08 | Rp10.000 | Tidak otomatis batal; tangani secara administratif bila diputuskan |
| BTRD25-000012 | 09 | Rp10.000 | Jadwal **24 Desember 2026**, lindungi sebagai Booking masa depan |
| BTRD25-000014 | 06 | Rp70.000 | Booking lama terpisah dari CHECK-IN aktif di kamar 06 |
| BTRD25-000016 | 08 | Rp70.000 | Tidak otomatis batal; keputusan administratif Owner |
| BTRDTRX-000021 | 09 | Rp56.000 | Tidak otomatis batal; keputusan administratif Owner |

**Total 6 Booking: Rp316.000 dalam 7 pembayaran.** RPC `cancel_booking_owner` tersedia di Cloud: hanya Owner, konfirmasi nomor persis, alasan 10–500 karakter, acknowledgment khusus Booking masa depan, dan audit. Ia mengubah status administratif tanpa refund/menghapus pembayaran. Ini **pilihan** ketika Owner sudah memutuskan pembatalan per nomor, bukan instruksi membatalkan semua Booking otomatis.

## C. Tiga CHECK-IN lama yang masih mengunci kamar

| No. Transaksi | Kamar | Dana diterima | Tindakan |
|---|---|---:|---|
| BTRDTRX-000025 | 03 | Rp80.000 | Verifikasi kamar telah kosong; Check-out resmi → HK → READY |
| BTRD25-000019 | 06 | Rp70.000 | Verifikasi kamar telah kosong; Check-out resmi → HK → READY |
| BTRDTRX-000020 | 07 | Rp70.000 | Verifikasi kamar telah kosong; Check-out resmi → HK → READY |

**Total 3 CHECK-IN: Rp220.000 dalam 6 pembayaran.** Checkout tanpa verifikasi kondisi aktual kamar dilarang. Status kamar 03/06/07 sengaja tetap `occupied` sampai proses sah selesai.

## D. Tiga sesi kas OPEN

| Tanggal sesi | Pemilik sesi | Pembayaran terkait | Catatan |
|---|---|---:|---|
| 21 Okt 2026 | OWNER (user_roles, tanpa profil employees) | 10 pembayaran Rp436.000 | Harus direkonsiliasi hitung fisik, alokasi, alasan selisih bila perlu; jangan menebak nama petugas |
| 5 Nov 2026 | QA-RCP-01 | 0 pembayaran | Bukan otomatis boleh ditutup; verifikasi dan Closing resmi |
| 21 Nov 2026 | B25EMP-002 | 0 pembayaran | Sesi staf yang dipersiapkan, jangan tutup otomatis |

**Sesi FINAL 3** tetap immutable. Rekening Owner aktif 0 dan setoran 0; jangan menganggap Setoran Transfer dapat dilakukan sebelum konfigurasi sah.

## E. Urutan eksekusi ketika izin per objek sudah tersedia
1. Bekukan baseline nominal dan referensi relasi: TRX, 24 pembayaran, komisi, HK, receipt, 3 OPEN + 3 FINAL. Cocokkan perubahan hanya pada target yang diotorisasi.
2. Untuk 8 checkout historis: registrasikan izin daftar UUID + nomor yang telah disetujui untuk *eksekusi* melalui jalur administrasi terpisah, kemudian panggil `owner_archive_demo` per nomor dengan sesi Owner yang masih aktif. Jika izin belum ada, **STOP**.
3. Untuk 6 Booking: minta keputusan pengakhiran administratif per nomor yang memenuhi aturan. Jangan otomatis membatalkan Booking masa depan; pembayaran non-refundable tetap tercatat.
4. Untuk 3 CHECK-IN: hanya setelah konfirmasi kamar nyata sudah ditinggalkan, operator resmi Check-out, lalu petugas Housekeeping menyelesaikan alur ke READY. Jangan melewati tahapan.
5. Untuk 3 kas OPEN: rekonsiliasi kas fisik dan hak pemilik, Closing melalui RPC sah; tidak ada talangan pribadi maupun penulisan ulang FINAL.
6. Audit akhir **pembersihan data**, bukan uji fungsi Nomor 9: pastikan daftar aktif yang dituntaskan sesuai keputusan, kamar benar, jumlah pembayaran & komisi tidak hilang, FK HK/struk utuh, dan audit lengkap.

## Status checkpoint
**Belum ada transaksi, Booking, kamar, atau sesi yang diubah dalam pekerjaan No8 ini.** Sumber: dokumen transisi 22 Nov, Cloud SELECT-only 23 Nov, definisi RPC Cloud aktual. Tidak ada nilai GO-LIVE yang diumumkan. No9 Work melakukan uji tiga akun setelah No8 ditutup.
