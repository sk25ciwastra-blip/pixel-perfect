# Baturaden 25 Homestay — Audit Migrasi CREATE TABLE dan Gerbang ACL Prospektif

**Checkpoint:** 21 November 2026 WIB  
**Lingkungan:** GitHub branch review saja; **tidak mengubah Cloud, staging, data DEMO, atau migrasi historis**.  
**Status:** **PASS** untuk audit statis dan tes unit prospektif. **Cloud tetap NO-GO**.

## Bukti eksekusi

- GitHub Actions: https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44801724462
- Source checker: `scripts/acl_gate/static_table_acl_migration_gate.py`
- Workflow terisolasi: `.github/workflows/b25-migration-table-acl-static.yml`
- Branch: `validation/b25-acl-pg17-isolated-20261121`
- Skrip menggunakan Python stdlib; hanya membaca berkas SQL di repository. Tidak memakai database, Supabase API, backup, atau koneksi LIVE.
- **Sembilan kasus pengujian parser/gate PASS**: positif; dua REVOKE terpisah; tanpa REVOKE; REVOKE untuk fungsi; REVOKE tabel salah; tanpa transaksi; hanya satu role; REVOKE ALL pada tabel; dua tabel.
- Gerbang file migrasi baru atau diubah: **PASS**, tetapi **tidak ada file migrasi baru/diubah** dalam branch ini; keberhasilan ini tidak boleh ditafsirkan sebagai telah menguji migrasi produksi baru.

## Inventaris source statis (bukan keadaan Cloud)

Dari **70 berkas SQL** di `drizzle/migrations`, `supabase/migrations`, dan `supabase/pending`, ditemukan **37** definisi `CREATE TABLE public.*` top-level.

| Lokasi SQL | CREATE TABLE ditemukan | Explicit same-transaction API TRUNCATE revoke | Belum terbukti terjaga *di berkas yang sama* |
|---|---:|---:|---:|
| drizzle/migrations | 13 | 0 | 13 |
| supabase/migrations | 22 | 0 | 22 |
| supabase/pending | 2 | 1 | 1 |
| **Total** | **37** | **1** | **36** |

- Contoh pending yang **terlindung dalam berkasnya sendiri**: `supabase/pending/20261113150233_overtime_walkin_guard.sql`, tabel `room_overtime_owner_releases`.
- Contoh pending yang **tidak memiliki REVOKE yang dikenali dalam berkas yang sama**: `supabase/pending/20261023_expense_options_and_extra_guest.sql`, tabel `finance_expense_options`.
- Penting: Live catalog tanggal 20 November justru mencatat `finance_expense_options` sebagai salah satu dari enam tabel **tanpa hak TRUNCATE efektif**. Ini contoh nyata mengapa status *file SQL* **tidak boleh disamakan** dengan status LIVE: perubahan dapat datang dari migration lain.
- Beberapa `REVOKE ALL ON FUNCTION ...` pada migration finance, housekeeping, training, dan combined payments **tidak** dianggap proteksi ACL tabel.
- Skrip migrasi historis **tidak diubah** dan tidak dianggap gagal hanya karena pola historis berbeda.

## Makna dan keterbatasan

1. Pemeriksa baru adalah **static heuristic**; tidak membuktikan RLS, setiap policy, hak role `service_role`, default privileges sebenarnya, atau keamanan transaksi aplikasi.
2. Pola validator **prospektif**: setiap `CREATE TABLE public.x` dalam file SQL baru/diubah harus memiliki `REVOKE TRUNCATE ON TABLE public.x FROM anon, authenticated` (atau `REVOKE ALL ON TABLE` bila memang tepat) di **transaksi SQL yang sama**. Pemisahan per-role diperbolehkan. Bila memakai DDL dinamis, DO/function body, schema lain, transaksi dari migration runner, atau layout SQL kompleks, **butuh review manual**; jangan menganggap status PASS sebagai izin eksekusi LIVE.
3. Reviewer wajib memeriksa `GRANT` setelah REVOKE, privilege RLS, urutan DDL, efek role pemilik, serta perilaku aplikasi. Pencegahan ini melindungi tabel yang dibuat dalam migrasi yang memakai pola tersebut; **tidak mengubah default privileges platform**.
4. Pengujian default privileges dan post-COMMIT recovery di PostgreSQL 17 dummy sudah PASS pada run https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44786916998. Pengujian historis tersebut **tidak diulang** dalam audit ini.
5. Belum ada integrasi check pada `main` / branch-protection. Workflow ini **hanya berjalan pada branch review**; perlu peninjauan/izin terpisah sebelum memasukkannya ke pipeline utama. 

## Catatan restore privat

- Library privat menyimpan `Baturaden25_Backup_20261119_0343WIB.zip` dan alat uji lokal, tidak diunggah ke repository atau GitHub Actions.
- Laporan restore sebelumnya hanya membuktikan integritas ZIP/dump, bukan full restore. Uji sebelumnya terhenti karena ketiadaan tool PostgreSQL di lingkungan eksekusi.
- Pada lingkungan model saat checkpoint ini, `pg_restore`, `psql`, `initdb`, `pg_ctl`, `createdb`, dan Docker/Podman **tidak tersedia**. Tidak ada full restore yang dijalankan dalam checkpoint ini.
- Jangan mengganti restore privat dengan pengunggahan dump ke repo publik atau database LIVE/Staging. Verifikasi full restore Supabase-compatible, extension, ownership, Auth/Storage tetap **BLOCKED / NOT TESTED**.

## Keputusan aman berikutnya

Review bersama Owner perlu dilakukan sebelum merge/pemasangan gate ke CI utama. Pengujian backup lengkap memerlukan target PostgreSQL 17 + dependensi Supabase yang kompatibel pada lingkungan **privat terisolasi**; bukan GitHub publik. **Tidak ada izin aktivasi Cloud dari checkpoint ini.**

**Status keseluruhan:** ACL dummy sebelumnya **PASS**, audit migrasi prospektif **PASS (static review only)**, Restore Supabase-kompatibel **belum PASS**, aktivasi Cloud **NO-GO**.
