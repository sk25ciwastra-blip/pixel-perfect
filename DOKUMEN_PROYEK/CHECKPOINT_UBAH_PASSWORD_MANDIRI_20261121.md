# Baturaden 25 Homestay — Self-service Password, Checkpoint 21 November 2026

**Status:** CODE REVIEW READY; test unit 14/14 PASS, production build PASS, TypeScript typecheck PASS. **Belum merge, deploy, publish, ataupun verifikasi Auth LIVE karyawan.**

## Ruang lingkup implementasi
- `src/routes/pengaturan-keamanan.tsx`: halaman Pengaturan → Keamanan → Ubah Password, dengan password lama, baru, konfirmasi, validasi 8+ karakter, penguncian tombol selama proses, pesan keberhasilan/gagal yang tidak memuat password.
- `src/lib/own-password.ts`: verifikasi identitas user login menggunakan `supabase.auth.getUser()`; verifikasi password saat ini dengan `signInWithPassword()` pada email login dan memastikan user ID sama; lalu `updateUser({ current_password, password })` hanya terhadap akun login saat ini. Tidak menggunakan service-role atau query `auth.users` admin. Perubahan sesi login pada verifikasi akun yang sama adalah perilaku dari Supabase Auth yang harus diperiksa di browser saat penerimaan.
- `src/routes/pengaturan.tsx`: Owner melihat seluruh kartu administrasi, karyawan hanya kelompok Keamanan.
- `src/routes/__root.tsx`: memberi akses pada `/pengaturan` dan `/pengaturan-keamanan` untuk karyawan operasional berakun aktif; route lain tetap mengikuti batas akses sebelumnya.
- `src/components/kerangka.tsx`: menu Pengaturan terlihat pada desktop dan mobile untuk seluruh karyawan aktif.
- Tidak mengubah halaman Login, Lupa Password, form pendaftaran karyawan, tarif, sesi kas, atau database.

## Bukti pengujian
- GitHub Actions sukses: https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/44810804785
- `node scripts/own-password-security-tests.cjs`: **14 tes PASS** memakai mock auth, termasuk input invalid, password lama salah, sesi tidak valid, tidak boleh update pada identitas berbeda, respons gagal, dan sukses untuk user yang sama.
- `bun run build`: **PASS**, termasuk pembangkitan routing TanStack.
- `bunx tsc --noEmit`: **PASS**.
- Hanya memakai package `bun.lock` yang sudah ada. Tidak mengganti dependency atau mengunduh layanan berbayar.

## Keterbatasan / kriteria berikutnya
- **Belum diuji di browser Lovable atau dengan akun LIVE.** Perlu uji dengan masing-masing akun Receptionist dan Supervisor yang memang dimiliki operator: berhasil login, ubah password sendiri, keluar lalu masuk dengan password baru, dan password lama tidak lagi berlaku. Jangan menggunakan password asli dalam laporan/chat.
- Perubahan password melalui browser harus tetap patuh pada kebijakan Supabase proyek (mis. panjang minimal, password bocor, reauthentication); pesan kesalahan yang aman mungkin meminta penggunaan Lupa Password jika diperlukan OTP.
- Test simulasi tidak membuktikan mekanisme pengiriman email atau reset password yang sudah ada.
- Persetujuan Owner untuk **merge dan deploy/publish** belum diberikan. Branch ini adalah implementasi CODE ONLY.
- Ini tidak mengubah status keseluruhan Baturaden 25 Homestay yang masih NO-GO operasional sungguhan.

**Kesimpulan:** siap review merge, bukan aktif di LIVE.
