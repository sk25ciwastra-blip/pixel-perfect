# Checkpoint integrasi source Lovable via Codex — 3 November 2026

**Baturaden 25 Homestay**. Lovable credits tidak tersedia; implementasi di **Codex pada worktree terisolasi**, bukan melalui agent Lovable. Status: **proposal / source only / OFF default**.

## Fakta penting
- GitHub main telah menggabungkan PR #21 Receipt, PR #22 Training/Finance, dan PR #24 harga Standard P4 final.
- Source Lovable terakhir dibaca pada commit `b11078fa2eeed75d012c46e1afb82b10abd68df6` (Lovable last edit 2 Nov); belum sama dengan GitHub main. Tampilan Lovable adalah baseline visual yang harus dipertahankan.
- Lovable `formulir-pemesanan.tsx` masih memblokir Extra Guest dan tidak mengirim `_guest_count`; `detail-transaksi.tsx` tidak memuat tombol Receipt. Dua file Receipt GitHub belum ada di Lovable.
- Cloud Lovable tidak memiliki RPC 13 parameter reservasi dengan `_guest_count` ataupun tiga RPC Receipt. **Jangan aktifkan fitur sampai aktivasi backend melalui gerbang dan persetujuan Owner**.

## Perubahan source yang diizinkan
1. Buat feature flags Extra Guest dan Receipt 58 mm, **OFF jika env tidak ada**; jangan menganggap hanya keberadaan kode berarti aktif.
2. Satukan fungsi Extra Guest (2 tamu dasar, tambahan Rp50.000/orang), total, snapshot, minimum DP 40% atas grand total, dan `_guest_count` **hanya pada jalur flag ON**; jika OFF tetap mengikuti perilaku lama. Tidak boleh mengubah harga.
3. Bawa fungsi receipt per-payment dengan copy label/reprint, popup aman, pembayaran sejarah Booking tanpa metode; semua tombol/action hanya dirender ketika flag ON.
4. Preserve JSX, className, tata letak, teks, struktur responsif, dan desain Lovable. Patch hunk logika selektif, **jangan replace keseluruhan komponen dengan versi GitHub**.
5. Hanya branch/worktree source; tes TypeScript, build, dan unit/contract yang relevan. Tidak perlu mengulang tes Finance150/Training yang sudah PASS tanpa perubahan berkaitan.

## Larangan
- Tidak boleh migration Cloud, penulisan DB, deploy, publish, ubah secrets, ganti backend, merge otomatis, atau revoke legacy RPC.
- Jangan menyentuh worktree main atau memaksa sinkronisasi GitHub → Lovable.
- Jika baseline source Lovable belum tersedia secara lengkap di worktree Codex, **STOP dan laporkan gap**; jangan mengarang atau menyamakan GitHub main dengan Lovable.

## Gate berikutnya
PR source proposal → review diff desain dan hasil build → persetujuan Owner → setelah RPC Cloud siap dan terverifikasi, aktivasi flags terpisah → tes end-to-end/publish terpisah.
