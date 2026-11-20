# Baturaden 25 Homestay — Gerbang Bersih DEMO sebelum Karyawan Asli

**21 November 2026 WIB — pemeriksaan Lovable LIVE READ-ONLY.**  
Data awal dinyatakan DEMO oleh Owner. Tujuan reset adalah memulai operasional bersih tanpa menghapus akun Owner, paket/harga, kamar, atau konfigurasi resmi. **Belum ada penghapusan, perubahan SQL, merge PR #92, deploy, ataupun publish.**

## Hasil query nyata
- Skrip `supabase/reconciliation/demo_employee_auth_cleanup_PREFLIGHT_READ_ONLY_20261121.sql` berhasil dieksekusi di Lovable LIVE.
- 11 baris `public.employees` berformat lama, 0 `B25EMP-`.
- 11 Auth users terkait staf lama, 11 `user_roles`, 3 `employee_profiles`, dan 9 `auth.sessions` terkait staf lama.
- 4 Auth users **bukan** staf pada tabel tersebut; tidak boleh dihapus. Dua dari empat mempunyai role Owner.
- 0 Storage objects dan 0 Storage buckets milik 11 Auth user staf lama. Storage keseluruhan masih berisi 3 objek backup dan 4 bucket; **jangan menghapus backup atau bucket**.
- 17 transaksi, 24 pembayaran, dua sesi kas OPEN, 12 kamar, 9 paket, 5 tipe kamar, 1 finance settings.
- Activity log 281: 129 berjenis entity `transactions/transaction/guests/employees`, 152 terkait `rooms/packages/room_types/operational_announcements`. Sebagian 32 log actor merujuk 11 user staf lama. Tidak aman menghapus seluruh audit tanpa keputusan retensi; sebagian merekam perubahan konfigurasi.
- Empat kamar `occupied` dan satu `dirty` tetap perlu pemeriksaan fisik sebelum kembali READY; **reset database tidak membuktikan kamar telah dibersihkan**.
- Pemeriksaan ACL tetap 0 tabel `TRUNCATE` efektif untuk anon/authenticated.
- Inventaris reset operasional terpisah menunjukkan 23 tabel / 102 baris DEMO dengan 0 FK masuk dari tabel yang harus dipertahankan dan 0 trigger ON TRUNCATE, tetapi belum menguji keseluruhan efek cascade/recovery pada LIVE.

## Urutan eksekusi yang akan diminta izin terpisah
1. Verifikasi **backup LIVE segar yang dapat dipulihkan**. ZIP 19 November masih valid tetapi predates enam SQL LIVE 21 November; belum ada bukti pemulihan penuh Supabase Auth/Storage. Jangan menyamakan screenshot backup dengan restore PASS.
2. Owner menentukan secara eksplisit bahwa **11 baris staf lama dan 17 transaksi/24 pembayaran yang ada adalah DEMO**. Jangan gunakan selector `LIKE '%DEMO%'` untuk menyimpulkan tipe data; gunakan manifest tepat dan guard jumlah sebelum tulis.
3. Kosongkan dependensi transaksi/finance/Housekeeping DEMO secara terkoordinasi berdasarkan 23-tabel audit, tanpa menghapus config atau tanpa mengisi aktor palsu. Cash session `FINAL` memiliki DELETE guard; jangan disable trigger dan jangan memakai TRUNCATE tanpa pengecualian reset yang disadari Owner serta backup segar.
4. Hapus akun staf DEMO menggunakan jalur administrasi Auth resmi (`auth.admin.deleteUser` / console pengelolaan Auth), **bukan** memberi izin umum untuk `DELETE auth.users` / Storage SQL. Periksa 9 sesi terkait dan token lama; Auth delete tidak serta-merta mencabut JWT yang masih berlaku. Jangan menyentuh 4 akun nonstaf.
5. Tinjau 281 `activity_logs`: putuskan apakah DEMO audit diarsipkan, atau dibersihkan secara terarah; pertahankan rekam pengamanan / konfigurasi resmi. Jangan menghasilkan ID referensi yatim.
6. Verifikasi fisik kamar; terapkan perubahan `occupied→dirty→cleaning→ready` melalui mekanisme resmi dan user operator nyata jika relevan. Jangan otomatis menganggap seluruh kamar READY karena reset.
7. Jalankan postcheck: tepat 0 akun staf lama, 0 transaksi/pembayaran DEMO, 0 sesi OPEN historis, 4 Auth nonstaf dan seluruh konfigurasi utuh, 12 kamar/9 paket/5 tipe masih ada, 0 TRUNCATE terekspos; cek no dangling references.
8. SQL pengalokasi nomor B25EMP-001 dari PR #92 adalah migrasi **terpisah** dan masih belum aktif di LIVE. Setelah diizinkan/aktif dan code deployed secara eksplisit, baru lakukan pendaftaran Receptionist 001 dan Supervisor 002. Jangan mulai memasukkan data asli menggunakan generator BTRDEMP lama.

## Keterbatasan akses nyata
- Lovable connector saat ini menyediakan query database tetapi **tidak menyediakan kemampuan backup full restore atau penghapusan Auth via Admin API**.
- Supabase connector akun hanya menampilkan proyek **Baturaden-25-Staging**, **BUKAN** database Lovable LIVE. Tidak boleh memakai Supabase Staging untuk cleanup ini.
- Penulisan SQL langsung pada LIVE masih dimungkinkan secara teknis tetapi belum mempunyai backup titik-kembali segar dan jalur Auth admin atomic; **karena itu belum dijalankan**.

### Referensi
- Perubahan format/sequence: https://github.com/sk25ciwastra-blip/pixel-perfect/pull/92
- Tes nomor dan build: https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44812575009
- Supabase Auth deletion guidance: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase Storage deletion (API only): https://supabase.com/docs/guides/storage/management/delete-objects

**Status keputusan:** DEMO boleh dibersihkan sesuai keinginan Owner; pemilihan target telah selesai READ-ONLY. Belum ada izin untuk reset destruktif tanpa backup segar/prosedur aman atau untuk merge/deploy PR #92.
