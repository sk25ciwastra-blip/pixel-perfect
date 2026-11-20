# Baturaden 25 Homestay — Gerbang operasional Sabtu: dry-run DEMO & skenario staf

**Tanggal checkpoint:** 21 November 2026 WIB.  
**Status:** **PASS READ-ONLY PREFLIGHT / NO-GO untuk pembersihan DEMO dan transaksi tamu sungguhan.**

## Bukti yang dijalankan sekarang

- Database LIVE Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`; PostgreSQL `17.6`, 40 tabel `public`, 0 tabel dengan `TRUNCATE` efektif untuk `anon/authenticated`. Hanya kueri `SELECT`.
- SQL audit yang benar-benar dieksekusi: `supabase/reconciliation/demo_cleanup_impact_READ_ONLY_20261121.sql`.
- **40 tabel dengan total 529 baris**, dihitung read-only per tabel. Kandidat **23 tabel operasional DEMO / 102 baris**; 17 tabel **427 baris** tidak otomatis dimasukkan dalam reset.
- Tidak ada foreign key dari tabel di luar 23 kandidat yang menunjuk tabel kandidat; tidak ada trigger `ON TRUNCATE` non-internal pada kandidat. Ini pemeriksaan metadata saja, **bukan izin atau jaminan pemulihan**.
- Terdapat **5 sesi kas, 2 OPEN dan 3 FINAL**; `finance_final_session_guard()` secara eksplisit memblokir `DELETE` atau `UPDATE` pada sesi FINAL.
- **4 kamar `occupied`, 1 `dirty`, 7 `ready`**. `validate_room_transition()` hanya mengizinkan alur `occupied→dirty→cleaning→ready` (dan aturan override tertentu). Reset status kamar dengan perintah langsung `occupied→ready` tidak dibenarkan.
- Koneksi SQL admin tidak memiliki `auth.uid()`; trigger audit kamar menggunakan `auth.uid()` untuk `activity_logs.user_id`, sehingga perubahan lewat SQL admin tanpa identitas operasional akan menghasilkan audit actor NULL (atau ditolak jika aturannya diperketat). Ditemukan **136 dari 281** activity logs historis dengan actor NULL. **Jangan memperbanyak audit actor NULL atau menyamar sebagai Owner.**
- Tidak ada transaksi, pembayaran, atau sesi kas baru sejak 20 November 2026 00:00 WIB. Data transaksi dan pembayaran terakhir dibuat 17 November; data saat ini telah dinyatakan DEMO oleh Owner, namun status tetap harus diperiksa sebelum reset.
- **Tidak ada penulisan database** untuk checkpoint ini dan tidak ada perintah pembersihan yang disiapkan untuk dieksekusi otomatis.

## Data yang diusulkan untuk reset setelah persetujuan terpisah

Tabel kandidat berjumlah 23: `finance_cash_sessions`, `finance_charge_events`, `finance_deposits`, `finance_drawer_handoffs`, `finance_expenses`, `finance_payment_batch_idempotency`, `finance_refund_allocations`, `finance_refunds`, `finance_reservation_idempotency`, `finance_session_allocations`, `finance_training_audit`, `guest_notes`, `guests`, `housekeeping_checklists`, `housekeeping_history`, `housekeeping_jobs`, `housekeeping_maintenance`, `housekeeping_transaction_resolutions`, `payment_receipts`, `payments`, `receipt_print_requests`, `room_overtime_owner_releases`, `transactions`.

Tabel yang **tidak boleh otomatis dihapus** mencakup `rooms`, `packages`, `room_types`, `employees`, `employee_profiles`, `user_roles`, `receipt_template_versions`, `finance_settings`, `finance_commission_configs`, `finance_expense_options`, `package_room_type_prices`, `operational_calendar`, `activity_logs` (jejak audit), dan yang lain di luar daftar target. `operational_announcements` masih berisi 4 baris dan perlu tinjauan Owner apakah konten aktual atau DEMO; jangan otomatis hapus.

Karena `activity_logs` (281 baris) tetap ada, **reset 23 tabel bukan pembersihan semua jejak DEMO**. Keputusan retensi/pengarsipan audit harus terpisah, terutama apabila terkait keuangan, aktor, dan nomor transaksi.

`TRUNCATE` terhadap sesi kas FINAL dapat melewati pengaman trigger `BEFORE DELETE` sehingga **tidak boleh diperlakukan setara dengan DELETE aman**. Jika Owner menyetujui reset-inisialisasi DEMO khusus, perlu bukti backup pada titik perubahan, kunci konkurensi, keputusan retensi audit, guard jumlah dan target table yang tepat, satu transaksi atomik yang dapat di-ROLLBACK jika postcheck gagal, serta persetujuan eksplisit atas pengecualian sesi FINAL. **Belum dieksekusi.**

## Skenario pengujian positif minimum, belum dilakukan

Di aplikasi dengan staf asli, bukan JWT palsu / login pinjaman:

| Langkah | Pelaku | Bukti PASS minimum |
|---|---|---|
| 1. Login dan sesi | Receptionist | Login valid; buka sesi; lihat siapa operator dan pemilik sesi |
| 2. Booking | Receptionist | Kamar & paket, mode weekday/weekend, tamu 2/3, DP minimum 40% serta status booking |
| 3. Booking → check-in | Receptionist | Satu nomor TRX, jadwal Pagi/Malam/Harian benar, tidak terjadi double occupancy |
| 4. Payment | Receptionist | Pembayaran/pelunasan tercatat tepat satu kali; total, komisi, sesi, operator cocok |
| 5. Checkout → Housekeeping → READY | Receptionist & Housekeeping | Perubahan status benar, checklist dan audit benar, tidak ada kamar ganda |
| 6. Closing minus | Penanggung jawab sesi/Owner | Aturan minus yang sudah disetujui, tidak muncul talangan pribadi |
| 7. Struk thermal 58 mm | Receptionist | Model A per pembayaran; cetakan pertama tanpa COPY, cetak ulang naik COPY 1, riwayat tidak menyesatkan |
| 8. Hak akses | Supervisor & Housekeeping | Akses sesuai peran; fungsi yang bukan wewenang ditolak |
| 9. Pemulihan setelah test | Owner | Semua data tes dikenali sebagai DEMO, tidak ada transaksi tamu nyata, kesiapan data hari pertama terverifikasi |

Uji negatif role tanpa sesi dan integritas database pasca 6 SQL **telah PASS sebelumnya** dan **tidak perlu diulang** (lihat `DOKUMEN_PROYEK/CHECKPOINT_VERIFIKASI_LIVE_READONLY_20261121.md`). Uji positif memakai data baru pada LIVE **memerlukan izin Owner terpisah**, penanggung jawab nyata dan batas data uji. Tidak boleh mensimulasikan login seolah-olah itu staf asli.

## Keterhubungan kode UI dengan RPC (review source, bukan uji aplikasi)

Pemeriksaan read-only source GitHub `main` menemukan handler aplikasi sudah mengarah pada RPC yang akan diuji:
- `src/components/formulir-pemesanan.tsx`: `create_reservation` / wrapper Training.
- `src/routes/booking.tsx`: `record_transaction_payment` dan `check_in_booking` / varian Training.
- `src/routes/index.tsx`: aksi Check-out memanggil `check_out_transaction` / varian Training.
- `src/routes/keuangan.tsx`: `open_finance_cash_session`, `close_finance_cash_session`.
- `src/routes/housekeeping.tsx`: `advance_room_cleaning`, `override_room_ready`.
- `src/components/checklist-housekeeping.tsx`: `complete_housekeeping_checklist`.
- `src/components/receipt-actions.tsx`: `printReceiptBatch` melalui `src/lib/receipt-print.ts`.

Ini **bukan PASS tombol/browser**; runtime login, state, pembayaran, thermal device, dan hak role tetap harus diuji pada aplikasi sebelum GO.

## Jalur tercepat dan batas izin saat ini

1. Owner menyetujui **uji transaksi positif DEMO terkontrol** (boleh dilakukan oleh staf dengan login masing-masing) sambil Londo memeriksa katalog dan hasil read-only. Pengujian ini belum dilakukan.
2. Setelah bukti positif PASS dan cadangan rollback terkini disetujui, Owner memutuskan **reset DEMO terpisah**. Jangan reset 23 tabel jika ada transaksi riil baru atau aktivitas kas baru. Jangan mengabaikan trigger audit.
3. Uji kesiapan setelah reset: status kamar, sesi baru, kas awal, nomor TRX, paket, tarif, akses, WhatsApp, dan printer thermal.
4. Keputusan GO hanya setelah penerimaan staf + pemulihan database/recovery yang memadai. Full restore Supabase Auth/Storage **belum PASS**; jangan menyatakan GO otomatis karena uji ACL/SQL sudah berhasil.

**Terlarang pada checkpoint ini:** DELETE/TRUNCATE/UPDATE LIVE, penambahan transaksi DEMO, merge, deploy, publish, Staging, layanan berbayar, atau transaksi tamu riil.
