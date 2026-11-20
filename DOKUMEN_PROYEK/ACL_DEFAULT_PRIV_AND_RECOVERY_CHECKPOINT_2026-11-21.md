# Baturaden 25 Homestay — Default Privileges dan Pemulihan ACL (Uji Terisolasi)

**Tanggal checkpoint:** 21 November 2026 (WIB)  
**Status:** **PASS uji tambahan PostgreSQL 17 terisolasi**, tetapi **NO-GO untuk aktivasi Cloud, restore Supabase penuh, dan Operasional Sementara**.

## Ruang lingkup dan pelaksanaan

- Repo: `sk25ciwastra-blip/pixel-perfect`
- Branch review, tanpa merge: `validation/b25-acl-pg17-isolated-20261121`
- Run GitHub Actions baru (bukan pengulangan tes historis): https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44786916998
- Workflow khusus: `.github/workflows/b25-acl-default-and-recovery.yml`
- Test khusus: `scripts/acl_followup/verify_default_priv_and_recovery_pg17.py`
- Database dummy: `b25_acl_dummy` PostgreSQL 17 dari Docker GitHub-hosted; tanpa kredensial / koneksi LIVE atau Staging.
- Kandidat SQL ACL yang diacu: SHA-256 `a2dde2c93c6fcae9555f6aabd41fb27ddd8ec7acf73b20132239ff184798b0fd`; berkas kandidat tidak diubah.
- 39 tabel dummy dipersiapkan dari snapshot metadata, 33 tabel target sesuai baseline historis.
- Penguji sebelumnya (https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44785789340) **tidak diulang**: workflow lama hanya bereaksi terhadap perubahan dalam `scripts/acl/**` atau workflow miliknya, sedangkan pekerjaan ini ditempatkan pada `scripts/acl_followup/**` dan workflow berbeda.

## Hasil runtime baru

| Kasus yang baru diuji | Hasil |
|---|---|
| Isolasi dan identitas PG17 / dummy | PASS |
| Simulasi tabel baru dibuat oleh `postgres` dengan default ACL historis | PASS: `TRUNCATE` diwariskan kepada `anon` dan `authenticated` |
| Simulasi tabel baru dibuat oleh `supabase_admin` dalam fixture | PASS: risiko default ACL yang sama teramati |
| Tabel simulasi yang berisiko | PASS: transaksi di-ROLLBACK; tidak dipertahankan |
| `CREATE TABLE` + `REVOKE TRUNCATE` dalam satu transaksi, dua creator | PASS: tabel aman setelah COMMIT pada dummy |
| Hak `SELECT` pada contoh tabel baru | PASS: tidak ikut dicabut |
| Default privileges | Tetap tidak berubah; risiko untuk DDL baru tanpa pengamanan masih ada |
| Pemulihan ACL **setelah** COMMIT (re-grant terarah pada dummy) | PASS: snapshot *semantik* ACL seluruh 39 tabel kembali cocok |
| Enam tabel non-target | Tetap cocok |
| Restore Supabase Auth / Storage / data / aplikasi | **NOT TESTED** |

Run selesai dengan `success`. Penanda yang tercatat:
`RESULT: PASS FOCUSED DEFAULT ACL AND RECOVERY (ISOLATED ONLY) — CLOUD NO-GO`.

## Penjelasan risiko

1. Keamanan ACL lama untuk 33 tabel telah teruji pada dummy (checkpoint sebelumnya). **Namun itu tidak otomatis mengamankan tabel `public` yang baru dibuat di masa depan.**
2. `ALTER DEFAULT PRIVILEGES` pada `supabase_admin` adalah cakupan yang dikelola platform. Tidak boleh langsung diubah di Lovable/Supabase LIVE hanya atas dasar model fixture.
3. Pola pencegahan yang layak untuk dievaluasi pada setiap migrasi berikutnya adalah `CREATE TABLE` dan `REVOKE TRUNCATE FROM anon, authenticated` **dalam satu transaksi yang sama**, dengan preflight/postcheck, dan RLS serta kebijakan akses yang sesuai. Tes ini tidak menyatakan tabel baru otomatis terlindungi bila pembuatnya lupa menulis `REVOKE`.
4. Pemulihan setelah COMMIT di dummy dilakukan dengan mengembalikan izin semula. **Di LIVE, re-grant izin berisiko bukan rollback otomatis yang aman.** Keputusan pemulihan harus mempertimbangkan insiden, ACL terkini, data, dependensi, penghentian tulis terdampak, serta izin Owner terpisah.
5. Hash default ACL di fixture vanilla PostgreSQL berbeda dari LIVE; untuk menjalankan review candidate dalam dummy, hanya guard pada salinan sementara yang diadaptasi. SQL kandidat asli tidak dimodifikasi. Oleh sebab itu hasil ini bukan verifikasi kesiapan SQL asli untuk eksekusi langsung di LIVE.

## Hal yang belum terbukti

- Pemulihan penuh dari backup PostgreSQL/Supabase termasuk `auth`, `storage`, extensions, role/ownership, dan dependensi.
- Validasi fungsi tombol pada aplikasi Lovable dan perilaku pengguna sebenarnya.
- Kemampuan memulihkan transaksi keuangan/booking/room live setelah insiden.
- Patch default ACL platform-managed (belum dirancang untuk aktivasi).

## Pagar perubahan

- Tidak ada SQL ke Lovable LIVE atau Supabase Staging.
- Tidak ada perubahan data DEMO, Auth, Storage, atau aplikasi.
- Tidak ada merge, deploy, publish, layanan berbayar, atau persetujuan Cloud.
- Laporan ini ditambahkan **hanya pada branch review**.

**Keputusan checkpoint:** Uji ACL terisolasi serta uji risiko default privileges dan rehearsal pemulihan metadata sama-sama **PASS pada dummy**; aktivasi Cloud tetap **NO-GO**. Pekerjaan selanjutnya: menyiapkan gerbang untuk tabel baru dan verifikasi pemulihan Supabase-kompatibel yang benar-benar terisolasi, tidak mengulang tes PASS.
