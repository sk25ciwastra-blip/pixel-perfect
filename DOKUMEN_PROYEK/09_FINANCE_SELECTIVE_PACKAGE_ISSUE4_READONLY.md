# Paket Migrasi Finance Selektif — Issue #4

Status: **DRAFT / READ-ONLY / NO-GO**
Tanggal: 2026-10-21
Baseline: `main` `0179aa27a8c739ee6e4117b7a9259a856a4cc148`
Dasar: Issue #4, PR #5, komentar preflight Owner/Nurdin terbaru

## Keputusan gate saat ini

Paket ini **belum boleh dieksekusi**.

Gate masih terbuka:

1. Ref runtime published `ijujmxhcifuerkllbbgq` belum terverifikasi melalui kontrol project Supabase/Lovable.
2. Backup DB/Auth pre-change belum tersedia dan belum diuji restore.
3. Backup harian terakhir yang terlihat Owner adalah 20 Oktober 2026 19:55:30 UTC; belum membuktikan snapshot setelah akun Supervisor dibuat/diubah pada 21 Oktober.
4. History exact migration target belum terbukti; metadata `drizzle.__drizzle_migrations` terlihat, tetapi history lengkap belum diverifikasi.
5. Database Lovable memiliki akun Owner/Supervisor aktif yang wajib dipertahankan.
6. Tidak ada izin untuk migration, DDL, DML, environment change, deploy, merge, atau transaksi uji.

Status: **NO-GO**.

## Bukti preflight yang menjadi dasar

### Lovable candidate database

- 17 tabel publik, RLS aktif.
- 7 employee, termasuk 1 Supervisor.
- 9 user roles: 7 employee dan 2 owner.
- Tidak ada tabel Finance.
- Tidak ada `open_finance_cash_session(numeric)`.
- Akun Owner/Supervisor berada di database ini; jangan mengganti environment ke staging.

### Supabase staging

- 30 tabel publik, RLS aktif.
- Tabel Finance dan RPC Finance tersedia.
- 0 employee dan 1 role Owner.
- Bukan kandidat pengganti langsung untuk frontend published.

### Security

- Database Lovable memberi anonymous EXECUTE pada helper SECURITY DEFINER: `has_role`, `has_employee_position`, `can_frontdesk`, `can_housekeeping`, `can_operate`, `can_view_finance`, `can_view_operations`, dan `is_receptionist`.
- Staging tidak memberi anonymous EXECUTE pada helper tersebut.
- Staging advisor menemukan 35 fungsi SECURITY DEFINER yang dapat dipanggil authenticated; review fungsi per fungsi diperlukan.
- Leaked Password Protection masih disabled; ini gate Auth terpisah.

## Paket migration minimal yang diusulkan

Paket ini memakai migration yang sudah ada. Tidak membuat migration baru dan tidak mengubah file migration existing.

### Batch F0 — precondition dan snapshot

Wajib lulus sebelum perubahan:

- project ref dan URL published cocok dengan database target;
- backup provider terbaru mencakup DB dan Auth;
- backup dapat dipulihkan atau diverifikasi pada target terisolasi;
- `user_roles`, `employees`, `rooms`, `room_types`, `packages`, `guests`, `transactions`, dan `payments` cocok dengan source;
- row count, total payments, transaction number, price snapshot, day mode, dan status operasional dicatat;
- migration history target disimpan;
- tidak ada sesi kas aktif yang tidak terdokumentasi.

### Batch F1 — Finance foundation

Candidate:

`supabase/migrations/20261015000000_finance_foundation.sql`

Mencakup:

- 11 tabel Finance;
- kolom tambahan pada `payments` dan `transactions`;
- trigger pembayaran dan booking;
- fungsi buka/tutup sesi, pembayaran, expense, deposit, refund, summary;
- RLS Finance;
- revoke direct write dan grant SELECT/RPC.

Risiko khusus:

- migration memiliki seed `finance_settings`;
- fungsi Finance berbentuk SECURITY DEFINER;
- trigger payment/booking menyentuh transaksi dan pembayaran;
- tidak boleh dijalankan sebelum snapshot harga, DP, dan komisi disimpan.

### Batch F2 — compatibility dan idempotency

Candidate:

`supabase/migrations/20261015000001_finance_150_booking_compatibility.sql`

Mencakup:

- snapshot minimum DP pada transaction;
- `finance_reservation_idempotency`;
- perubahan fungsi payment/reservation;
- guard refund/session.

Gate Owner:

- file ini memiliki `UPDATE public.finance_settings` yang dapat menetapkan default DP 40% jika singleton belum pernah diubah.
- SQL tersebut **tidak boleh dianggap otomatis disetujui**.
- Sebelum eksekusi, Owner harus menyetujui nilai DP aktual atau menyetujui varian yang tidak mengubah konfigurasi existing.
- Harga P4 tidak disentuh oleh paket ini.

### Batch F3 — Supervisor alignment

Candidate:

`supabase/migrations/20261015000002_finance_150_supervisor_alignment.sql`

Mencakup:

- Supervisor sebagai booking/operator yang disetujui;
- perubahan `open_finance_cash_session`;
- booking/check-in terkait;
- SELECT RLS Supervisor untuk guests, transactions, payments, employees, dan bank accounts;
- grant RPC ke authenticated.

Precondition:

- `has_employee_position` sudah ada;
- employee Supervisor aktif dan terhubung ke `auth.users.id`;
- fungsi role memakai `auth.uid()`, bukan metadata browser;
- session owner dan operator aktual tetap dicatat terpisah.

### Batch F4 — reference read privileges

Candidate:

`supabase/migrations/20261015000003_booking_reference_read_privileges.sql`

Hanya dijalankan setelah F1–F3 dan pemeriksaan RLS selesai.

### Batch F5 — fitur lanjutan, bukan blocker buka kas

Diperiksa terpisah setelah Finance dasar stabil:

- `20261018000000_finance_training_enforcement.sql`
- `20261019000000_owner_final_numbering.sql`
- `20261019000001_harden_checkout_payment_settlement.sql`

Migration tersebut tidak boleh digunakan untuk menutupi kegagalan F1–F4.

### Migration yang dikecualikan

`20261006000010_correct_p4_prices.sql` tetap **dikecualikan** sampai Owner menyelesaikan keputusan harga P4.

Jangan replay 46 migration repository atau menyalin seluruh staging schema. History target tidak selaras dan harus dipetakan terlebih dahulu.

## SQL patch status

Tidak ada executable DDL/DML patch yang dibuat karena target dan backup belum terverifikasi.

File `09_FINANCE_SELECTIVE_PREFLIGHT_READONLY.sql` hanya berisi SELECT/metadata check untuk:

- identitas tabel;
- RLS;
- function signature;
- grants anon/authenticated;
- policy;
- migration history;
- data preservation checks untuk transaksi, payments, harga, DP, dan komisi.

Migration SQL existing tetap menjadi candidate patch setelah Owner menyetujui precondition. Setiap perubahan terhadap seed DP harus dibuat sebagai patch terpisah yang disetujui Owner; jangan mengedit migration history existing secara langsung.

## Backup dan recovery plan

### Backup yang wajib tersedia

- provider backup/PITR target terbaru setelah akun Supervisor aktif;
- schema-only export;
- data export terkontrol;
- Auth mapping minimum: user id, role, employee id, position, active;
- migration history dan checksum;
- retention dan izin restore tertulis.

Backup ZIP/Git bundle hanya mencakup kode, bukan DB/Auth.

### Verifikasi backup

Backup belum dianggap lulus hanya karena tombol Restore terlihat. Wajib ada:

- timestamp dan target project ref;
- cakupan DB dan Auth;
- retention;
- bukti restore pada environment terisolasi atau verifikasi provider yang setara;
- validasi bahwa Owner/Supervisor mapping tetap sama.

### Rollback

- migration gagal sebelum commit: rollback transaction;
- migration committed: restore PITR/backup atau forward-fix;
- jangan menjalankan down migration destruktif secara blind;
- jangan memulihkan snapshot sebelum akun Supervisor bila itu menghilangkan akun aktif;
- setelah restore, lakukan metadata read-only check sebelum membuka akses operasional.

## RLS dan grants post-check

Target dianggap lulus hanya jika:

- semua tabel Finance memiliki RLS;
- direct INSERT/UPDATE/DELETE Finance ditutup untuk PUBLIC, anon, authenticated;
- SELECT hanya sesuai role/session ownership;
- Finance RPC dapat EXECUTE oleh authenticated;
- helper internal tidak dapat EXECUTE oleh anon;
- `SECURITY DEFINER` memakai search path aman dan validasi auth;
- Supervisor dapat membaca data operasional yang disetujui tanpa mendapat hak Owner;
- Owner tetap dapat mengelola konfigurasi sesuai aturan.

Revoke anonymous EXECUTE harus diverifikasi agar tidak memutus authenticated RLS/RPC flow.

## Smoke test setelah persetujuan

Belum dijalankan.

Di environment terisolasi, urutannya:

1. Owner/Supervisor login.
2. Buka sesi kas.
3. Pastikan session owner dan operator aktual tercatat.
4. Booking/check-in memakai existing transaction/payment rules.
5. Validasi price snapshot, DP, dan komisi tidak berubah.
6. Checkout.
7. Closing dan alokasi.
8. Validasi audit log, nomor transaksi, dan session summary.
9. Cleanup hanya pada data test terisolasi.

Tidak boleh membuat transaksi uji pada database Lovable operasional.

## GO/NO-GO

**NO-GO.**

Beralih ke GO hanya setelah Owner/Nurdin menyetujui:

- identitas target runtime;
- backup DB/Auth yang aktual dan restore-verifiable;
- migration history target;
- nilai DP/komisi dan preservasi harga P4;
- urutan F0–F4;
- hardening anonymous EXECUTE;
- smoke test terisolasi;
- rollback owner dan operator.
