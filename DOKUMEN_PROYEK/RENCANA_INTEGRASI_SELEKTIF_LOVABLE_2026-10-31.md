# Rencana Integrasi Selektif GitHub–Lovable — 31 Oktober 2026

**Proyek:** Baturaden 25 Homestay. **Status:** Rencana teknis, belum dikerjakan di Lovable/Cloud.  
**Referensi:** Issue #19; PR #17 sudah MERGED. Jangan mengulang tes lokal yang PASS tanpa perubahan kode.

## Bukti perbedaan aktual
- Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` melaporkan last edit 28 Okt, latest source commit `42c1cc8c...`; metadata **bukan** bukti deployed revision.
- `src/components/formulir-pemesanan.tsx` Lovable masih memiliki blok penolakan `extra.tambahan > 0`; GitHub `main` tidak lagi, dan mengirim `_guest_count: guestCount`, menghitung ekstra di atas dua orang = Rp50.000/orang.
- `src/components/detail-transaksi.tsx` Lovable masih memiliki layout/detail alamat; GitHub `main` menambahkan `ReceiptPrintButton` dan `ReceiptHistoryButton` pada tabel per-payment. Jangan overwrite keseluruhan file.
- Komponen dependensi di GitHub `main`: `src/components/receipt-actions.tsx` dan `src/lib/receipt-print.ts`; file tersebut memanggil RPC `issue_payment_receipt`, `request_receipt_print`, `record_receipt_print_result`. **Mereka tidak bisa berfungsi sebelum schema/RPC receipt diterapkan pada target Cloud.**

## Tahap implementasi proposal (tidak otomatis publish)
1. **Baseline:** catat hash source Lovable per file dan status publish yang dapat dibuktikan; buat snapshot kode terpisah tanpa menimpa hasil desain. Pastikan cabang/repo yang berwenang ditentukan; integrasi GitHub tidak dapat disimpulkan dari `latest_commit_sha` Lovable.
2. **Extra Guest:** port perubahan logika `guestCount`, total harga, snapshot, dan parameter `_guest_count` dari GitHub `main` ke kode yang akan dideploy; pertahankan markup/desain Lovable jika berbeda. Periksa DP minimum pada **grand total** (harga kamar + Extra Guest) agar aturan DP minimum 40% tidak terlewati.
3. **Receipt 58 mm:** integrasikan `src/lib/receipt-print.ts` dan `src/components/receipt-actions.tsx`; tambahkan tombol pada titik aksi yang telah disetujui, **tanpa menimpa header, alamat tamu, maupun layout detail transaksi Lovable**.
4. **Kontrak keamanan/akuntansi:** verifikasi RPC di Cloud (read-only) sebelum migrasi, termasuk signature role/grant, print count per-payment, dan training audit. Periksa apakah history pembayaran pada struk final menghapus metode pembayaran seperti keputusan Owner. Periksa apakah printing menandai `PRINT_DIALOG_OPENED` sebagai berhasil cetak atau hanya membuka dialog, supaya audit tidak menyesatkan.
5. **Uji terisolasi:** TypeScript/build, simulasi Booking/Walk-in dengan 2/3/4 tamu, DP, transaksi Training, pembatalan print popup, cetak/reprint 58 mm, hasil receipt per-payment. Tidak perlu mengulang runtime PR #17 bila tidak ada regresi terkait.
6. **Gate aktivasi:** tetap **NO-GO** sampai rencana recovery produksi, kompatibilitas deployed frontend dan caller eksternal, preflight RPC legacy 10/3/4, serta persetujuan Owner untuk migrasi dan publish terpisah. Jangan jalankan `20261022000004_revoke_legacy_rpc_execute.sql` otomatis.

## Risiko tambahan dari source GitHub yang perlu diperiksa
- `receipt-print.ts` `paymentRow` mencetak `payment.method` di bagian PAYMENT HISTORY; keputusan Owner untuk struk Booking final **tidak menampilkan Payment Method pada riwayat pembayaran**. Perbaiki sebelum dianggap siap cetak.
- Fungsi `prepareReceiptPrint` mengeluarkan receipt dan print request **sebelum** memeriksa popup; jika browser menolak popup, perhatikan penomoran reprint dan jejak audit. Ini butuh desain failure semantics yang konsisten, bukan alasan untuk mengulang backup.
- Tombol `ReceiptHistoryButton` meminta satu print request untuk *setiap* pembayaran; pastikan penomoran salinan per payment benar sesuai aturan Owner.

**Kebijakan kerja:** tidak ada merge/deploy Cloud hanya karena dokumen proposal ini siap; pengerjaan visual Lovable tetap sesuai desain approved.
