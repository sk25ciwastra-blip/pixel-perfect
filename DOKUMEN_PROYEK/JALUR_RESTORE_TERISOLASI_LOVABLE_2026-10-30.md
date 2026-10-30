# Jalur pemulihan Lovable Cloud yang didukung — 30 Oktober 2026

**Status: METODE RESMI TERVERIFIKASI / EXPORT DAN RESTORE TERISOLASI BELUM DIJALANKAN / CLOUD NO-GO.**

## Sumber primer
Lovable Documentation: https://docs.lovable.dev/features/database-backups

## Fakta resmi
- Backup harian dapat dipulihkan melalui More → Database → Manage → Backups, tetapi **Restore to this backup selalu mengganti database pada project yang sama** dan dapat menghilangkan perubahan setelah tanggal backup. Jangan dipakai sebagai eksperimen di produksi.
- Lovable menyediakan Export project data di More → Database → Manage → Settings → Export project data → Export data → Database → Start export.
- Export berisi schema, data, dan akun Auth termasuk password hashes, berupa arsip PostgreSQL terkompresi yang dapat dipulihkan dengan `pg_restore` ke database terpisah.
- Export selesai akan diberitahukan melalui email dan tersedia di More → Storage. File harus diunduh dan disimpan di lokasi aman terpisah, sebab file di Storage ikut hilang jika database/project dihapus.
- Export tidak mencakup file Storage lain, edge function code, secrets, sign-in provider settings atau API keys.
- Batas yang didokumentasikan: database hingga 15 GB, arsip maksimal 5 GB, satu ekspor per 24 jam.

## Prosedur aman yang belum dieksekusi
1. Memulai export hanya melalui akses berwenang; tidak melakukan Restore di project produksi.
2. Unduh arsip ke penyimpanan privat/terenkripsi; jangan pernah commit atau upload arsip berisi Auth ke GitHub.
3. Buat target PostgreSQL **terisolasi dan kosong** (bukan staging/prod), dengan konfigurasi sesuai format arsip.
4. `pg_restore` dan validasi hasil (schema, Auth relasi, counts, checksum, FK, migration history) tanpa mengaktifkan endpoint publik.
5. Dokumentasikan hasil dan rencana rollback; baru pertimbangkan izin migrasi Cloud secara terpisah.

## Status akses
Konektor Lovable saat ini menyediakan status database dan query SQL, tetapi **tidak menyediakan perintah export/download backup**. Jangan mengklaim export sudah dibuat. Akses UI berwenang diperlukan untuk memulai dan mengambil arsip, dengan persetujuan pengguna bila harus memakai jalur browser fallback.

## Larangan
Tidak ada export, restore, DB write, deploy, migration, perubahan frontend atau desain dalam checkpoint ini. Cloud tetap NO-GO.
