# CHECKPOINT AUTHORIZATION COMBINED PAYMENTS — 4 NOVEMBER 2026 WIB

**Proyek:** Baturaden 25 Homestay  
**Status:** **11/11 PASS LOKAL berdasarkan laporan Codex**, belum deploy/Cloud/GO-LIVE.  
**Prioritas Owner:** mencapai **100% Siap Operasional Sementara**; pekerjaan desain 7 fitur Lovable ditunda sementara pemilik workspace belum merespons. Jika workspace tersedia, perbarui dokumen serah-terima sebelum pindah.

## Pengujian authorization yang BARU selesai
| No. | Skenario | Hasil |
|---:|---|---|
| 1 | ACL `authenticated` / `anon` | **PASS** — authenticated EXECUTE, anon DENIED |
| 2 | Owner combined payment | **PASS** |
| 3 | Supervisor membantu sesi Receptionist | **PASS** |
| 4 | Receptionist normal | **PASS** |
| 5 | Training Day 1 | **PASS** — 2 pembayaran, audit Training |
| 6 | Training Day 2 | **PASS** — 2 pembayaran, audit Training |
| 7 | Training direct RPC tanpa wrapper | **PASS** — ditolak atomik |
| 8 | Training memakai sesi Owner yang salah | **PASS** — ditolak atomik |
| 9 | Training membuka sesi sendiri | **PASS** — ditolak |
| 10 | Housekeeping akses reservation/settlement | **PASS** — ditolak atomik |
| 11 | Supervisor menunjuk Owner sebagai penanggung jawab | **PASS** — ditolak |

- Dual identity **PASS**: Supervisor sebagai `recorded_by/operator`, pemilik sesi `opened_by` tetap Receptionist.
- Audit Training memuat operator trainee sebenarnya, supervisor, sesi dan label **Training**.
- Penolakan atomik tidak meninggalkan guest, transaction, payment, batch idempotency atau audit parsial.
- **Log:** `C:\tmp\combined-authz-lab-20261104-080000\authorization-runtime-test-clean.log`.
- **Harness tambahan:** `scripts/combined-payments-authorization-runtime-tests.sql`.
- PostgreSQL 17.11 asli dan salinan tes **berhenti aman** (`pg_ctl: no server running`).
- Tidak ada source aplikasi/migration lain diubah, tidak ada commit/push/PR/Cloud write/aktivasi produksi.
- Catatan Codex: checkpoint tepat tidak tersedia pada worktree lokal; Codex menggunakan aturan Owner resmi dan checkpoint gate terdekat. Jangan jadikan itu alasan mengulang hasil PASS; repo GitHub dan disk Windows perlu diperlakukan terpisah.

## Hasil sebelumnya — jangan diuji ulang tanpa regresi
- Bootstrap DB lokal; Booking DP, Check-in langsung, pelunasan masing-masing dua payment; retry/tamper, atomic rollback, concurrent clients same-key, receipt per payment 58mm metadata dan original/COPY, Cash/QRIS dasar **PASS**.
- Finance lanjutan **PASS lokal**: komisi persentase Rp200.000 x 8% = Rp16.000, refund Rp20.000 menurunkan komisi Rp2.000 menjadi Rp14.000, full refund net Rp0; per kamar Rp15.000 satu kali, partial refund tetap, full refund Rp0.
- Rekonsiliasi Cash dan QRIS masing-masing Rp110.000, operator Owner terpisah dari pemilik sesi Receptionist, expected cash Rp122.345, refund Owner Funds tidak mengubah FINAL snapshot, kekurangan kas ditolak. Log `C:\tmp\combined-finance-lab-20261104-070000\finance-runtime-test-final.log`.
- Konkurensi dua koneksi: `CONCURRENCY_TEST_PASS`, log `C:\tmp\combined-bootstrap-20261104-055303-541\concurrency-20261104-064817`.

## CHECKPOINT PEMBEKUAN dan satu pekerjaan berikutnya
**STOP pengujian pembayaran gabungan yang sudah PASS.** 
1. **Inspeksi dan kemas source pada worktree Codex yang sudah ada**, branch lokal `feat/combined-payments-20261104`, path `C:\tmp\pixel-perfect-combined-payment`. Mulai dengan `git status --short --branch`, `git diff --stat` dan daftar file untracked. **JANGAN reset/rebase/overwrite**, jangan mencampur `.bak`, runner sementara, atau log dengan source.
2. Cocokkan diff dengan aturan Owner AB-PAY-004; pastikan hanya kode gabungan, migrasi SQL, dan test harness yang layak masuk review. Jalankan pemeriksaan sumber minimal terpengaruh, **bukan rerun penuh test PASS** tanpa perubahan kode.
3. Siapkan hasil review berisi **file yang siap commit, risiko produksi tersisa, kebutuhan integrasi GitHub–Lovable–Supabase**, dan rencana satu PR. **Jangan commit/push/PR/merge tanpa izin Owner berikutnya**.
4. Gate operasional sementara berikutnya (setelah review source): audit **terarah ke gap nyata** kesiapan aplikasi aktif, khususnya Booking/Check-in/Check-out timing, Housekeeping, fungsi yang belum deployed, dan kesiapan backup/rollback. Tidak menyatakan GO-LIVE karena PASS lab ≠ PASS Cloud.
5. Saat Lovable workspace kerja siap, baca `DOKUMEN_PROYEK/CHECKPOINT_SERAH_TERIMA_WORKSPACE_LOVABLE_2026-11-04.md`: desain 7 fitur dalam workspace sementara, baru pindah ke workspace pribadi, lalu verifikasi ulang koneksi GitHub/Supabase read-only tanpa migrasi duplikat.

## Larangan
Jangan merge implementasi otomatis, aktifkan flag produksi, jalankan migrasi Cloud, deploy, publish, revoke legacy RPC, overwrite worktree dirty atau memindahkan workspace tanpa persetujuan Owner tersendiri. Nama merek selalu **Baturaden 25 Homestay**.

**Kalimat melanjutkan chat:** “Baca CHECKPOINT_AUTHORIZATION_COMBINED_PAYMENTS_2026-11-04.md dan ARAH_KERJA_AKTIF_MENUJU_OPERASIONAL_SEMENTARA_2026-11-04.md. Semua 11 skenario auth, Finance, Receipt SQL, dan concurrency PASS lokal. Jangan ulang PASS. Mulai dari review source/worktree gabungan dan persiapan satu PR, tanpa merge/deploy.”
