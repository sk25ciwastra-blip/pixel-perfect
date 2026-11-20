# Baturaden 25 Homestay — Perbaikan upload foto karyawan

**Checkpoint:** 21 November 2026, code review only. Tidak mengubah database LIVE, Auth, karyawan atau Storage.

## Akar masalah yang terkonfirmasi dari kode
1. Pada form `FormKaryawan` tombol `Unggah Foto` dan `<input type=file>` memiliki `disabled={Boolean(item)}`, sehingga foto **tidak bisa ditambah/diganti ketika mengedit karyawan lama**.
2. Handler upload hanya dijalankan dengan `if (!item && foto && id)`, sehingga **mode edit tidak pernah mengunggah file**.
3. Penyimpanan akun mendahului upload foto dan profil. Jika tahap Storage/profil gagal lalu Owner mengeklik Simpan lagi, kode lama mengulang `createEmployee`, berpotensi gagal karena email sudah ada atau membuat nomor ID baru.
4. Error pemilihan foto >2 MiB / tipe tidak didukung dulu muncul di bawah form panjang, tidak di dekat bagian foto.

## Fakta READ-ONLY Lovable LIVE
- Bucket privat `employee-photos` sudah ada dan membatasi ukuran file 2 MiB.
- RLS Storage owner-only ada untuk `employee-photos`; kebijakan `employee_profiles` owner-only juga ada.
- Pada saat pemeriksaan 0 foto tersimpan di bucket dan belum ada karyawan `B25EMP-`.
- Tidak ada bukti browser yang menunjukkan secara pasti pesan error yang dialami Owner. Pemeriksaan kode menemukan bug nyata tetapi belum membuktikan penyebab tunggal untuk semua kasus foto.

## Solusi kode
- Unggah/Ganti Foto aktif saat form edit; file diproses baik untuk akun baru maupun akun lama.
- Jika akun sudah berhasil dibuat tetapi upload/profil gagal, simpan ID yang sudah terbentuk di memori modal; tombol Simpan berikutnya hanya mengulang foto/profil, **tidak memanggil createEmployee lagi**.
- Pastikan path foto berdasarkan UUID database employee, dengan ekstensi JPG/PNG/WebP terkontrol.
- Validasi file maksimal 2 MiB menampilkan pesan dekat tombol foto; masa berlaku signed URL foto privat untuk edit 60 detik.
- Pendaftaran, login, pengaturan peran, dan data keuangan tidak diubah.

## Bukti pengujian
- GitHub Actions: https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44824272254
- 7 tes fokus `scripts/employee-photo-upload.test.ts` PASS (validasi + kontrak sumber UI).
- `bun run build`: PASS.
- `bunx tsc --noEmit`: PASS.
- Belum uji end-to-end Storage/RLS pada browser Owner LIVE.

**Status:** review ready, belum merge/deploy/publish; operasional tetap NO-GO sampai uji browser dan keputusan Owner.
