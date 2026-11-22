# Baturaden 25 Homestay — Preflight Backup Privat 22 November 2026

**Status:** VALIDASI ARSIP **PASS**; RESTORE PostgreSQL **NOT REACHED**; kesetaraan snapshot penuh terhadap LIVE **BELUM PASS**. **NO-GO** untuk SQL Cloud atau cutover DEMO. Pemeriksaan tanpa DML/DDL Lovable. Hanya agregat aman dicatat di repo; **backup mentah tetap di Library privat Owner**.

## 1. Sumber dan identitas

- File Library privat: `pixel-perfect-homestay-hub_261122.backup.zip`, tercatat diunggah **22 Nov 2026 04:28:42 UTC** (11:28:42 WIB).
- ZIP: **944.515 bytes**, SHA-256 `cda81168c80458bed34606e10647ec45bb5330dc49290276d09cfd462493c37a`. ZIP memiliki **1 anggota** tepat bernama `pixel-perfect-homestay-hub_261122.backup`; `ZipFile.testzip()` PASS.
- PostgreSQL custom dump (magic **PGDMP**): **944.337 bytes**, SHA-256 `0abef7098b493fc93d8b6f72adec33c60762b631d69fc8756718a2f99b36c7ef`; archive version **1.16.0**. Header menunjukkan PostgreSQL server **17.6** dan `pg_dump 18.7`.
- Timestamp header: **2026-11-22 04:24:30**, **tanpa zona waktu eksplisit**. Dengan asumsi UTC, ini pukul 11:24:30 WIB, konsisten dengan waktu unggah.
- Parsing lokal non-restore: **89/89 Zstandard frames** berhasil didekompresi, 0 error; **89/89 data blocks** cocok ke satu `COPY` TOC melalui Dump ID, tanpa nilai baris/PII ditampilkan.
- Inventaris TABLE DATA: **40 public**, **27 auth**, **10 storage**, **10 realtime**, **1 drizzle**, **1 vault**. Ini pemeriksaan struktur arsip, bukan bukti extension, RLS, Auth dan Storage sudah dipulihkan.

## 2. Snapshot agregat ZIP dan Lovable Cloud

Cloud dibaca **SELECT-only** pada **22 Nov 2026 09:49:37 UTC** (16:49:37 WIB), proyek Lovable `017f6e78-15f2-4d07-a38c-87cb185279bf`. Semua hitungan yang disajikan di bawah tidak mengungkap identitas tamu atau karyawan.

| Objek / indikator | Baris atau nilai dalam backup | Lovable Cloud |
|---|---:|---:|
| `public.transactions` | 17 | 17 |
| Status `check_out` / `booking` / `check_in` | 8 / 6 / 3 | 8 / 6 / 3 |
| `public.payments` | 24 | 24 |
| Nominal total `payments.amount` | **Rp1.356.000** | **Rp1.356.000** |
| `public.employees` | 13 | 13 |
| ID karyawan asli `B25EMP-` yang juga cocok dengan `auth.users.id` | **2** | **2** |
| `public.rooms` | 12 | 12 |
| `public.finance_cash_sessions` | 6 | 6 |
| Status `OPEN` / `FINAL` | 3 / 3 | 3 / 3 |
| `auth.users` / `auth.sessions` / `auth.identities` | 17 / 32 / 18 | 17 / 32 / 18 |
| `storage.buckets` | 6 | 6 |
| **`storage.objects`** | **6** | **7 — SELISIH 1** |

**Temuan selisih Storage:** pada katalog Cloud, tepat **1 metadata objek Storage** memiliki `created_at` setelah `2026-11-22 04:24:30+00` (jika timestamp backup dianggap UTC), dan waktu metadata objek terakhir adalah **2026-11-22 04:26:22.390879 UTC**. Objek tersebut tercatat **sebelum ZIP selesai diunggah**, tetapi **setelah timestamp dump**. Ini konsisten dengan satu objek baru setelah snapshot dan belum tercakup. Karena waktu dump tidak memiliki offset, penyebab pastinya masih perlu konfirmasi. **Jangan memulihkan backup ini ke LIVE sebagai current-state.**

**Batas perbandingan:** kesamaan hitungan, jumlah uang dan dua referensi karyawan ke Auth bukan pembuktian byte-for-byte atau kesamaan semua row. Bukan bukti Storage object bytes sudah tersimpan dalam PGDMP; database dump biasanya hanya menyimpan metadata objek, bukan file fisik bucket.

## 3. Gerbang pemulihan yang masih terbuka

| Gerbang | Hasil | Makna |
|---|---|---|
| ZIP CRC, PGDMP header/hash, Zstandard 89/89 | **PASS** | Arsip dibaca utuh sebagai kontainer dan blok data terdekompresi |
| 89 TOC/table data + agregat Finance/akun | **PASS pada pemeriksaan terbatas** | Semua blok data terpetakan; hitungan penting cocok |
| Snapshot seluruh Storage dengan LIVE | **TIDAK COCOK** | 6 vs 7 metadata objek; backup mendahului perubahan |
| `pg_restore --list` kompatibel PostgreSQL 18 | **NOT REACHED** | `pg_restore` tidak tersedia pada runtime ini; repo apt tidak dapat di-resolve |
| Restore PG ke cluster privat baru yang terisolasi | **NOT REACHED** | Tidak ada `initdb`, `pg_ctl`, `psql`; belum uji extension/roles/schema/data |
| Recovery Auth, RLS/ACL, Storage bytes, login dan Recovery Point | **NOT REACHED** | Tidak dapat menyimpulkan siap memulihkan aplikasi |
| Migrasi P0 Checkout/Refund pada Lovable | **TIDAK DIIZINKAN/NO-GO** | DRAFT PR #103 adalah source review, belum ada izin Cloud |

**Penting:** skrip restore lama yang tersedia di Library (`b25_restore_windows_portable.py` dan `b25_restore_windows_powershell.ps1`) mengunci SHA backup November 19 dan PostgreSQL **17**. Arsip baru ini berformat **PGDMP 1.16.0** hasil `pg_dump 18.7`; jangan mengganti hash dalam skrip lama dan mengklaim PASS. Untuk membaca TOC dan melakukan restore, gunakan tool `pg_restore` **18.x yang kompatibel**, dan cluster PostgreSQL terisolasi yang sesuai. Script guard dan baseline perlu review terpisah agar tidak menerima backup atau server Cloud yang salah.

## 4. Rekomendasi langkah berikutnya (satu jalur)

1. Ambil backup Cloud **baru sesudah perubahan Storage yang tercatat pukul 04:26:22 UTC** dan simpan privat; verifikasi SHA, PostgreSQL PGDMP, 89+ data blocks, 2 akun asli, sesi kas dan identitas source target.
2. Di mesin/VM terisolasi yang mempunyai `pg_restore 18.x` dan PostgreSQL server sesuai, jalankan `pg_restore --list` dahulu, lalu uji restore satu transaksi penuh dengan `--single-transaction --exit-on-error` dan **tanpa koneksi Lovable/staging**. Jangan mengklaim Auth/ACL parity dari uji `--no-owner --no-acl`.
3. Catat dependensi Supabase yang gagal pada restore dan status Auth/Storage data terpisah, bukan menonaktifkan pengaman demi mengakali PASS.
4. Hanya setelah bukti restore yang cukup, fingerprint/preflight Cloud aktual dan persetujuan Owner khusus penerapan P0, pertimbangkan migrasi Checkout/Refund DRAFT PR #103. Jangan mengulang 4/4 race/tes refund yang sudah PASS.

**Tidak dilakukan:** menjalankan Cloud SQL; mengubah transaksi, pembayaran, refund, kamar, sesi kas, karyawan, jadwal, akun, atau feature flags; mengunduh object bytes Storage; mengunggah file privat ke GitHub; merge, deploy, publish, atau restore ke LIVE/staging.

**Catatan:** semua temuan ini berasal dari analisis backup lokal yang dibaca secara privat dan satu set SQL SELECT-only ke Lovable, bukan hasil `pg_restore`.
