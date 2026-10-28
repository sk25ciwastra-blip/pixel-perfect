# Gate Aktivasi Cloud — 29 Oktober 2026

## Status bukti
- Source PR #12 sudah berhasil merged ke `main` pada `b06d88d465ac0d53c9781224a824a293a1e5465e`.
- Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`: database enabled, stack Supabase.
- Lovable Cloud read-only count: 11 transactions, 15 payments.
- Supabase connector langsung hanya memperlihatkan project **Baturaden-25-Staging**, ref `bgtztcfbkcrvcipxbfti`. **BUKAN** project Lovable Cloud produksi, dan tidak boleh dijadikan target migrasi.
- Percobaan SELECT katalog schema dan sesi kas lewat Lovable ditolak oleh pemeriksaan akses alat; hasilnya **tidak mengonfirmasi** keberadaan atau ketiadaan objek.
- Belum ada dump/restore teruji, preflight lengkap, migrasi produksi atau deploy.

## Urutan gate wajib sebelum Cloud
1. Pastikan target database Lovable Cloud benar (ref/project) dan akses berwenang.
2. Bukti backup yang dapat diunduh dan uji RESTORE terisolasi atau jalur PITR yang telah diuji dengan dokumentasi jelas; jangan menekan Restore pada produksi untuk uji.
3. Jalankan read-only preflight dari `supabase/reconciliation/rpc_legacy_transition_preflight.sql`, schema/RLS/ACL dan snapshot nominal historis pada **database yang benar**.
4. Audit konsumen eksternal RPC 10/3/4; aplikasi lokal tidak punya caller runtime legacy tetapi sistem eksternal belum dinyatakan nol.
5. Pastikan Training RPC dan dependency telah hadir sesuai urutan migrasi; jangan revoke legacy execute sebelum seluruh gate lolos.
6. Setelah persetujuan Owner untuk aksi produksi, lakukan migrasi berurutan dengan catatan migration, verifikasi, smoke test Finance/Training/Extra Guest/Receipt/Booking, dan rencana rollback yang teruji.

**Keputusan teknis: NO-GO untuk migration pada checkpoint ini.** Tidak ada perubahan data dalam audit ini.
