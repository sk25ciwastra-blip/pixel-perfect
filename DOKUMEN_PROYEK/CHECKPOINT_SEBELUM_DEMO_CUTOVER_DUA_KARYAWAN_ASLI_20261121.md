# Baturaden 25 Homestay — Checkpoint pra-reset DEMO setelah dua akun asli (21 November 2026)

## OWNER ALREADY APPROVED
Semua 11 akun karyawan lama dinyatakan DEMO oleh Owner termasuk Hesti Anjani dan Dedi Mulyadi. **Jangan meminta konfirmasi ulang**. Karyawan asli kini ada dua, yaitu `B25EMP-001` Supervisor dan `B25EMP-002` Receptionist.

## PRE-FLIGHT LOVABLE LIVE (READ-ONLY)
Pemeriksaan setelah Owner melakukan login masing-masing akun:
- `public.employees`: 13 total = 11 DEMO legacy + 2 ASLI (jangan ubah).
- `auth.users`: 17 total = 11 terkait karyawan DEMO + 2 terkait karyawan ASLI + 4 akun nonkaryawan (jangan ubah).
- 11 target DEMO mempunyai **0 role Owner**, 3 profil lama, 0 Storage objects owned. **9 auth.sessions DEMO** masih ada (4 akun legacy), sehingga tindakan Admin Auth perlu mengakhiri sesi dan meniadakan akses.
- 2 karyawan ASLI mempunyai 2 profil dan 2 Storage objects `employee-photos`; harus dipertahankan. Akun asli sudah login PASS, menu yang disetujui PASS.
- 23 tabel operasional DEMO terverifikasi **102 baris**, termasuk 17 transaksi, 24 pembayaran, 5 sesi kas (2 OPEN), 19 tamu, 10 housekeeping_history, 8 idempotensi reservasi, 4 housekeeping_jobs, 5 checklist dan lain-lain.
- Tidak ada transaksi/pembayaran dengan `created_at` setelah 20 Nov 2026 00:00 WIB (per preflight SELECT).
- 12 kamar (4 occupied/DEMO, 1 dirty, lainnya READY); 9 paket, 5 tipe kamar, 1 finance settings, 1 commission config, 2 template struk — **seluruhnya dipertahankan**. Kamar DEMO yang semula occupied tidak boleh otomatis dilabel READY tanpa pemeriksaan fisik.
- `public.employee_profiles.employee_id` FK ke `employees.id` ON DELETE CASCADE. Audit kembali dependency utuh sebelum eksekusi reset.

## BLOKER BACKUP BARU
Screenshot Owner menunjukkan backup terakhir **20 Nov 2026 19:57 UTC = 21 Nov 2026 02:57 WIB**. Dua akun asli dibuat pada **21 Nov 2026 sekitar 05:04 dan 05:24 WIB**. Jadi backup yang ditunjukkan **tidak memuat dua akun asli**. Backup custom `pixel-perfect-homestay-hub_261120.backup` juga dari sebelum pendaftaran dua akun asli.

Sebelum penghapusan LIVE, lakukan **Export project data baru** melalui Lovable Cloud → Overview → Advanced settings → Export project data → Export data → Database → Export → Start export. Download melalui Storage. Export database **tidak memuat berkas Storage**, jadi unduh juga foto dua karyawan ASLI secara terpisah dan lindungi privasinya. Satu export per 24h dan konfirmasi pekerjaan selesai sebelum reset.

Dokumen resmi: https://docs.lovable.dev/features/advanced-settings

## PENTING: SCRIPT LAMA DILARANG
`supabase/pending/20261121_owner_approved_demo_cutover_phaseA_ATOMIC.sql` telah dinonaktifkan. Skrip itu mengharapkan 0 akun `B25EMP-` dan 15 Auth users, padahal kini 2 ASLI dan 17 Auth users. **Tidak boleh menjalankan atau mengaktifkan lagi**.

Buat prosedur reset terpisah yang:
- menggunakan manifest **11 ID legacy eksplisit**, bukan `employee_id NOT LIKE 'B25EMP-%'` sebagai satu-satunya kriteria;
- memverifikasi dan mengecualikan tepat kedua UUID karyawan ASLI, 2 foto Storage, 4 akun nonkaryawan, fungsi dan sequence penomoran;
- menghapus hanya 102 baris operasional DEMO yang sudah diaudit, memperbarui kamar DEMO occupied menjadi dirty dengan cek fisik sebelum READY;
- me-revoke akses karyawan DEMO secara aman, dan menghapus 11 Auth users melalui antarmuka Users atau Admin API resmi, **bukan DELETE FROM auth.users**;
- memeriksa dan tidak melanggar sesi Auth/refresh token lama; token JWT yang masih hidup perlu dipertimbangkan setelah penghapusan.
- baru menyatakan PASS bila hitungan akhir dan uji login kembali Owner/Supervisor/Receptionist lolos.

## STATUS
**NO-GO** untuk transaksi nyata. Tidak ada penghapusan yang dilakukan oleh ChatGPT. Alat operasi reset sebelumnya diblokir pemeriksaan keselamatan; tidak boleh diakali dengan pecahan SQL atau tool alternatif. Jalur UI administrator dan export data masih memerlukan tindakan Owner. Tidak ada perubahan pada LIVE.
