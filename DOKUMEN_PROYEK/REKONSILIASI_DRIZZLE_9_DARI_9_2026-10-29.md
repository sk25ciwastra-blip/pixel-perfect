# REKONSILIASI DRIZZLE CLOUD 9/9 — 29 Oktober 2026

**Semua sembilan entri riwayat Drizzle Cloud telah dipetakan ke jurnal asli.** Sebelumnya 6/9, sekarang 9/9. Ini pemetaan berdasarkan nilai `created_at` yang cocok persis dengan `when` jurnal Lovable. Pemetaan timestamp bukan verifikasi hash SQL 1:1.

## Entri 7, 8, 9 yang teridentifikasi dari source Lovable
- Cloud ID 7 / `1792769178207` = `0006_operational_announcements` (source migration menciptakan `public.operational_announcements`).
- Cloud ID 8 / `1792791432980` = `0007_guest_notes_append_only` (source migration menciptakan `public.guest_notes`).
- Cloud ID 9 / `1792791812094` = `0008_guest_notes_explicit_read_only_grants` (source migration mengatur SELECT authenticated dan mencabut DML).

Jurnal asli `drizzle/migrations/meta/_journal.json` milik Lovable berisi sembilan entries (idx 0–8), semua timestamp persis cocok dengan `drizzle.__drizzle_migrations` Cloud ID 1–9. Query read-only katalog Cloud juga mengonfirmasi relasi `operational_announcements` dan `guest_notes` ada.

## Pengamanan sumber
Branch GitHub **`review/lovable-drizzle-history-20261029`** dibuat dari `main`, berisi salinan langsung migration 0006–0008, meta journal 9 entries, dan snapshot 0006–0008, **tanpa mengubah main atau Cloud**. Branch ini belum dibangun/di-merge; review dulu sebelum merge.

## Gate berikutnya
- Jangan menjalankan ulang 0006–0008 di Cloud; sudah tercatat pada migrator Drizzle.
- Pemetaan migration Drizzle 9/9 **tidak menyiratkan** migrasi SQL `supabase/migrations` Training/Receipt/Extra Guest sudah berlaku; preflight sebelumnya membuktikan beberapa objeknya belum ada.
- Backup UI ada, namun restore terisolasi belum diuji. Legacy RPC caller eksternal dan permission/grant detail masih perlu diperiksa. Migrasi produksi tetap **NO-GO**.
