# Konsep Detail Transaksi dan Detail Housekeeping — Popup Tengah Kompak

Tanggal: 28 Oktober 2026, sekitar 23:10 WIB
Status: KONSEP Owner; BELUM diterapkan di Lovable; belum desain final komprehensif.

## Keputusan / preferensi Owner
- Detail Transaksi **tetap popup/modal di tengah**, bukan panel kanan permanen atau drawer overlay.
- Screenshot Lovable saat ini: popup hitam–emas sangat besar, setiap data berupa kartu bersarang yang lebar, banyak ruang kosong; riwayat pembayaran terdorong ke bawah. Owner ingin informasi lebih **padat, jelas, informatif, terstruktur**.
- Referensi desain panel Detail Booking putih sebelumnya disukai karena hierarki informasi, pengelompokan yang rapi dan kerapatan data, **bukan** karena penempatan di sebelah kanan.
- Berlaku juga untuk **Detail Housekeeping**: modal/popup dan isi lebih ringkas serta efisien untuk kerja staf.
- Jangan mengubah sidebar, header, desain fitur yang sudah disetujui, atau fungsi. Codex = fungsi; Lovable = desain.

## Usulan teknis visual (belum keputusan Owner)
- Popup desktop sekitar 680–760 px; max-height sekitar 85vh, scroll isi saat diperlukan.
- Dua kolom label–nilai yang terstruktur, hindari kotak terpisah per datum; header memuat nomor kamar, transaksi, status.
- Ringkasan nominal terbayar/total/sisa cepat terlihat, diikuti tabel riwayat pembayaran.
- Tampilan hitam–emas tetap; pertimbangkan warm-white #F7F6F3 untuk area tabel bila disetujui secara eksplisit.
- Teks tetap mudah dibaca, minimum area tombol memadai, status/kewenangan menentukan aksi.
- Contoh data pada screenshot bukan perubahan aturan bisnis atau nomorator; gunakan format BTRDTRX-######.

## Tindak lanjut
- Rancang perubahan khusus isi modal berdasarkan screenshot aktual Lovable, jangan mengarang layout seluruh halaman.
- Bandingkan sebelum/sesudah dan minta persetujuan Owner sebelum instruksi implementasi.
