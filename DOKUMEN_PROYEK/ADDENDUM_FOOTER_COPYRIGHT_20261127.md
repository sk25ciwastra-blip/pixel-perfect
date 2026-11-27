# ADDENDUM — FOOTER COPYRIGHT (27 NOVEMBER 2026 WIB)

## Keputusan Owner
Owner meminta implementasi segera footer Copyright Baturaden 25 Homestay mengikuti desain hitam-emas sederhana. Jangan memasang tautan tidak berfungsi. Isi resmi Kebijakan Privasi dan Syarat & Ketentuan belum disahkan; karenanya tidak ada tautan pada footer saat ini.

## Bukti implementasi
- **PR #213:** https://github.com/sk25ciwastra-blip/pixel-perfect/pull/213 — **MERGED** ke `main` tanggal 27 November 2026.
- **Merge commit:** `6563272f45f996aef2bdd80190755423f4057892`.
- **Source yang diubah:**
  - `src/components/footer-copyright.tsx` — Copyright bertema hitam-emas, teks resmi dan tahun otomatis.
  - `src/components/kerangka.tsx` — footer pada halaman operasional; memperhatikan navigasi bawah mobile dan sidebar desktop.
  - `src/routes/auth.tsx` — footer pada halaman login.
- **CI PR:** 16 checks `success`, 1 `skipped`, 0 `failure` sebelum merge.
- **GitHub `main`:** commit `6563272f45f996aef2bdd80190755423f4057892` terbaca setelah merge.
- **Lovable sync:** `latest_commit_sha` saat pengecekan sama dengan merge SHA di atas.
- **Lovable project status:** `needs_attention`, `attentionReason: out_of_credits`. **Sinkronisasi source bukan bukti publish.**
- **Publish:** tidak dilakukan dan tidak dinyatakan PASS.
- **UAT browser LIVE:** belum PASS / belum dapat diverifikasi dari connector; belum ada konfirmasi visual Owner.
- **Ruang lingkup:** frontend saja. Tanpa SQL Cloud, auth, hak akses, transaksi finansial, refund, data UAT, DNS, atau domain.

## Tindak lanjut
1. Setelah kemampuan preview Lovable tersedia, Owner verifikasi posisi/footer di login, Dashboard, halaman lain dan HP (tidak menutupi navigasi bawah). Tandai PASS hanya sesudah bukti visual.
2. Bila ingin tautan Kebijakan Privasi dan Syarat & Ketentuan, siapkan teks yang mencerminkan praktik pengolahan data dan aturan usaha sesungguhnya untuk persetujuan Owner; barulah buat halaman/tautan aktif.
3. Domain & PWA tetap sesuai rencana terpisah untuk 28 November 2026; tidak disentuh pada PR ini.

**Jangan mengulang pekerjaan/footer atau menandai LIVE PASS hanya dari CI dan sinkronisasi source.**

## Revisi final Owner — satu baris (27 November 2026)

Owner meninjau screenshot nyata Dashboard dan menghapus judul brand kedua dari footer. Teks final yang disetujui: `© 2026, Baturaden 25 Homestay. All Rights Reserved.`, dengan tahun yang berubah otomatis.

- **PR #214:** https://github.com/sk25ciwastra-blip/pixel-perfect/pull/214 — **MERGED**.
- **Merge SHA:** `e825cdea08d7edd318b107b7114b5380b97426c0`.
- **File:** hanya `src/components/footer-copyright.tsx`.
- **Desain:** tanpa heading terpisah; satu baris Copyright, sans-serif body standar aplikasi, ukuran 12px, weight 400, tracking normal, warna muted, padding vertikal 12px. Di HP teks boleh wrap saat layar sempit tanpa overflow.
- **CI PR:** 16 SUCCESS, 1 SKIPPED, 0 FAIL.
- **Source GitHub main:** telah diverifikasi berisi versi satu baris.
- **Lovable sinkronisasi:** cek lanjut sesudah merge; jangan klaim sudah sampai Lovable atau published sebelum SHA cocok.
- **UAT visual final / publish:** belum ditandai PASS berdasarkan build atau merge.
- **Batas:** tidak mengubah login, router, sidebar, header, navigasi, data tamu, SQL, finance, PWA, DNS, atau backend.

Catatan: screenshot Owner sebelum revisi memastikan footer lama pernah terlihat di Dashboard; tidak otomatis membuktikan tampilan final sesudah revisi.
