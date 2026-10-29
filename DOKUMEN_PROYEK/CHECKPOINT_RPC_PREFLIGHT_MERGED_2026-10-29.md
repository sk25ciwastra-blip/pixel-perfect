# Checkpoint RPC preflight source — 29 Oktober 2026

**Status: SOURCE MERGED / TES TERBATAS PASS / CLOUD NO-GO.**

## Perubahan yang selesai
- PR #13 https://github.com/sk25ciwastra-blip/pixel-perfect/pull/13 merged ke `main` pada commit `2ea49763d8220e695b0ab3d8ebd31687ab55b3fa`.
- `supabase/reconciliation/rpc_legacy_transition_preflight.sql` kini melaporkan izin EXECUTE efektif untuk signature reservation 10/12/13, payment 3/4/5, dan Training 12/13/5 terhadap PUBLIC, anon, authenticated.
- Hasil laporan: `MISSING`, `EXECUTE_DENIED`, `EXECUTE_GRANTED`; hanya SELECT katalog, tidak menjalankan RPC.
- `scripts/rpc-contract-source-tests.cjs` dan `npm run test:rpc-contract` memastikan argumen kontrak pemanggil frontend Booking/payment mencakup Extra Guest, idempotency, session, Training.

## Bukti uji
- `npm run test:rpc-contract`: PASS pada source branch.
- `git diff --check`: PASS.
- Query lengkap 9 signature × 3 role: SELECT-only PASS di Supabase **Staging** `bgtztcfbkcrvcipxbfti`, hanya validasi SQL. Bukan klaim status produksi Lovable.

## Batasan
- Pemanggil frontend yang diperiksa adalah source repo; konsumen eksternal di luar repo masih BELUM terbukti tidak ada.
- Backup historis Lovable sudah tercatat; restorability terisolasi belum PASS.
- Perbedaan Staging dengan Lovable Cloud wajib dipertahankan.
- **Tidak ada SQL write, REVOKE, migration, deploy, publish, atau perubahan desain.** Legacy revoke tetap tahap paling akhir dan tidak boleh dilakukan sebelum seluruh gate terpenuhi.

## Berikutnya
Selesaikan clearance caller eksternal dan backup/restore terisolasi, lalu preflight Cloud sesuai urutan migrasi resmi. Jangan ulang tes PASS lokal tanpa bukti regresi.
