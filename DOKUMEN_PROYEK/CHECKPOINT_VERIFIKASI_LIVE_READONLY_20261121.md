# Baturaden 25 Homestay — Verifikasi Read-Only Pasca Aktivasi 6 SQL LIVE

**Checkpoint:** Sabtu, 21 November 2026 WIB  
**Lingkup:** Metadata dan negative-access probe di Lovable LIVE, setelah 6 transaksi SQL dengan izin Owner. **Tidak ada operasi penghapusan/penambahan data, merge, deploy, publish, atau perubahan Staging**.  
**Status:** **PASS pada uji negatif tanpa login dan konsistensi database DEMO yang tercakup**, tetapi **NO-GO penerimaan transaksi tamu sungguhan** sampai positive end-to-end, cleanup DEMO, acceptance staf, dan keputusan GO terpisah. Full restore Supabase tetap belum PASS.

## 1. Kontrol akses tanpa login: runtime

Dijalankan di LIVE melalui database query tool sebagai **satu transaksi PostgreSQL READ ONLY**, `SET LOCAL ROLE`, lalu `ROLLBACK`. Ketiadaan JWT diverifikasi melalui `auth.uid() IS NULL`.

| Skenario | Hasil | Bukti |
|---|---|---|
| `anon` → `complete_housekeeping_checklist(...)` dengan parameter dummy | PASS DENIED | Exception tepat `Akses ditolak`; tanpa mutasi |
| `authenticated` tanpa JWT → `check_in_booking(NULL)` | PASS DENIED | `Akses ditolak` |
| `authenticated` tanpa JWT → `record_transaction_payment(...)` | PASS DENIED | `Akses ditolak` |
| `authenticated` tanpa JWT → `close_finance_cash_session(...)` | PASS DENIED | `Akses ditolak: identitas operator wajib` |
| `authenticated` tanpa JWT → `create_finance_refund(...)` | PASS DENIED | `Hanya Owner yang dapat melakukan refund` |
| `authenticated` tanpa JWT → `release_room_overtime_block(...)` | PASS DENIED | `Akses ditolak` |
| `anon` tanpa JWT membaca `transactions`, `payments`, `finance_cash_sessions` | PASS (0 rows) | Tiga tabel tidak menampilkan data |
| `authenticated` tanpa JWT membaca tiga tabel sensitif tersebut | PASS (0 rows) | Tiga tabel tidak menampilkan data |

**Batas bukti:** Pengujian `SET LOCAL ROLE` pada koneksi SQL bukan pengganti HTTP/PostgREST/RLS sesungguhnya dengan JWT valid, sesi asli, browser Lovable, atau verifikasi akses positif per posisi karyawan. Fungsi Housekeeping tetap memiliki privilege `EXECUTE` langsung untuk `anon`; internal guard telah menolak simulasi anon. Tidak ada REVOKE EXECUTE tambahan karena di luar izin enam SQL.

## 2. Status dan integritas data operasional DEMO

- 40 tabel public dan seluruhnya dengan RLS enabled; 0/40 tabel mengizinkan `TRUNCATE` efektif ke `anon` atau `authenticated`.
- 12 kamar, 11 aktif, 4 `occupied`. Masing-masing 4 kamar occupied memiliki **tepat satu** transaksi `check_in`; tidak ada `check_in` aktif pada kamar bukan occupied atau dua `check_in` pada satu kamar.
- 17 transaksi total; 6 booking, 4 check_in, 7 check_out.
- 0 check_in tanpa `started_at`/`ends_at`; 0 checkout tanpa `checked_out_at`.
- **Satu booking lama DEMO:** `BTRD25-000006`, dibuat 5 Oktober 2026, `scheduled_check_in` dan `scheduled_check_out` kosong. Jangan otomatis memperbaikinya; kandidat cleanup DEMO, bukan bukti bug pada fungsi Booking baru.
- 24 pembayaran; 0 pembayaran orphan/tidak memiliki `transaction_id`, 0 amount nonpositif, 0 referensi sesi kas yang menunjuk sesi tidak ada. **11 dari 24 pembayaran memiliki `cash_session_id IS NULL`** pada data demo lintas tanggal (tidak otomatis salah; perlu ditangani eksplisit pada perencanaan cleanup).
- 5 sesi kas total, 2 OPEN dan 3 FINAL. Waktu penutupan konsisten dengan status. Dua OPEN dimiliki satu operator karyawan aktif dan satu akun Owner; tidak ada pemilik sesi OPEN tanpa akun Auth.
- 11 catatan karyawan; 9 aktif. Semua 9 aktif memiliki `auth.users` dan `user_roles` yang sesuai relasi. Ini **bukan** bukti login/password atau penerimaan operasional.
- 0 refund, 0 alokasi refund; 5 checklist, 10 HK history, 4 HK jobs.
- Pembacaan ulang terakhir setelah probes read-only: tetap **17 transaksi, 24 pembayaran, 2 OPEN, 4 occupied, 5 checklist dan 0/40 TRUNCATE**.

## 3. Cakupan data DEMO untuk rancangan cleanup, BELUM DIJALANKAN

| Objek terinventaris | Jumlah saat checkpoint | Rencana kebijakan |
|---|---:|---|
| transactions | 17 | Klasifikasi/bersihkan DEMO **hanya setelah izin Owner tersendiri** |
| payments | 24 | Bergantung transaksi dan kas; jangan DELETE ad hoc |
| finance_cash_sessions | 5 (2 OPEN) | Harus merekonsiliasi dependensi payment/session/allocation dahulu |
| finance_session_allocations | 1 | Dependensi sesi kas |
| guests | 19 | Pertimbangkan relasi guest_notes, transaksi, dan retensi |
| housekeeping_history | 10 | Referensi kamar dan transaksi |
| housekeeping_checklists | 5 | Referensi kamar dan transaksi |
| housekeeping_jobs | 4 | Referensi kamar dan transaksi |
| rooms | 12 | **PRESERVE**; reset status perlu rencana terpisah |
| employees | 11 | **PRESERVE** beserta auth dan lifecycle |
| packages | 9 | **PRESERVE** |
| room_types | 5 | **PRESERVE** |

Jaringan foreign key juga melibatkan `finance_charge_events`, `finance_payment_batch_idempotency`, `finance_reservation_idempotency`, `finance_training_audit`, `payment_receipts`, `finance_deposits`, `finance_expenses`, `finance_drawer_handoffs`, `finance_refund_allocations`, `housekeeping_transaction_resolutions`, `room_overtime_owner_releases`, `guest_notes`, dan lainnya. Tidak cukup sekadar DELETE tabel utama; harus ada inventaris penuh termasuk triggers dan kebijakan pemulihan.

## 4. Gerbang sebelum GO

- **Sudah PASS:** 6 SQL pengamanan LIVE, ACL TRUNCATE, negative no-session RPC test, select RLS unauthenticated, referential/occupancy read-only checks.
- **Belum PASS:** backup pemulihan penuh Supabase/Auth/Storage; transaksi positif pada identitas staff sungguhan; Booking→Check-in→Payment→Checkout→HK→READY; closing minus operasional; anti-race end-to-end sesuai LIVE; struk thermal 58 mm; cleanup DEMO dan verifikasi baseline bersih; penerimaan staf serta keputusan GO Owner.
- **Tidak dilakukan:** membersihkan data DEMO, membuat transaksi nyata/tes mutasi di LIVE, mengubah ACL `EXECUTE` fungsi lain, mengubah Staging, mempublish aplikasi, mengaktifkan layanan berbayar.

**Kesimpulan:** negative no-login guard **6/6 PASS**, tiga tabel sensitif tidak terbaca oleh dua role tanpa identitas, data referensial utama konsisten, ada satu booking DEMO jadwal kosong dan pembayaran DEMO sesi NULL yang perlu dibereskan dalam cleanup terencana. Cloud/operasional masih NO-GO hingga bukti positif, pemulihan dan persetujuan yang relevan terpenuhi.
