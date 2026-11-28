# ADDENDUM PWA — 28 NOVEMBER 2026 (WIB)

## Keputusan Owner
Owner menyetujui pembangunan fondasi Progressive Web App (PWA) Baturaden 25 Homestay sebelum membeli domain. Domain khusus belum tersedia. PWA bersifat online-only untuk operasi penting; tidak ada persetujuan transaksi offline, penyimpanan tamu offline, atau mutasi Cloud.

## Implementasi source dan bukti
- **PR #215:** https://github.com/sk25ciwastra-blip/pixel-perfect/pull/215 — **MERGED**.
- **Merge commit:** `0a0d4932fde1509567c9571ce7a1049eb3d2e698`.
- **CI:** 20 checks SUCCESS, 1 SKIPPED, 0 FAIL sebelum merge; termasuk `pwa-foundation`, build dan typecheck.
- **Manifest:** `public/manifest.webmanifest` — nama/short name, ID/start/scope root, standalone, tema hitam, bahasa Indonesia.
- **Ikon resmi:** `public/pwa/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, dibuat dari gambar sumber resmi `public/assets/Logo_Resmi_BTRD25_Transparan.png` oleh `scripts/generate-pwa-icons.py`. Simpan sumber ini untuk reproduksi jika identitas diubah Owner.
- **Offline aman:** `public/sw.js` dan `public/offline.html`. Service worker hanya meng-cache halaman pemberitahuan offline; semua navigasi normal memakai network dan tidak meng-cache HTML operasi, API, sesi, tamu, booking, transaksi atau kas. POST tidak diintersep. Tidak ada sinkronisasi finansial offline.
- **Registrasi PWA:** `src/lib/pwa.ts` dan `src/routes/__root.tsx`. Tidak mengubah `AccessGate`, `PeranProvider`, ataupun flow operasional.
- **Tests:** `scripts/pwa-foundation.test.cjs`, `.github/workflows/b25-pwa-foundation-review.yml`.
- Tidak mengubah SQL, data Cloud, pengaturan finance, feature flags, DNS, PWA/domain production publish atau data UAT.

## Status yang wajib dibedakan
- **GitHub source:** MERGED dan terverifikasi di `main` setelah merge.
- **Lovable source sync:** pengecekan pertama sesudah merge masih menampilkan SHA lama `857217d4b06b2084e9eefabf1de0e746027d1c64` dan `needs_attention/out_of_credits`. Belum boleh dinyatakan sinkron sampai `latest_commit_sha` cocok dengan HEAD baru.
- **Publish:** tidak dilakukan.
- **UAT di browser/HP:** belum PASS. Uji berikutnya: HTTPS, GET manifest dan gambar PNG 192/512/maskable, devtools Installability, sw.js scope, layar standalone, Android & Windows, offline banner saja, pemulihan koneksi, serta login/logout/role pada data aman tanpa transaksi baru.
- **Domain:** pending pembelian; instalasi untuk karyawan disarankan setelah domain final tersedia supaya tidak menggandakan instalasi dari host Lovable.

## Tindak lanjut
1. Verifikasi Lovable sinkron dengan SHA terbaru setelah kredit/preview kembali siap.
2. Periksa halaman sumber `/manifest.webmanifest`, `/sw.js`, `/offline.html` dan ketiga PNG lewat HTTPS pada versi preview yang bisa diakses. Catat hasil browser sebagai PASS/FAIL, tidak menyamakan dengan CI.
3. Hubungkan domain setelah dibeli dengan perubahan DNS dan pengujian HTTPS; tidak perlu membangun ulang PWA.
4. Uji instalasi di HP dan komputer setelah domain stabil. Jangan aktifkan offline write, push otomatis, atau cache data operasional tanpa keputusan Owner.
