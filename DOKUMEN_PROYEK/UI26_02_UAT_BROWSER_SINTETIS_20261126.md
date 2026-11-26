# UI-26-02 — Uji Browser Sintetis ActionResultDialog

**Tanggal:** 26 November 2026 WIB  
**Status:** rencana CI pada PR; hasil hanya boleh dinyatakan PASS jika GitHub Actions menyelesaikan job secara sukses.

## Tujuan

Tes sebelumnya dalam `B25 UI26-02 Action Result Dialog Review` memeriksa kontrak **source** dan **build/TypeScript**. Tes tersebut bukan bukti bahwa modal dapat dibuka, tombol Tutup bekerja atau tampilan tidak melewati viewport pada browser.

Uji baru memuat **komponen produksi yang sama** `src/components/action-result-dialog.tsx` di halaman QA mandiri `qa/ui26-popup.html`. Halaman ini menggunakan data sukses/gagal **sintetis** dalam React state; tidak ada SDK Supabase, autentikasi, migrasi, pesan WhatsApp, atau write ke data operasional. Server Vite QA hanya membuka `127.0.0.1:4187` dalam job CI.

## Hal yang dapat dibuktikan oleh CI ini

1. Modal awal tertutup, tombol simulasi sukses menampilkan dialog **alertdialog** dengan label/deskripsi.
2. Varian sukses menampilkan ikon hijau, hanya tombol **Tutup**, bukan X, dan warna latar warm cream.
3. Mengklik **Tutup** menutup dialog dan mengembalikan state ke tertutup.
4. Varian gagal menampilkan judul dan ikon merah; tombol Escape juga bisa menutup.
5. Pada desktop `1280×800` dan mobile `375×812`, modal tetap berada dalam lebar viewport.
6. Permintaan nonlokal diblokir oleh browser; JavaScript error pada halaman QA menyebabkan kegagalan tes.
7. Screenshot sintetis disimpan sebagai **artifact GitHub Actions selama 7 hari**, bukan diunggah ke Cloud aplikasi.

## Tidak dibuktikan

- Belum membuktikan popup keenam modul benar-benar muncul dari mutasi nyata pada akun Owner.
- Belum membuktikan hasil gagal/parsial dari RPC, persistensi nilai, status Booking/kamar, atau hak akses akun LIVE.
- Belum membuktikan deploy/publish Lovable, commit yang berjalan di LIVE, atau backup Cloud.
- Bukan izin untuk menjalankan SQL, mengubah tarif, membuat Booking, menghapus Pengumuman, atau mengaktifkan template Overtime.

## File pengujian

- `qa/ui26-popup.html`: halaman QA nonproduksi.
- `scripts/ui26-browser-harness.tsx`: komponen React sintetis.
- `scripts/ui26-browser-vite.config.mjs`: Vite lokal khusus QA tanpa konfigurasi runtime Lovable.
- `scripts/ui26-browser-smoke.mjs`: interaksi Chromium, assert, dan screenshot.
- `.github/workflows/b25-ui26-synthetic-browser.yml`: job CI.
  
**Gate:** merge hanya setelah CI sintetik dan code review PASS serta keputusan Owner. Publikasi Lovable adalah tindakan terpisah. **UI-26-02 keseluruhan tetap PARTIAL** sampai UAT halaman operasional benar-benar dilakukan tanpa risiko data nyata.
