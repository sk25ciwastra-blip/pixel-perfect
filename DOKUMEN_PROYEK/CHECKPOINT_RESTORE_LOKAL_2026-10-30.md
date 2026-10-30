# Checkpoint uji pemulihan export Lovable — 30 Oktober 2026

**Proyek:** Baturaden 25 Homestay  
**Lingkungan:** Windows Owner, PostgreSQL Portable 17.11, **lokal terisolasi** `127.0.0.1:55432`; tidak ada restore, migrasi, atau perubahan Cloud.  
**Sumber:** Laporan keluaran PowerShell Owner pada 30 Oktober 2026.  
**Status:** **PASS terbatas untuk pemulihan data aplikasi dan integritas 59 FK; restore penuh seluruh stack Supabase BELUM PASS.**

## Hasil nyata

1. Export Lovable diunduh sendiri oleh Owner: `pixel-perfect-homestay-hub_261030.backup.zip`; ZIP berisi `pixel-perfect-homestay-hub_261030.backup` (745.249 byte).
2. `pg_restore --list` dengan PostgreSQL Portable 17.11 berhasil, exit 0.
3. Cluster baru `isolated-data` dibuat melalui `initdb`; server hanya mendengarkan `127.0.0.1:55432`.
4. Restore seluruh dump ke PostgreSQL biasa terhenti pada extension `supabase_vault` yang tidak tersedia; **jangan salah label sebagai arsip rusak**.
5. Restore schema `public` lokal dengan `--no-owner --no-acl` dan fungsi kompatibilitas **khusus lab** `auth.uid() RETURNS NULL::uuid` berhasil memuat data utama, lalu awalnya terhenti pada FK ke `auth.users`.
6. `auth.users` struktur dan data dipulihkan dari dump ke lab; tabel mengandung **11 baris**; primary key `users_pkey` dipulihkan tersendiri dari TOC.
7. 59 constraint FK `public` dipulihkan dari TOC dengan `--single-transaction`; exit 0. Validasi `pg_constraint`: **59 total, 59 valid, 0 belum valid**, exit 0.
8. Hitungan data lokal: `public.transactions=11`, `public.payments=15`, `public.rooms=12`, `public.guests=14`. Transaksi dan pembayaran sesuai hitungan Cloud read-only sebelumnya (11/15). `finance_bank_accounts=0`; hasil orphan 0 pada tabel kosong **bukan** bukti relasi berisi data.
9. Server lab dihentikan dengan `pg_ctl -m fast -w stop`; **STOP EXIT CODE 0**. Data lab lokal tetap disimpan.

## Pembatasan hasil

- **PASS:** pemulihan data utama yang dihitung, 11 baris `auth.users`, primary key `auth.users`, dan 59 FK `public` valid.
- **BELUM PASS:** seluruh extension/roles/event trigger Supabase (`supabase_vault` dan lain-lain), layanan Auth operasional, Storage/Realtime/Edge, semua routine/ACL dan uji aplikasi end-to-end. Stub `auth.uid()` lokal tidak boleh dipakai untuk login atau pengujian RLS/otorisasi.
- Dump dapat berisi hash autentikasi/data pribadi: **jangan unggah ZIP/dump, log sensitif atau hasil restore ke GitHub/ChatGPT**. Hanya ringkasan non-rahasia ini boleh disimpan.
- Tidak ada klaim seluruh backup sepenuhnya dapat dipulihkan ke Supabase atau aplikasi siap go-live.
- **Tidak perlu mengulang** unduh, ekstraksi, `pg_restore --list`, validasi 11/15/12/14 atau 59 FK pada chat berikutnya tanpa bukti regresi.

## Gate berikutnya

1. Catat checkpoint ini sebagai selesai untuk cakupan **restore data aplikasi lokal**; perlakukan uji restore **Supabase penuh** sebagai pekerjaan berbeda bila diperlukan.
2. Untuk deployment migrasi Cloud Extra Guest/Receipt/Training, tetap wajib verifikasi pemanggil RPC legacy eksternal, runtime revoke, preflight/approval Owner, dan rencana rollback. Jangan deploy otomatis.
3. Codex = fungsi/migrasi/tes; Lovable = desain. Pekerjaan PASS lokal bukan berarti aktif di Lovable Cloud.
