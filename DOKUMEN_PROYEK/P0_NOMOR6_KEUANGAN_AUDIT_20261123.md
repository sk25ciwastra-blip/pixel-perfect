# Baturaden 25 Homestay — Roadmap No.6/10: Keuangan

**Checkpoint:** 23 November 2026 (WIB). **Status:** audit langsung Lovable Cloud SELECT-only + satu perbaikan UI pada branch review, belum merge/deploy/publish. **Progres No.6: 60%**; bukan seluruh Finance GO.

## Cakupan Nomor 6

Verifikasi Keuangan operasional: sesi kas Receptionist, DP dan pelunasan, pembayaran gabungan, komisi, pengeluaran, setoran, refund Owner, Closing dan laporan. Nomor 1 (Checkout/Refund backend), No.2 (Booking), No.4 (sinkronisasi RPC) dan No.5 (uji operasional awal) sudah PASS sesuai checkpoint; **jangan jalankan ulang suite, SQL Cloud, atau backup**. Tes klik menyeluruh dan UAT final ada di No.7/9.

## Cloud — audit baru tanpa perubahan data

- Lovable Cloud project `017f6e78-15f2-4d07-a38c-87cb185279bf`, 23 November WIB. Total **6 sesi kas: 3 OPEN / 3 FINAL**. Seluruh 3 FINAL punya `closing_snapshot`, seluruh OPEN tidak punya `closed_at` yang mengindikasikan penutupan. Jangan otomatis menutup sesi lama.
- Pengujian **READ-ONLY** sebagai Owner authenticated: `get_finance_session_summary(uuid)` atas **6/6 sesi** sama dengan agregat SQL independen untuk total pembayaran, Cash, pengeluaran dan saldo kas diharapkan. `BEGIN … ROLLBACK`, tanpa perubahan status atau nominal.
- Pembayaran: **24 baris**, Rp1.356.000, terdiri atas 12 `dp` + 12 `payment`, metode 5 Cash + 19 QRIS. **13** pembayaran punya `cash_session_id` sah; **11** pembayaran DEMO historis tidak memiliki `cash_session_id` — jangan backfill tanpa keputusan Owner dan jejak audit.
- Komisi konfigurasi: **PERCENTAGE 8%**, pengaturan DP: **PERCENTAGE 40%**. Pengeluaran historis **2 baris Rp51.000**, setoran **0**, refund **0**, alokasi Closing **1**. Belum ada transaksi Arsip DEMO.
- 3 sesi OPEN masih mencakup Owner DEMO lama, QA-RCP-01 DEMO dan Receptionist B25EMP-002. Ini data pengujian; sesi B25EMP-002 terakhir terbukti OPEN pada browser, jangan Closing tanpa perintah.
- 3 transaksi aktif dengan nominal diterima kurang dari harga penuh; bukan error keuangan otomatis karena Booking ber-DP boleh belum lunas sebelum Check-in. Tidak ada transaksi yang tercatat lebih bayar pada audit.

## Temuan P0 UI Refund dan pengaman backend yang sudah PASS

Cloud sudah memasang trigger aktif `booking_refunds_nonrefundable_guard_trigger`, yang menolak refund untuk status Booking/cancelled (kebijakan Booking tidak bisa refund), dan `finance_refund_source_session_guard_trigger`, yang menolak sumber refund bukan OPEN. Refund setelah Checkout/terhadap payment dari sesi historis FINAL tetap diizinkan jika *sumber dana* berasal dari OWNER_FUNDS atau sesi kas OPEN yang sah. Backend ini telah PASS di checkpoint sebelum No.6 dan **tidak diubah**.

Sebaliknya `src/routes/keuangan.tsx` masih menampilkan Booking sebagai kandidat refund dan sesi FINAL sebagai sumber dana. Tombol menyebabkan operasi yang akan ditolak trigger, sehingga menyesatkan Owner.

**Fix review saja:** `src/lib/finance-refund-eligibility.ts` dan `src/routes/keuangan.tsx`: hanya status `check_in` / `check_out` yang ditawarkan, sumber sesi `OPEN` saja, validasi ulang sebelum RPC bila pilihan menjadi stale, placeholder alasan yang tidak mendorong pembatalan Booking. Tidak mengubah badan RPC, izin, komisi, keuangan, harga, RLS, payment ataupun data Cloud.

**Bukti:** [GitHub Actions #45063665226](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45063665226) **SUCCESS**: 10/10 focused tests PASS, Vite build PASS, TypeScript PASS. Belum merge/publish; butuh persetujuan Owner untuk jalur GitHub → Lovable → publikasi.

## Kesenjangan laporan yang belum diklaim selesai

Kode `src/routes/laporan.tsx` saat ini menghitung `penerimaan` dari jumlah bruto payments dan `arus kas bersih` = penerimaan − pengeluaran. Karena `finance_refunds` saat ini **0**, angka historis belum menyimpang karena refund; **tetapi laporan berlabel Arus Kas Bersih berisiko tidak memperhitungkan refund ketika refund pertama terjadi**. Ini butuh review peran/RLS dan definisi cash flow yang tepat; jangan mengubah jurnal atau menghitung per payment bruto sebagai laba. Prinsip laporan investor/kredit resmi memisahkan performa pendapatan, biaya dan refund, tidak menyembunyikan biaya.

## Gate menuju No.6 100%

1. Atas izin Owner, merge PR UI Refund setelah CI PASS; cek commit Lovable & publish jika tersedia; verifikasi dropdown tanpa submit refund: Booking dan sumber FINAL hilang, transaksi selesai dan sumber OPEN tersedia.
2. Uji tombol buka/konteks sesi serta Closing non-destruktif (preview saja); pastikan saldo minus diperbolehkan dan FINAL immutable berdasarkan bukti runtime yang sudah PASS, tanpa menutup 3 OPEN DEMO.
3. Audit laporan serta export per metode/biaya/refund sesuai hak akses, jelaskan sumber data bruto/neto dan arsip DEMO. Perbaiki jika ada temuan baru; test terisolasi dahulu sebelum penerapan.
4. Owner periksa UI keuangan melalui browser berizin. Operasi membuat refund/setoran/Closing permanen hanya untuk kasus operasional nyata atau DEMO baru yang disetujui secara khusus, bukan mengubah transaksi lama.

**Tidak ada Cloud SQL atau data yang diubah pada checkpoint ini.**