# Baturaden 25 Homestay — SATU putaran uji operasional DEMO dengan staf asli

**Owner menyetujui:** 21 November 2026 WIB.  
**Batas izin:** Satu alur Booking → Check-in → Pelunasan → Checkout → Housekeeping → READY → Closing yang aman, tanpa dana sungguhan. Staf memakai akun sendiri. Londo hanya menyiapkan skenario dan mengecek database READ-ONLY. **Tidak boleh** menghapus DEMO, menyamar sebagai staf, merge, deploy, publish, mengubah Staging, atau menyatakan GO otomatis.

## Kondisi LIVE yang telah diperiksa
- PostgreSQL 17.6, 40 tabel public; TRUNCATE anon/authenticated = 0.
- 17 transaksi, 24 payments, 2 sesi kas OPEN (masing-masing mulai 21 Oktober dan 5 November; **jangan finalkan kedua sesi lama sebagai bagian uji ini**), 4 kamar terisi.
- Kamar **02** (Superior B) dan **04** (Superior B cadangan) berstatus READY, aktif, 0 booking terjadwal dan 0 check-in aktif pada saat pembacaan. **Periksa ulang pada layar sebelum menyimpan; jangan memaksa booking jika sudah berubah.**
- `Paket 12 Jam` aktif tanpa window check-in terbatas. Harga Superior Weekend = **Rp180.000**, sesuai price catalog saat preflight.
- Minimum DP LIVE = **40%** sehingga Rp72.000, pelunasan Rp108.000 bila total tidak berubah. Gunakan angka hasil aplikasi jika tarif berubah; STOP jika harga/DP menyimpang tanpa alasan.
- Penanda unik `B25 UJI OPS 21NOV26 A` belum ada di database.
- Karyawan aktif memiliki struktur Auth/role; login nyata masih harus dibuktikan. Sebagian akun aktif bernama DEMO; **pilih manusia yang benar-benar bertugas dan login dengan akun yang memang miliknya**.

## Langkah staf (satu putaran saja)

**1. Buka sesi DEMO milik Receptionist asli.**
- Receptionist login sendiri, cek menu Keuangan → Sesi Kas. Pilih Receptionist aktif tanpa sesi OPEN lama, sebaiknya tanpa sesi FINAL historis agar tidak ada carry-forward.
- Jika diperbolehkan oleh UI, buka sesi baru dengan `Saldo Awal Rp0`. **Jangan menutup sesi Owner 21 Okt ataupun sesi Receptionist 5 Nov**. Jangan meminjam atau meniru identitas staf lain.
- Bila tidak dapat membuka sesi bersih, **STOP dan laporkan**; jangan memaksakan alur lewat sesi lama.

**2. Booking DEMO satu kamar.**
- Form Booking; Kamar 02 Superior B (cadangan 04 jika tetap READY dan bebas booking), `Paket 12 Jam`, `Weekend`, 2 tamu, check-in terjadwal 5–10 menit setelah waktu mulai uji di WIB. Jangan pilih jam yang sudah berlalu.
- Nama tamu: **`B25 UJI OPS 21NOV26 A`**.
- Alamat/keterangan: `TEST ONLY / BUKAN TAMU ASLI / TIDAK ADA UANG SUNGGUHAN`.
- Nomor HP pengujian: `000000000000` (format dummy; **jangan kirim WA atau hubungi nomor ini**).
- Metode pembayaran **QRIS — DEMO INTERNAL SAJA**, tanpa memindai kode, mengirim uang, menagih tamu, atau membuat bukti transaksi bank palsu.
- DP contoh Rp72.000; total Rp180.000. Screenshot/simpan **nomor TRX**. Jangan ulang tombol simpan jika hasil tak jelas: cek daftar transaksi dahulu agar tidak dobel.

**3. Booking → pelunasan → Check-in.**
- Setelah jam check-in terjadwal tiba, buka kartu Booking dengan nomor TRX yang sama.
- Catat pelunasan DEMO Rp108.000, metode QRIS simulasi, tanpa uang nyata. Jika UI meminta bukti pembayaran eksternal sesungguhnya, **STOP; jangan mengarang**.
- Tekan Check-in pada transaksi yang sama. Pastikan TRX tidak berganti dan kamar 02 menjadi OCCUPIED. Jika sistem menolak atau ada konflik, **STOP** (jangan memaksa jam).

**4. Check-out → Housekeeping → READY.**
- Dari Dashboard, lakukan Check-out pada **TRX uji** saja. Pastikan kamar beralih ke DIRTY.
- Housekeeping login dengan akun miliknya, mulai pembersihan, kerjakan checklist sesuai fakta *skenario uji*, lalu selesaikan hingga READY. Pastikan audit tindakan atas akun masing-masing; jangan membuka akses role lain.
- Bila aturan menghalangi checkout dini atau checklist, **catat BLOCKED**; jangan ubah waktu, status DB, atau menonaktifkan trigger.

**5. Closing aman, khusus sesi uji yang baru dibuka.**
- Periksa ringkasan kas di menu Keuangan. **Jangan menyentuh dua sesi OPEN historis** dan jangan memfinalkan sesi FINAL historis.
- Hanya uji Closing jika seluruh penerimaan, alokasi QRIS simulasi, dan identitas operator bersumber dari sesi DEMO baru; tidak ada transaksi sungguhan di sesi itu. Jangan mencatat setoran bank nyata atau menyerahkan dana.
- Jika aplikasi mewajibkan setoran nyata, saldo riil berbeda, atau UI tidak bisa membedakan QRIS simulasi dari transfer nyata, **STOP sebelum tombol Finalkan Closing** dan catat hambatan. Ini lebih aman daripada membuat laporan kas tidak benar.
- `Closing minus` tidak harus direkayasa dengan transaksi tambahan pada putaran ini. Pemeriksaan sebelumnya untuk aturan minus sudah PASS; jangan ulang hanya demi menambah data.

**6. Struk thermal 58 mm (opsional bila perangkat tersedia).**
- Cek preview satu pembayaran DEMO, cetak pertama tidak bertanda COPY; ulang cetak pembayaran yang sama harus menjadi `COPY 1`. Cek struk riwayat bila tersedia.
- Jangan memberikan struk DEMO kepada tamu dan jangan menyatakan printer PASS jika perangkat fisik belum dicoba.

**7. Selesai dan laporkan singkat.**
- Operator menyampaikan: `UJI DEMO SELESAI — TRX [nomor] — ROOM [02/04] — CLOSING [PASS/BLOCKED] — PRINT [PASS/TIDAK TERSEDIA/BLOCKED]`.
- Kapten cukup meneruskan ringkasan tersebut ke Londo. Tidak perlu mengirim password, JWT, data pribadi, atau membuka PowerShell.
- Londo akan menjalankan `supabase/reconciliation/ops_single_demo_staff_READ_ONLY_20261121.sql` untuk membaca TRX, payment, sesi, HK, READY, receipts, tanpa memodifikasi data.
- Jangan mengulangi putaran untuk memperbaiki kasus gagal tanpa pemeriksaan dan persetujuan tambahan. **Semua catatan uji tetap DEMO** hingga ada izin reset khusus.

## Batas pembuktian

Tes SQL negatif tanpa sesi dan enam SQL LIVE sudah PASS, tidak diulang. Uji positif belum berjalan sampai staf benar-benar mengoperasikan akun mereka. Tidak ada hak untuk menyamar sebagai staff atau memanggil RPC menulis data via SQL admin. Aplikasi tetap **NO-GO untuk tamu sungguhan**, karena restore Supabase-kompatibel dan pembersihan DEMO belum PASS.

**Catatan kebijakan:** Paket ini satu skenario pengujian minimal, bukan pengujian menyeluruh seluruh paket Pagi/Malam/Harian, kombinasi pembayaran, refund, komisi, atau keseluruhan hak staf.
