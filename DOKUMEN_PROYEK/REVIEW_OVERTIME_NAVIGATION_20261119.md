Panel merah Dashboard kini membuka Kamar dengan filter `bagian=overtime`, menampilkan seluruh kamar aktif TERISI dengan TRX check_in terbaru yang melewati `ends_at` lebih dari 120 menit. Filter ini terpisah dari `perlu` (DIRTY) dan hasil checklist Housekeeping; “Lihat semua” lama tetap menuju `bagian=terisi`, dan daftar terfilter menyediakan kembali ke semua kamar.

Lampu merah kamar overtime berdenyut opacity 1–0,68 selama 3,2 detik melalui CSS. Kartu, border, warna dasar, font, background, ukuran, serta handler transaksi/pembayaran tidak diubah. Lampu hijau tetap statis. `prefers-reduced-motion: reduce` mematikan animasi. Tidak ada JS timer baru.

Validasi 19 November 2026 WIB:
- PASS typecheck (`tsc --noEmit`), build client/server, `git diff --check`.
- PASS uji terarah baru `node scripts/overtime-navigation-ui-tests.cjs`: 4 kamar seluruhnya, ambang ketat >120, status/aktif/deadline, TRX terbaru, tanpa mutasi, navigasi lama dan gating loading/error.
- PASS browser preview terisolasi: JSX panel aktual → route Kamar aktual → 06/07/08/03 (4/4), klik dan Enter; kembali semua kamar; “Lihat semua” lama; popup asli kamar terisi; loading/error tidak mengklaim nol kamar.
- PASS geometri sebelum/sesudah dalam harness dengan viewport/data sama: kartu overtime 119,09375 px; lebar 204,1875–204,203125 px tetap. Computed style lampu overtime animated, kartu dan lampu hijau `none`.
- Aturan reduced-motion diverifikasi pada CSS; preferensi OS browser tidak diubah/dieuji manual.

Bukti sebelum: aplikasi LIVE setelah reload checkpoint PR #86 (`610b7efa`), 4 kamar overtime 03/06/07/08, panel belum berupa tautan. Bukti sesudah: kandidat terisolasi, data sintetis, route dan CSS Kamar aktual, shell navigasi disederhanakan; BUKAN bukti kandidat aktif LIVE. Desktop dan susunan dua kolom 390px diperiksa pada fixture; parity seluruh shell mobile tidak diklaim. Rendering detail transaksi fixture menggunakan stub; tidak ada transaksi/check-out/Cloud dipanggil.

Bukti visual dan langkah verifikasi tercatat di `DOKUMEN_PROYEK/REVIEW_OVERTIME_NAVIGATION_20261119.md`.

PR ini hanya melanjutkan kebutuhan baru setelah PR #84/#85/#86; tidak membawa SQL/PR #83 dan tidak mengulang suite operasional lama. **Jangan merge sebelum persetujuan khusus Owner.** Sesudah persetujuan merge saja dan Sync selesai, lakukan smoke test LIVE baca-saja pada panel → empat kartu, Lihat semua, lampu/reduced motion dan detail TRX; jangan checkout atau menyimpan transaksi. Jika gagal, hentikan aktivasi dan siapkan revert commit PR ini (tanpa reset/history rewrite), minta persetujuan pemulihan.

Visual sebelum — LIVE: https://chatgpt.com/library?file_id=libfile_7125404c886c8191828e75ae3c6dc869&account_id=personal

Visual sesudah — PREVIEW TERISOLASI: https://chatgpt.com/library?file_id=libfile_fd4ff4a6021881919612500951c2a975&account_id=personal

Tidak ada merge/deploy/publish/SQL/perubahan data DEMO/feature flag/kredit Lovable. NO-GO aktivasi kandidat sampai persetujuan Owner; status GO aplikasi keseluruhan tidak berubah oleh tugas UI ini.
