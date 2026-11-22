# Baturaden 25 Homestay — Nomor 4/10, Sinkronisasi Backend

**Tanggal:** 22 November 2026. **Target Cloud:** Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` saja. **Status:** Audit konektivitas & role PASS; satu perbaikan ACL minimal PASS PostgreSQL 17; belum diterapkan Cloud. **PR DRAFT**, **90%** cakupan Nomor 4.

## Ringkasan bukti langsung

- GitHub `main` dan Lovable source keduanya menunjuk commit **`448c612fd48ae5cfc0bc791f76c8c4db36e47262`** saat audit. Ini **bukan** konfirmasi publikasi produksi; publish audience = custom.
- Audit `pg_proc` Lovable Cloud + pemanggilan dari `src/routes`, `src/components`, `src/lib`: **38/38** kontrak nama RPC + parameter depan + EXECUTE authenticated cocok (11 Booking, 8 pembayaran/struk, 15 Finance, 4 Housekeeping). Catatan: RPC nol-arg `get_finance_training_context()` benar-benar tersedia; PostgreSQL `proargnames`-nya bernilai `NULL`, bukan list kosong.
- **Owner authenticated RLS PASS:** baca transactions (17), payments (24), rooms (12), finance sessions (6), commission configs (1), finance settings (1), housekeeping jobs (5), checklists (6).
- **Receptionist authenticated RLS PASS:** baca sesi kas OPEN miliknya, kamar, transaksi, dan pembayaran.
- **Housekeeping authenticated RLS PASS:** baca kamar, pekerjaan HK dan checklist. Semua simulasi role **SELECT-only** di dalam transaksi `BEGIN … ROLLBACK`; tidak ada mutasi.
- Data Cloud saat audit: 6 Booking, 3 Check-in, 8 Checkout; pembayaran 24 / Rp1.356.000; sesi kas 3 OPEN + 3 FINAL; konfigurasi komisi 1 (mode `PERCENTAGE`); 12 kamar (8 ready, 3 occupied, 1 dirty); 5 HK jobs, 12 riwayat HK, 6 checklist; 2 expenses, 0 deposits, 0 refunds. Ini data DEMO, tidak diubah.
- Fungsi Checkout/Refund No.1, Booking No.2 dan arsip No.3 **tidak diuji ulang**. Pekerjaan ini **bukan** bukti klik aplikasi end-to-end; itu tetap Nomor 5/6/9.

## Gap terkonfirmasi: izin anonim pada fungsi pembantu Training

Lima fungsi internal `SECURITY DEFINER` postgres berikut masih memberi EXECUTE kepada role **anon**, tetapi tidak kepada `authenticated`: `finance_training_assignment_for(uuid)`, `finance_training_context_assignment(uuid,uuid)`, `finance_training_context_matches_session(uuid,uuid)`, `finance_training_context_valid(uuid)`, `finance_training_session_is_valid(uuid,uuid)`.

Khusus `finance_training_assignment_for(uuid)`, fungsi membaca data assignment berdasar UUID parameter tanpa mengharuskan `auth.uid()`—karena itu grant anon langsung tidak seharusnya ada. Lima fungsi tersebut dipanggil oleh fungsi `SECURITY DEFINER` milik postgres; **tidak ada policy RLS publik yang memanggilnya langsung**. Pemanggil aplikasi menggunakan wrapper `get_finance_training_context()` yang tetap berizin untuk authenticated.

### Kandidat koreksi terkecil

`supabase/pending/20261122000004_training_internal_rpc_anon_acl_review.sql`

- Berisi **5 REVOKE EXECUTE FROM anon**, tanpa `CREATE OR REPLACE FUNCTION`, tanpa perubahan Auth/RLS, tanpa perubahan Finance/Training/Booking/Housekeeping atau data.
- `BEGIN/COMMIT`, stop-on-drift atas 5 fingerprint `md5(prosrc)`, security-definer/owner, grant baseline, dan kebijakan RLS.
- `service_role` tetap bisa memanggil, `authenticated` tetap tidak bisa memanggil internal helper secara langsung, `get_finance_training_context()` tetap terbuka untuk pengguna authenticated.
- Uji disposable PostgreSQL 17 **PASS**: 5/5 anon ditolak, wrapper authenticated tetap bekerja, migrasi ulang fail-closed; bukti [GitHub Actions #45027047161](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45027047161).
- **Belum diterapkan** ke Lovable Cloud; per 22 Nov 2026 13:22 UTC seluruh 5 anon grants dan hash masih cocok baseline sehingga preflight Cloud read-only **PASS**.

## Batas & pekerjaan lanjutan

- `combinedPayment`, `extraGuest`, `receipt58mm` menggunakan flag berlapis di `src/lib/feature-flags.ts`. Ketersediaan RPC di Cloud **tidak membuktikan** flag antarmuka di publikasi aktif. Jangan mengaktifkan flag tanpa persetujuan Owner. Mode gabungan/pencetakan fisik diperiksa pada Nomor 5/7 sesuai roadmap.
- Beberapa overload HK dengan argumen `_note` mempunyai grant anon, **tetapi** body memeriksa `can_housekeeping(auth.uid())` atau Owner/Supervisor sebelum perubahan. Untuk Nomor 4, tidak mengubah fungsi HK yang sudah teruji; simpan audit least-privilege sebagai catatan terpisah bila diperlukan.
- Kredensial/env Lovable tidak dibaca atau ditampilkan. Tidak ada akses ke browser berizin untuk uji klik otomatis.
- **Jalur setelah persetujuan Owner:** recheck 5 hash & baseline → jalankan satu SQL pending langsung pada database Lovable yang benar → postcheck anon denied, service_role preserved, function MD5 unchanged, sesi kas/pembayaran/kamar tidak berubah → satu tes wrapper authenticated dengan `ROLLBACK` → merge PR branch ke GitHub main dan konfirmasi source Lovable sinkron. **Tidak perlu publish ulang**, karena ini hanya perubahan izin database dan tidak menyentuh UI.
- Jangan membuat backup tambahan atau menjalankan kembali migrasi Nomor 1–3. Jangan menandai Nomor 4 100% sebelum Cloud ACL dan pemeriksaan akhir benar-benar PASS.

## Checkpoint penerapan final — 100% (22 November 2026, 20:36 WIB)

> Bagian-bagian sebelumnya adalah status **pra-penerapan**; pembatas `belum diterapkan`, `DRAFT`, dan 90% di atas berlaku **sebelum** persetujuan Owner. Status final berikut yang mengungguli status tersebut.

- **Owner telah menyetujui** penerapan SQL PR #105, pemeriksaan Cloud, merge GitHub, dan sinkronisasi sumber Lovable. SQL `20261122000004_training_internal_rpc_anon_acl_review.sql` dari Git blob `14b39cb2f5dfbfb26b2159a016c6955f21694f1b` **sudah diterapkan** satu kali di Lovable Cloud project `017f6e78-15f2-4d07-a38c-87cb185279bf`. **Jangan jalankan ulang**; migrasi sengaja stop-on-drift.
- **Cloud postcheck PASS:** tepat lima helper internal Training tidak lagi bisa dieksekusi `anon`; `authenticated` juga tidak diberi akses helper baru; `service_role` tetap diizinkan. Semua isi fungsi / `md5(prosrc)` tidak berubah, dan wrapper `get_finance_training_context()` tetap diizinkan bagi `authenticated`.
- **Cloud runtime UAT PASS:** pemanggilan internal helper oleh `anon` ditolak dengan `insufficient_privilege`, sedangkan wrapper `get_finance_training_context()` sebagai role `authenticated` berhasil memberikan respons `NONE` untuk akun non-Trainee; seluruh skenario dijalankan dalam transaksi `BEGIN … ROLLBACK`.
- **[PR #105](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/105) MERGED** ke GitHub `main` commit `25a84c2a8ac99a74d119272a94c0b30bde446164`. Lovable `latest_commit_sha` sama dan isi SQL file di Lovable telah dibandingkan dengan GitHub `main`: **sama**.
- **Postcheck integritas data:** 6 Booking, 17 transaksi, 24 pembayaran Rp1.356.000, 6 sesi kas (3 OPEN), 13 karyawan, 1 konfigurasi komisi, 5 HK jobs, 6 HK checklists, 0 private Owner audit event baru, 288 activity logs — semua tidak berubah. Tidak ada data operasional yang dibuat/dihapus.
- **Nomor 4 dari 10 = 100% SELESAI** untuk target audit dan sinkronisasi backend RPC/ACL, dengan batas bahwa pengujian klik end-to-end proses bayar/HK/closing dan feature flags terpisah tetap ada pada roadmap lanjutan. Tidak perlu publish ulang; hanya perubahan izin database, bukan UI. **Tidak perlu backup, migrasi ulang, atau mengulang suite PASS Nomor 1–4.**
