# Baturaden 25 Homestay — Audit ID dan akun karyawan DEMO sebelum pendaftaran asli

**Checkpoint:** 21 November 2026 WIB. **READ-ONLY** di Lovable LIVE. Tidak ada akun Auth/karyawan dihapus, dinonaktifkan, atau diubah. PR #91 telah di-merge secara terpisah ke `main`; **tidak ada deploy/publish**.

## Hasil preflight langsung LIVE
- 11 baris `public.employees`: 9 active, 2 inactive; 11 memiliki tautan `auth.users`.
- 3 ID berformat `BTRDEMP-0001`, `BTRDEMP-0002`, `BTRDEMP-0003`; 0 ID berawalan `B25EMP-`.
- Generator `src/lib/employee-id.ts` dan `src/lib/employee.functions.ts` sekarang memilih angka maksimum `BTRDEMP-XXXX` di tabel `employees` lalu +1. Tanpa perubahan, ID berikutnya **BTRDEMP-0004**.
- `BTRDEMP-0001` memiliki 2 sesi kas, 3 catatan pembayaran, 15 log aktivitas; `BTRDEMP-0002` dan `BTRDEMP-0003` masing-masing berkaitan dengan 2 riwayat Housekeeping; akun `QA-RCP-01` memiliki 1 sesi kas, termasuk sesi OPEN; `RCP001` memiliki 3 pembayaran dan 13 log aktivitas.
- `employees` merujuk `auth.users`; `employee_profiles` merujuk `employees` ON DELETE CASCADE. Banyak tabel keuangan/HK/receipt/audit merujuk user Auth melalui FOREIGN KEY tanpa CASCADE, sehingga penghapusan Auth secara langsung dapat tertolak atau merusak konsistensi. Penghapusan hanya `employees` dapat meninggalkan Auth dan roles yang tetap aktif.
- Ada dua sesi kas OPEN dan transaksi DEMO lama. Jangan memutus jejak operator tanpa menjalankan rencana pembersihan DEMO terpisah.

## Keputusan ID yang belum boleh diasumsikan
- Aturan Owner terdahulu: ID permanen, tidak digunakan ulang. Menghapus baris agar penerbitan `BTRDEMP-0001` berulang bertentangan dengan aturan itu dan menghilangkan bukti pemakaian angka.
- Jalur tercepat tanpa perubahan format: **pertahankan/arsipkan akun DEMO dan terbitkan BTRDEMP-0004** untuk karyawan asli, setelah pemeriksaan akun.
- Alternatif agar karyawan asli mulai urutan 001 tanpa pakai ulang: **namespace baru `B25EMP-001`**, tidak ada yang memakai awalan tersebut di LIVE. Ini membutuhkan persetujuan Owner atas keputusan format **dan** perubahan generator secara teruji sebelum pendaftaran; tetap harus menjaga ledger nomor forward-only.
- Penandaan/penonaktifan akun DEMO dan pemusnahan data identitas/Auth memerlukan cakupan ID yang tepat dan izin Owner tersendiri. Tidak boleh menganggap semua 11 akun DEMO hanya dari pola ID.

## PR #91 yang disetujui
- PR: https://github.com/sk25ciwastra-blip/pixel-perfect/pull/91
- Merge commit `0c642f164c0752647835ab468cdb1ab27274a118` pada `main`.
- 14 test mock Auth PASS + build + typecheck PASS. Tidak ada deploy/publish/Cloud/Auth mutation dari PR tersebut.

**Status:** PASS inventaris dan penjelasan nomor; **NO DATA DELETION**. Menunggu keputusan Owner apakah mempertahankan nomor `BTRDEMP-0004` atau memilih format baru, serta daftar akun yang benar-benar DEMO sebelum tindakan destruktif.
