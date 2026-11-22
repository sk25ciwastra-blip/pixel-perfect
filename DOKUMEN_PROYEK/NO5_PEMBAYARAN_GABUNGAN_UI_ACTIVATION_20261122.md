# Baturaden 25 Homestay — Nomor 5: Pembayaran Gabungan Dua Metode

**22 November 2026 WIB.** Status: konfigurasi PASS di branch review; BELUM merge, publish, atau aktif pada aplikasi produksi.

## Aturan Owner dan laporan yang dikonfirmasi

Screenshot Receptionist Check-in Langsung (Deluxe, Kamar 05, Paket 2 Jam Weekend Rp100.000) masih menunjukkan **METODE PEMBAYARAN (MAKS. 1)**. Padahal keputusan Owner mengharuskan **maksimal dua metode berbeda dari Cash/QRIS/Transfer** dalam satu proses untuk Check-in Langsung, DP Booking, dan pelunasan Booking. Contoh Rp100.000 = QRIS Rp70.000 + Cash Rp30.000; total lunas dan sisa Rp0. Booking DP minimal 40% mengikuti pengaturan Owner dan CEIL sampai rupiah; Check-in Langsung wajib lunas.

## Akar masalah terverifikasi

Formulir pemesanan, halaman Booking dan library payment-method-choice sudah mendukung maksimum dua metode, nominal terpisah, validasi total dan RPC combined. Namun flag featureFlags.combinedPayment memerlukan tiga konfigurasi Vite yang belum ada di .env pada main, sehingga tampilan masih 'MAKS. 1'.

## Cloud read-only

Pada Lovable Cloud project 017f6e78-15f2-4d07-a38c-87cb185279bf, keempat fungsi create_reservation_combined, create_training_reservation_combined, record_transaction_payment_combined, record_training_transaction_payment_combined tersedia; milik postgres, SECURITY DEFINER, authenticated EXECUTE diizinkan, anon EXECUTE ditolak. Signature fungsi sesuai panggilan frontend. Tidak ada data/SQL Cloud diubah.

## Perubahan minimal dalam PR review

Tambahan tiga variabel di .env tanpa mengubah variabel lainnya:

    VITE_FEATURE_COMBINED_PAYMENT=true
    VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY=true
    VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED=true

Ketiga flag tetap wajib true, sehingga apabila salah satu dinonaktifkan, pembayaran gabungan otomatis OFF. Jangan mengubah flag Extra Guest atau Receipt maupun akses publish audience custom.

## Tes terbaru

[GitHub Actions #45035547940](https://github.com/sk25ciwastra-blip/pixel-perfect/actions/runs/45035547940): **SUCCESS** — 8/8 tes PASS, build Vite PASS dan TypeScript PASS. Menguji flag ON/OFF, QRIS+Cash, QRIS+Transfer, larangan metode ketiga, nominal total, DP Booking 40% CEIL dan jalur gabungan Reservation/Training/pelunasan. Tes tidak memanggil Cloud dan tidak menyimpan pembayaran.

## Gate setelah izin Owner

1. Review diff PR, tandai ready dan merge GitHub main.
2. Cek Lovable latest commit sama dengan main, publish versi baru jika tersedia; status pending tidak berarti sudah tampil di publikasi.
3. Uji sesi Receptionist yang berizin: form Kamar 05 seharusnya menampilkan MAKS. 2, dua pilihan QRIS+Cash masing-masing nominal; QRIS Rp70.000 + Cash Rp30.000 = tagihan Rp100.000, sisa Rp0, tanpa menekan Check-in.
4. Konfirmasi form Booking/DP serta pelunasan juga menampilkan dua pilihan; operasi persisten memerlukan alur bisnis biasa dan otorisasi Owner.

**Nomor 5 tetap belum 100%.** Backend siklus positif Cloud telah PASS sebelumnya dengan ROLLBACK, tetapi aktivasi UI dua metode dan pemeriksaan browser lain masih perlu. Tidak perlu backup, replay Cloud SQL, atau mengulang PR lama.
