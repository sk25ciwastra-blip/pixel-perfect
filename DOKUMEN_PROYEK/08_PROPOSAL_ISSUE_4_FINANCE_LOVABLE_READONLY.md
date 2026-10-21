# Proposal Read-Only Issue #4 — Sinkronisasi Finance Lovable

Status: **DRAFT / REVIEW-ONLY / NO-GO**
Tanggal: 2026-10-21 (Asia/Jakarta)
Issue: https://github.com/sk25ciwastra-blip/pixel-perfect/issues/4
Baseline: `main` `0179aa27a8c739ee6e4117b7a9259a856a4cc148`
Branch proposal: `proposal/issue-4-finance-sync-readonly`

## 1. Batasan dan hasil

Proposal ini hanya menambahkan dokumen review. Tidak ada perubahan source aplikasi, migration SQL, desain, environment, database, Auth, atau data operasional.

Tidak dilakukan:

- migration, DDL, DML, `NOTIFY`, atau schema cache reload;
- penggantian environment atau API key;
- merge, deploy, publish, atau pembuatan transaksi uji;
- pembuatan akun/reset password;
- perubahan aturan Owner, harga P4, Booking, checkout, training, print, atau desain.

Status Operasional Sementara tetap **NO-GO** sampai Owner/Nurdin menyetujui target, backup, migration, hardening, dan test gate.

## 2. Bukti target database

### Bukti source

Pada `main`:

- `supabase/config.toml` menyatakan project ref kandidat `ijujmxhcifuerkllbbgq`.
- `.env`/client memakai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`; nilai key tidak disalin ke laporan.
- URL yang terbaca dari source mengarah ke host `ijujmxhcifuerkllbbgq.supabase.co`.
- `src/integrations/supabase/client.ts` memakai environment browser/SSR.
- `src/start.ts` mendaftarkan `attachSupabaseAuth` sebagai global `functionMiddleware`.

### Bukti live read-only

Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` dapat diaudit melalui connector:

- 17 tabel publik;
- semua tabel terdeteksi dengan RLS aktif;
- 7 employee, termasuk 1 posisi Supervisor;
- 9 baris `user_roles`: 7 employee dan 2 owner;
- tabel Finance tidak ada;
- `open_finance_cash_session(numeric)` tidak ada;
- helper role/permission tersedia, tetapi `anon` juga memiliki EXECUTE pada fungsi SECURITY DEFINER.

Supabase staging `bgtztcfbkcrvcipxbfti`:

- 30 tabel publik;
- semua tabel terdeteksi dengan RLS aktif;
- 13 tabel Finance tambahan tersedia;
- RPC `open_finance_cash_session(numeric)` dan RPC Finance utama tersedia;
- 0 employee dan hanya 1 role Owner;
- helper permission tidak dapat dieksekusi oleh `anon`, tetapi dapat oleh `authenticated`.

Akses metadata Supabase langsung ke ref `ijujmxhcifuerkllbbgq` ditolak oleh permission MCP. Karena itu, identitas persis antara ref tersebut dan database Lovable **belum dapat dibuktikan secara independen**. Ini adalah blocker verifikasi, bukan alasan untuk menebak.

**Rekomendasi target:** pertahankan database Lovable sebagai kandidat target agar akun Owner/Supervisor yang sudah aktif tidak hilang. Jangan mengalihkan frontend ke staging.

## 3. Akar masalah Finance

`src/routes/keuangan.tsx` memanggil:

```ts
rpc('open_finance_cash_session', {
  _opening_cash: angka(openingCash),
})
```

RPC tersedia di staging, tetapi tidak tersedia di database Lovable yang diaudit. Error schema cache adalah gejala dari mismatch schema/target; bukan sekadar masalah UI atau login.

Alur Auth aplikasi secara kode sudah sesuai:

1. Supabase Auth menghasilkan session.
2. `PeranProvider` membaca `user_roles`.
3. Employee dibaca berdasarkan `user_id`.
4. Posisi Supervisor dipakai untuk izin operasional.
5. Halaman Keuangan memanggil RPC Finance.

Supervisor live ada di database Lovable. Memindahkan URL ke staging akan kehilangan mapping employee karena staging memiliki 0 employee.

## 4. Gap matrix

| Komponen | Lovable target | Staging | Dampak |
|---|---:|---:|---|
| `user_roles` | Ada, 9 baris | Ada, 1 baris | Identitas tidak boleh disamakan otomatis |
| `employees` | Ada, 7 baris | Ada, 0 baris | Supervisor hanya terbukti ada di Lovable |
| `finance_cash_sessions` | Tidak ada | Ada | Buka sesi kas gagal |
| `finance_session_allocations` | Tidak ada | Ada | Closing/alokasi tidak dapat berjalan |
| `finance_expenses` | Tidak ada | Ada | Pengeluaran sesi tidak dapat berjalan |
| `finance_deposits` | Tidak ada | Ada | Setoran tidak dapat berjalan |
| `finance_drawer_handoffs` | Tidak ada | Ada | Bantu sesi/serah-terima tidak dapat berjalan |
| `finance_refunds` | Tidak ada | Ada | Refund Finance tidak dapat berjalan |
| `open_finance_cash_session(numeric)` | Tidak ada | Ada | Error yang dilaporkan |
| `close_finance_cash_session(uuid,jsonb,text)` | Tidak ada | Ada | Closing gagal |
| `get_finance_session_summary(uuid)` | Tidak ada | Ada | Ringkasan sesi gagal |
| RLS publik | Aktif pada 17 tabel | Aktif pada 30 tabel | RLS ada, tetapi Finance belum ada di Lovable |
| Anonymous EXECUTE helper | Ada | Tidak ada | Hardening wajib ditinjau |

## 5. Dependency graph dan urutan aman

Urutan berikut adalah rencana, bukan instruksi eksekusi.

### Prasyarat

- Target ref dan URL published harus dipastikan sama.
- Backup database/Auth target harus berhasil dan dapat diverifikasi.
- Migration history target harus dicatat.
- Prerequisite dasar harus ada: `user_roles`, `employees`, enum posisi, rooms, room_types, packages, guests, transactions, payments, helper role functions, dan RLS.
- Jangan mengalihkan environment ke staging.

### Rangkaian Finance

1. `supabase/migrations/20261015000000_finance_foundation.sql`
   - finance settings/configuration;
   - bank accounts;
   - cash sessions;
   - allocations, expenses, deposits, refunds, charge events;
   - Finance RPC dasar dan RLS.
2. `20261015000001_finance_150_booking_compatibility.sql`
   - idempotency booking;
   - integrasi pembayaran booking/check-in;
   - guard Finance.
3. `20261015000002_finance_150_supervisor_alignment.sql`
   - akses Supervisor yang disetujui;
   - booking/check-in operator;
   - SELECT RLS Supervisor;
   - Bantu Sesi Aktif sesuai aturan Owner.
4. `20261015000003_booking_reference_read_privileges.sql`
   - hak baca reference data yang dibutuhkan Finance/Booking.
5. `20261018000000_finance_training_enforcement.sql`
   - hanya jika Training harus tersedia pada target;
   - menjaga pemilik sesi dan operator aktual tetap terpisah.
6. `20261019000000_owner_final_numbering.sql`
   - nomor transaksi, pengeluaran, dan housekeeping resmi.
7. `20261019000001_harden_checkout_payment_settlement.sql`
   - settlement dan checkout setelah prerequisite Finance tersedia.

### Pengecualian dan migration drift

- `20261006000010_correct_p4_prices.sql` tetap **terblokir** sampai konflik harga P4 diputuskan Owner.
- Migration lokal memiliki 46 file Supabase SQL dan 7 file SQL Drizzle; jangan menjalankan dua jalur migration tanpa memetakan history target.
- Staging hanya melaporkan 10 migration history dengan nama `p004*`, owner-numbering, dan checkout-hardening. History tersebut tidak identik dengan nama file repository.
- Migration `p004b` muncul beberapa kali dengan version berbeda; perlu rekonsiliasi history sebelum replay.
- Jangan menyalin seluruh schema staging; pilih migration berdasarkan gap target dan dependency yang terbukti.

Tidak ada file SQL baru yang dibuat dalam proposal ini. File migration existing hanya dipetakan untuk review.

## 6. Backup dan recovery

### Sebelum perubahan database

Wajib dibuat oleh Owner/Nurdin atau administrator database:

1. Backup provider/PITR database target Lovable.
2. Schema-only backup.
3. Data backup terkontrol untuk:
   - `auth.users` dengan field minimum yang diperlukan;
   - `public.user_roles`;
   - `public.employees`;
   - tabel Finance yang sudah ada;
   - konfigurasi migration history.
4. Catat checksum, waktu backup, retention, dan lokasi penyimpanan terenkripsi.
5. Simpan mapping `auth.users.id` → `user_roles.user_id` → `employees.user_id`; jangan mengubah UUID akun.
6. Uji pemulihan di database/branch terisolasi, bukan target operasional.

Backup lokal yang sudah ada:

- `BACKUP-CODEX-SEBELUM-SINKRONISASI.zip`: backup kode, 218 entry terbaca.
- `BACKUP-RIWAYAT-GIT-CODEX.bundle`: riwayat Git lengkap dan valid.

Backup lokal tersebut **bukan** backup database/Auth live.

### Dampak sesi login

- Migration additive yang tidak menyentuh Auth biasanya tidak membatalkan JWT.
- Pergantian environment dapat membuat session browser tidak cocok dengan project target.
- Pemindahan target dapat membuat Supervisor tidak dikenali bila `user_roles`/employees tidak dipertahankan.
- Jangan reset password atau membuat akun baru sebagai bagian sinkronisasi.

### Rollback

- Kegagalan dalam satu transaksi migration: rollback transaksi.
- Migration yang sudah committed: gunakan restore PITR/backup atau forward-fix yang diaudit.
- Jangan memakai down-migration destruktif secara blind.
- Jika environment pernah berubah, kembalikan environment hanya setelah kompatibilitas Auth dan data dipastikan.
- Setelah restore, lakukan metadata read-only check sebelum aplikasi diizinkan kembali.

## 7. RLS dan security hardening

### Fungsi SECURITY DEFINER dengan anonymous EXECUTE di Lovable

Fungsi berikut terdeteksi dapat dieksekusi oleh `anon`:

- `can_frontdesk(uuid)`
- `can_housekeeping(uuid)`
- `can_operate(uuid)`
- `can_view_finance(uuid)`
- `can_view_operations(uuid)`
- `has_employee_position(uuid, employee_position[])`
- `has_role(uuid, app_role)`
- `is_receptionist(uuid)`

Usulan minimal, belum dieksekusi:

- revoke EXECUTE dari `anon` dan PUBLIC untuk helper yang tidak perlu menjadi API anonymous;
- pertahankan EXECUTE untuk `authenticated` hanya bila dipakai oleh RLS/RPC;
- pastikan fungsi SECURITY DEFINER memiliki `search_path` aman dan validasi `auth.uid()`;
- jangan membuka direct INSERT/UPDATE/DELETE ke tabel Finance;
- Finance mutation tetap melalui RPC terkontrol;
- verifikasi seluruh policy memakai `TO authenticated`, `USING`, dan `WITH CHECK` yang sesuai.

Staging security advisor juga melaporkan 35 fungsi SECURITY DEFINER yang dapat dieksekusi authenticated. Sebagian adalah RPC operasional yang mungkin disengaja, sehingga perlu review fungsi-per-fungsi, bukan revoke massal.

Leaked Password Protection staging masih disabled. Ini harus menjadi gate Auth terpisah karena dapat memengaruhi password baru/reset password. Tidak diubah dalam proposal ini.

## 8. Rencana test setelah persetujuan

Seluruh tahap berikut menunggu persetujuan Owner dan dilakukan di database/branch terisolasi:

1. Read-only preflight:
   - endpoint target;
   - migration history;
   - tabel/RPC/signature;
   - grants;
   - RLS/policy;
   - role Supervisor/Owner.
2. Apply proposal pada environment terisolasi.
3. Read-only post-check:
   - Finance tables;
   - RPC signatures;
   - authenticated/anonymous grants;
   - RLS;
   - schema discovery.
4. Controlled write test dengan data terisolasi:
   - Owner/Supervisor login;
   - buka sesi;
   - booking/check-in;
   - pembayaran;
   - checkout;
   - closing;
   - validasi pemilik sesi vs operator aktual;
   - validasi audit number/operator.
5. Cleanup hanya pada environment test.
6. Tidak boleh mencampur transaksi test dengan keuangan nyata.
7. Setelah test lulus dan Owner menyetujui, baru rencana release dapat dibahas.

## 9. File dan branch proposal

File yang disentuh oleh PR ini:

- `DOKUMEN_PROYEK/08_PROPOSAL_ISSUE_4_FINANCE_LOVABLE_READONLY.md`

Tidak ada source aplikasi atau migration SQL yang diubah.

Branch:

`proposal/issue-4-finance-sync-readonly`

PR harus tetap **Draft**, tanpa auto-merge.

## 10. GO / NO-GO

**NO-GO saat ini.**

Alasan:

1. Target ref `ijujmxhcifuerkllbbgq` belum dapat diverifikasi langsung dengan akses metadata Supabase.
2. Lovable DB belum memiliki Finance schema/RPC.
3. Staging tidak memiliki employee Supervisor.
4. Migration history repository dan staging tidak selaras.
5. Anonymous EXECUTE pada helper SECURITY DEFINER di Lovable perlu di-hardening.
6. Backup database/Auth live belum dibuat.
7. Belum ada persetujuan untuk migration atau controlled write test.

## 11. Persetujuan Owner yang diperlukan

- Konfirmasi database Lovable sebagai satu-satunya target operasional.
- Konfirmasi identitas ref `ijujmxhcifuerkllbbgq`.
- Persetujuan backup database/Auth dan retention.
- Persetujuan dependency migration Finance.
- Persetujuan hardening anonymous EXECUTE.
- Persetujuan Leaked Password Protection sebagai gate Auth.
- Persetujuan controlled write test di environment terisolasi.
- Persetujuan terpisah sebelum migration, environment change, deploy, atau release.
