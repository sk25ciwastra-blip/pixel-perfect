# Checkpoint Dependency Cloud Training dan Receipt — 30 Oktober 2026

**Status: PRASYARAT OBJEK DASAR TERVERIFIKASI READ-ONLY / MIGRASI TETAP NO-GO.**

## Target
Lovable Cloud `017f6e78-15f2-4d07-a38c-87cb185279bf`, bukan Supabase Staging.

## Hasil SELECT katalog
Ada:
- `public.transactions`, `public.payments`, `public.user_roles`, `public.employees`
- `public.finance_cash_sessions`, `public.finance_reservation_idempotency`
- `public.open_finance_cash_session(numeric)`, family `finance_prepare_payment`
- `public.check_out_transaction(uuid)`, `public.check_in_booking(uuid)`
- family `create_reservation`
- `public.finance_is_booking_operator(uuid)`
- family `calculate_scheduled_booking_times`, `calculate_package_stay_times`
- enum `public.employee_position`, label `supervisor`
- helper `has_role(uuid,public.app_role)`, `has_employee_position(uuid,public.employee_position[])`
- kolom `finance_cash_sessions.opened_by` dan `status`.

Belum ada:
- `public.finance_training_assignments`
- family `create_training_reservation`, `get_finance_training_context()`
- `public.payment_receipts`, `public.receipt_template_versions`.

## Interpretasi
- Objek prasyarat dasar Training dan Extra Guest/Receipt yang diuji tersedia. Ini belum membuktikan kesesuaian body/DDL, RLS, ACL, atau seluruh dependency.
- Tahap additive pertama yang direncanakan tetap Training. Jangan menjalankan ulang fondasi Finance/Drizzle secara membabi buta.
- `npm run test:cloud-order` (PR #14 merged) melindungi urutan file, tetapi tidak menggantikan pengecekan live schema dan restore.
- Migrasi Cloud **NO-GO** sampai jalur backup/restore terisolasi dan preflight lengkap aman, dengan persetujuan Owner khusus untuk write produksi.
- Tidak ada DDL, DML, migration, deploy, atau perubahan desain pada pemeriksaan ini.

Jangan ulang pemeriksaan keberadaan objek di atas tanpa indikasi perubahan schema.
