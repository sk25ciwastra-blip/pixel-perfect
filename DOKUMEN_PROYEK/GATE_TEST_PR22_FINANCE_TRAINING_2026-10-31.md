# PR #22 — Gerbang Uji PostgreSQL Terisolasi (31 Oktober 2026)

**Status:** belum dieksekusi di PostgreSQL. Jalankan hanya pada lab lokal yang sudah ada, bukan Cloud Lovable atau staging. Tidak perlu mengulang backup maupun tes PR #17.

## Prasyarat

- Worktree terpisah branch `fix/training-finance-summary-expected-cash-20261031` dari commit terbaru PR #22.
- Database lab lokal dengan dependency Finance 150 yang berlaku, bukan database produksi.
- Migrasi `20261018000000_finance_training_enforcement.sql` yang diusulkan diterapkan **hanya pada lab lokal**.
- Jalankan `node scripts/training-finance-contract-source.cjs` terlebih dahulu.

## Matriks regresi wajib

1. **Finance cash-only:** sesi dengan opening_cash, pembayaran Cash, QRIS/Transfer, pengeluaran CASH, dan refund CASH. `get_finance_session_summary` harus mempertahankan `expected_cash = opening_cash + pembayaran Cash - pengeluaran CASH - refund CASH`, tanpa memasukkan QRIS/Transfer.
2. **Saldo kas negatif:** contoh opening_cash Rp0, pembayaran Cash Rp0, pengeluaran CASH Rp50.000 → `expected_cash = -50000`, tanpa entri talangan pribadi.
3. **Owner/Supervisor normal:** akses ke sesi kas yang berwenang dan bantuan pembayaran pada sesi aktif milik operator lain tetap berhasil; identitas operator dan pemilik sesi tidak tertukar.
4. **Trainee terawasi:** trainee dengan assignment aktif 2 hari dan konteks sesi Owner/Supervisor yang sah dapat melakukan transaksi yang memang diizinkan dan audit bertanda Training.
5. **Trainee tanpa konteks:** ditolak pada pembayaran, akses sesi pihak lain, dan perubahan/buka/tutup sesi sendiri; penolakan tidak menyisakan transaksi parsial.
6. **Regresi Finance:** transaksi/reprint yang sudah PASS pada PR #17/#21 tidak diulang menyeluruh; cukup smoke test jika migrasi menyentuh fungsi terkait.
7. **RLS/ACL:** login authenticated normal tetap bisa mengakses RPC operasional yang diperlukan; anon tidak diberikan EXECUTE baru.
8. **Kompatibilitas source:** bandingkan hasil JSON summary setelah migrasi dengan kontrak Cloud saat ini, terutama field `expected_cash`, `opening_cash`, `payments_total`, `cash`, `qris`, `transfer`, `commission`, `expenses`, `refunds`, `status`, `snapshot`.

## Kriteria promosi PR

Catat secara eksplisit PASS/FAIL/SKIP beserta error, commit SHA, versi PostgreSQL, dan bukti output. Jangan merge jika ada regresi atau uji runtime belum PASS. Migrasi Cloud/legacy revoke/deploy tetap **NO-GO** dan memerlukan persetujuan terpisah.
