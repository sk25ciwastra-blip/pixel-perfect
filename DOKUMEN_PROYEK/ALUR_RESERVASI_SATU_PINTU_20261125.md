# Keputusan Owner — Reservasi Satu Pintu (25 November 2026)

## Tujuan
Satu proses **RESERVASI** menggantikan dua pintu **RESERVASI** dan **PENAWARAN** di Aksi Cepat Dashboard. Check-in langsung (walk-in), daftar transaksi resmi, dan seluruh fungsi keuangan lama tetap terpisah dan dipertahankan.

## Urutan operasional resmi
1. Calon tamu mengirim **Form Booking WhatsApp** manual kepada karyawan; belum terbentuk transaksi dan kamar belum dikunci.
2. Karyawan membuka **RESERVASI** dari Aksi Cepat lalu memasukkan data tamu, kamar, paket, jadwal, dan nomor WhatsApp; sistem menghitung harga Weekday/Weekend dan DP minimal **50%** sesuai pengaturan resmi.
3. Setelah karyawan menyimpan, permintaan masuk **Antrean Reservasi Menunggu Pembayaran**. Nomor TRX **belum** diterbitkan. Karyawan mengirim rincian harga dan instruksi pembayaran melalui WhatsApp secara manual, kemudian melampirkan **QRIS resmi** (jika metode pembayaran QRIS) dan menandai **Sudah Dikirim** setelah benar-benar mengirim. Mengakses WhatsApp **bukan** bukti sudah dikirim.
4. Kamar **tidak ditahan/terkunci** selama reservasi menunggu pembayaran. Antrean aktif dapat berstatus internal `DRAFT` (belum ditandai kirim) atau `SENT` (menunggu pembayaran).
5. Setelah pembayaran diterima dan diverifikasi, petugas menekan **Telah Dibayar · Verifikasi**. Ini **membuka form pemeriksaan**, bukan otomatis mengesahkan pembayaran. Petugas harus mengisi nominal/metode, memilih sesi kas yang berwenang dan mengonfirmasi verifikasi; transaksi Booking resmi + pembayaran harus dibuat **atomik** di server, termasuk pemeriksaan benturan kamar dan DP minimal. Baru setelah berhasil sistem menerbitkan **nomor TRX** dan mengamankan jadwal.
6. Popup keberhasilan Booking resmi menyediakan bukti digital **PDF atau JPG** untuk **diunduh dan dilampirkan manual** pada WhatsApp; tidak ada pengiriman file otomatis.
7. Jika kamar yang jadwalnya bertabrakan lebih dulu menjadi Booking resmi milik tamu lain, permintaan yang belum dibayar berpindah ke **Reservasi Gagal — Kamar Terpesan**, **hilang dari antrean aktif**, tetapi **tetap tersimpan dalam Riwayat Reservasi** tamu. Apabila uang telah terlanjur diterima namun belum dicatat, lakukan penelusuran pembayaran; jangan menghilangkan bukti ataupun menganggap uang tidak ada.

## Kesesuaian teknis dan status
- Backend **sudah** memiliki tabel/RPC `reservation_offers` / `read_reservation_offers` / `transition_reservation_offer` dan trigger invalidasi benturan. Nama teknis tetap dipertahankan **sementara** demi kompatibilitas dan untuk menghindari migrasi data berisiko hanya karena pergantian label UI.
- `DRAFT` dan `SENT` ditampilkan sebagai antrean **Reservasi**; `CONVERTED` = Booking resmi; `FAILED_UNAVAILABLE` dan `EXPIRED_SCHEDULE` = Riwayat Reservasi Gagal.
- Existing `CheckInBerhasil` / `usePaymentConfirmation` memberikan nomor TRX dan pilihan PDF/JPG; jangan membuat struk baru atau nomor TRX sebelum pembayaran resmi.
- Minimum DP final Owner **50%** dan pembulatan rupiah ke atas.
- **Empat template resmi WhatsApp** tetap dipertahankan. Isi template tahap menunggu pembayaran harus diselaraskan lewat proses Owner yang sudah ada; jangan diam-diam mengganti versi ACTIVE. QRIS resmi belum ditemukan sebagai aset terverifikasi dalam kode aplikasi: **lampiran QRIS manual tetap wajib** sampai Owner menyediakan asetnya. Jangan membuat QRIS palsu atau mengklaim otomatis terkirim.
- Pengiriman WhatsApp dan lampiran PDF/JPG tetap **manual**. Tidak ada auto-message, auto-paid, atau status pembayaran dari sekadar bukti transfer.
- Jalur Checkout/Refund/Closing/Walk-in, komisi, Training, Owner/Supervisor Bantu Sesi Aktif, serta booking resmi historis **tidak boleh diubah**.
- UAT browser Receptionist yang benar dan verifikasi PDF/JPG setelah pembayaran resmi masih **gate terpisah**, bukan dianggap PASS dari tes kode.

## Rilis
PR tahap ini **Draft / HOLD**. Jangan merge, publish, atau mengubah Cloud SQL LIVE tanpa persetujuan eksplisit Owner. Lakukan build/TypeScript, tes kontrak UI, dan pemeriksaan non-regresi sebelum review.
