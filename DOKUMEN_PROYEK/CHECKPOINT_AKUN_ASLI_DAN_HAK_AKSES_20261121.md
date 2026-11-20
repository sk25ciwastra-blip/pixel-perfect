# Baturaden 25 Homestay — Pemeriksaan Dua Karyawan Asli & Hak Akses (21 Nov 2026)

## LIVE (READ-ONLY)
- Dua karyawan **B25EMP-001 (Supervisor)** dan **B25EMP-002 (Receptionist)** tercatat ACTIVE, masing-masing punya user Supabase Auth yang confirmed, tepat satu role employee, profil karyawan, dan foto yang benar-benar ada di bucket privat employee-photos.
- Keduanya pada waktu pemeriksaan memiliki **0 Supabase auth.sessions** dan **last_sign_in_at NULL**, sehingga **BELUM TERBUKTI login berhasil**. Jangan klaim PASS alur login.
- Izin berdasarkan fungsi database LIVE untuk Supervisor: can_frontdesk=true, can_housekeeping=true, can_view_finance=true, finance_is_owner_or_supervisor=true, owner=false.
- Izin berdasarkan fungsi database LIVE untuk Receptionist: can_frontdesk=true, can_housekeeping=false, can_view_finance=false, finance_is_owner_or_supervisor=false, owner=false. Receptionist masih dapat mengelola sesi kas miliknya sesuai RPC dan kebijakan khusus sesi, bukan izin keuangan Supervisor.
- Riwayat lama 11 karyawan DEMO masih tersimpan; ada 2 sesi kas lama OPEN, 17 transaksi DEMO dan 24 pembayaran DEMO. Jangan mulai operasional nyata sebelum data lama ditangani.
- Pengecekan fungsi adalah **evaluasi permission untuk account user_id**, bukan sesi JWT login karyawan atau test browser. Tidak ada password yang diakses.

## Bug terkonfirmasi dari kode main
- `src/routes/__root.tsx` untuk Supervisor: `return !['/karyawan','/pengaturan'].includes(pathname)` memberi akses ke hampir semua URL selain yang dikecualikan.
- `src/components/kerangka.tsx` juga memakai negasi daftar pendek, sehingga item future Owner-only bisa muncul tanpa update.
- Halaman Owner-only yang berisiko terbuka lewat URL: `/pengaturan-keuangan`, `/tipe-kamar`, `/paket`, `/daftar-pengeluaran`.
- RLS dan RPC database tetap menjadi pengaman server yang harus tetap diuji; UI routing saja tidak cukup menentukan izin backend.

## Perbaikan kode review
- Modul pure `src/lib/supervisor-routes.ts` berisi allowlist halaman Supervisor: dashboard, kamar, booking, check-in, transaksi, tamu, housekeeping, keuangan, laporan.
- Root route guard dan filter menu berbagi helper yang sama; halaman Keamanan Pribadi tetap memakai ketentuan yang sudah disetujui.
- Tes otomatis fokus direct route denial, owner settings deny, legitimate routes, dan integrasi menu/root.
- Branch: `fix/supervisor-owner-route-guard-20261121`.
- **BELUM MERGE, DEPLOY, PUBLISH, ATAU UJI BROWSER**; data LIVE/Auth/Storage tidak diubah.

## Uji berikutnya oleh staf, bukan ChatGPT memakai password mereka
1. Supervisor B25EMP-001 login dengan email dan password sendiri di aplikasi yang sudah dipastikan kode terbaru; baca menu, verifikasi tab Housekeeping tersedia, Tim & Akses dan pengaturan Owner tidak terbuka, Pengaturan → Keamanan bisa diakses.
2. Receptionist B25EMP-002 login di sesi terpisah; lihat menu Front Desk, tidak bisa masuk Housekeeping atau pengaturan Owner, Pengaturan → Keamanan bisa diakses.
3. Keduanya logout, login lagi; hasil diperiksa lewat Auth last_sign_in_at / sessions dengan SELECT read-only. Jangan kirim password, NIK, atau file identitas.
4. Pemeriksaan sesi kas dan satu-putaran transaksi DEMO hanya setelah reset lama dan izin terpisah; **bukan** pada langkah login awal.

**Status sebelum tes browser:** readiness teknis Auth/role/profil PASS; E2E login/menu masih PENDING; operasional nyata tetap NO-GO.
