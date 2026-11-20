# Baturaden 25 Homestay — Uji ACL PostgreSQL 17 Terisolasi

**Checkpoint:** 21 November 2026, 00:42 WIB  
**Status:** PASS untuk uji ACL pada database dummy GitHub Actions saja. **NO-GO** untuk SQL Cloud / operasional.

## Identitas dan bukti
- Repository: `sk25ciwastra-blip/pixel-perfect`.
- Branch khusus: `validation/b25-acl-pg17-isolated-20261121`.
- GitHub Actions: https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44785789340
- Workflow: `.github/workflows/b25-acl-pg17-isolated.yml`
- Commit yang diuji: `e1a07affda4a1befe7412a38f9be3c9707394d18`
- Kesimpulan GitHub Actions: **success** (run selesai).
- PostgreSQL runtime: **17.12** (major versi 17, image `postgres:17`).
- Server: ephemeral Docker service pada GitHub-hosted Ubuntu, klien memakai `127.0.0.1:55439`; endpoint internal Docker private `172.18.0.2:5432`.
- Database: `b25_acl_dummy` dibuat otomatis oleh container; **bukan LIVE/Staging**.
- Tidak ada koneksi maupun kredensial Cloud pada workflow.
- Main tetap pada `e319d40d4089461ae20694eb06f66a588e3dac46` setelah pengujian.

## Hasil aktual dari log runtime
| Gerbang | Hasil |
|---|---|
| Kecocokan identitas database dummy / PG17 | PASS |
| Fixture 39 tabel, 33 ACL target cocok baseline historis | PASS |
| Target MD5 `b992406a39a1ca0142e56b017e45809b` | PASS |
| Drift guard salah hash menolak sebelum REVOKE | PASS |
| Error paksa setelah REVOKE, sebelum COMMIT | PASS |
| Rollback mengembalikan seluruh fingerprint ACL/default | PASS |
| REVOKE 33 tabel dummy dan COMMIT | PASS |
| TRUNCATE untuk anon/authenticated setelah COMMIT | 0 dari 39 tabel |
| Izin non-TRUNCATE tetap | PASS |
| Enam tabel di luar target tetap | PASS |
| Default ACL sebelum/sesudah tetap | PASS |
| Restore Supabase penuh, Auth, Storage, aplikasi Lovable | NOT TESTED |

Kandidat SQL yang diverifikasi memiliki SHA-256: `a2dde2c93c6fcae9555f6aabd41fb27ddd8ec7acf73b20132239ff184798b0fd` (identik dengan berkas review). Tidak ada modifikasi pada berkas kandidat tersebut. Untuk menjalankan kandidat dalam fixture vanilla PostgreSQL 17, **hanya salinan sementara di runner** yang menyesuaikan literal guard fingerprint default ACL dari baseline LIVE `bed16621c84278837e08965943391d9b` ke fingerprint fixture lokal `2605c8730c7f9563b7fd1630efcff03f`. Artinya bukti ini mengesahkan *perilaku runtime* paket pada database dummy, **bukan** bahwa SQL produksi tanpa adaptasi siap diterapkan.

## Temuan dan pekerjaan lanjutan
1. Default privileges PostgreSQL/Supabase pada `postgres` dan `supabase_admin` masih memberi TRUNCATE pada tabel baru. Paket REVOKE 33 tabel tidak memperbaiki default ACL ini.
2. Verifikasi runtime database saja tidak menggantikan pemulihan Supabase-kompatibel, pengujian aplikasi, RLS/role end-to-end, atau rekonsiliasi data operasional.
3. Sebelum izin aktivasi SQL LIVE: perbarui preflight katalog LIVE terbaru, simpan baseline/recovery yang direview, tentukan dampak aplikasi dan prosedur STOP, serta minta **persetujuan Owner terpisah** untuk masing-masing perubahan.
4. **Jangan** merge branch ini, deploy, publish, menggunakan Staging/LIVE untuk pengujian, atau mengubah data DEMO.

**Ringkasan progres:** Gerbang **uji ACL terisolasi** sekarang 4/4 = 100% persiapan dan runtime dummy PASS. Ini bukan progres keseluruhan produk dan tidak mengubah status **NO-GO Cloud**.
