# Audit Cloud Drizzle, RLS dan historis — 29 Oktober 2026

**Akses SELECT-only ke database Lovable proyek `017f6e78-15f2-4d07-a38c-87cb185279bf`. Tidak ada write/migration.**

## Fakta yang diverifikasi
- `to_regclass('supabase_migrations.schema_migrations')` bernilai NULL: riwayat Supabase CLI tidak ditemukan pada database ini.
- `drizzle.__drizzle_migrations` ada: 9 entri, ID terbesar 9. Hash/created_at dibaca, tetapi hash belum dipetakan ke nama file migrasi repo; jangan menganggap semua SQL Supabase telah diterapkan.
- `public.transactions`, `public.payments`, dan `public.finance_cash_sessions` semuanya memiliki RLS aktif; ditemukan total 5 policy pada tiga tabel tersebut, **belum diaudit detail semantiknya**.
- `check_out_transaction(uuid)`, dua overload `create_reservation` (10 dan 12 argumen), serta tiga overload `record_transaction_payment` (3, 4, 5 argumen) ada dan berstatus SECURITY DEFINER. Hak EXECUTE anon/authenticated belum dapat dipastikan (pemeriksaan diblokir konektor).
- Baseline nilai historis: `transactions` 11, `price_snapshot` NULL 0, total Rp1.040.000.
- Pemeriksaan sebelumnya: `payments` 15, `guests` 14; belum ada `finance_training_assignments`, RPC Training, kolom `guest_count`, maupun tabel receipt yang diperiksa.

## Konsekuensi / gate
1. Jangan menerapkan semua migration berdasarkan nama file; harus rekonsiliasi hash Drizzle dan DDL aktual dahulu agar tidak menggandakan migrasi.
2. SQL legacy 10/3/4 tidak boleh di-revoke sebelum audit caller eksternal dan hak EXECUTE saat ini.
3. Backup UI tersedia, tetapi restore terisolasi belum diuji; belum memenuhi gate migrasi produksi.
4. RLS=ON bukan bukti semua policy aman. Seluruh security-definer dan policy perlu diperiksa sebelum aktivasi.
5. Tahap berikut: mapping 9 entri Drizzle dan audit DDL/permission yang aman, siapkan rencana rollback dan uji restore di lingkungan terpisah.

**Status: NO-GO untuk migrasi produksi; source GitHub sudah merged, Cloud belum.**
