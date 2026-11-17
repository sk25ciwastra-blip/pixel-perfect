# Baturaden 25 Homestay — bukti digital setelah Closing

17 November 2026 WIB. Baseline PR83 db7051798573f2beb1e768d5fb1bcd345fa350c6.
Lovable source tetap 3218bd2ebe8fd98a6a046c9fe105d21293de34ca.
Pemeriksaan ini tidak mengulang Booking/Check-in/pembayaran/Check-out/HK/Closing.

## Bukti live akun karyawan

Akun yang terlihat pada browser: DEMO RECEPTIONIST WORK / Resepsionis.
Transaksi yang dipilih hanya BTRDTRX-000028, UUID bbe16673-ac9d-4672-a758-6098dcd08134.
Sesi kas 947a7922-60db-4365-88e8-9fb963386eec sudah FINAL sejak 16:33:03 WIB.

PASS LIVE LOVABLE, ruang lingkup 3/3:
1. Detail transaksi setelah FINAL dapat dibuka Receptionist: status SELESAI,
   tagihan70000, DP28000, total dibayar70000, sisa0; kedua pembayaran QRIS/operator terlihat.
2. Unduh PDF berhasil dari menu Bukti Digital. UI menampilkan 'PDF dibuat'.
   Berkas PDF valid, 1 halaman, 69563 byte.
   SHA256 3923059938c943c271851ecd7153bb0f54e37d7be86111ac3bcac9d9de597fa0.
   Ekstraksi teks memuat BTRDTRX-000028, tamu sintetis DEMO RCP WORK 20261117,
   Room12/Standard/P2, GrandTotal70000/AmountPaid70000/PAID serta dua baris
   histori QRIS28000 dan42000. Check-in15:28/Check-out15:29 sesuai transaksi.
3. Unduh JPG berhasil, UI menampilkan 'JPG dibuat'.
   JPEG valid terdekode, 1684x1191, 263940 byte.
   SHA256 378c9a63aea77db144045f2e00d92e333401380b81f36a8affeeac4405d45e75.
   Ini bukti pembuatan/unduhan dan validitas berkas; bukan persetujuan visual Owner.

Tidak membuka WhatsApp, tidak mengirim pesan/lampiran, tidak membuka dialog cetak,
tidak mengaktifkan flag atau membuat struk thermal.

## Verifikasi tidak memakai nomor struk/salinan

SELECT sebelum: payment_receipts untuk transaksi ini0, receipt_print_requests0.
SELECT sesudah kedua unduhan: receipts0/print_requests0, payments2/paid70000,
sesi tetapFINAL, closed_at tetap2026-11-17T09:33:03.311304Z, expected_cash0.
Tidak menjalankan issue_payment_receipt/request_receipt_print.
PDF/JPG adalah PAYMENT CONFIRMATION dengan histori gabungan,
bukan bukti bahwa ModelA thermal per pembayaran telah aktif.

## Source dan dependensi aktual

- receipt-actions dan receipt-print memerlukan receipt58mm gate.
- Gate membutuhkan VITE_FEATURE_RECEIPT_58MM, VITE_FEATURE_RECEIPT_BACKEND_READY,
  VITE_FEATURE_RECEIPT_OWNER_APPROVED seluruhnya string true.
  Nilai rahasia/env tidak diambil; UI Cetak Struk disabled dengan keterangan
  'Cetak struk 58 mm belum diaktifkan' membuktikan fitur tidak tersedia di preview ini.
- loadPaymentConfirmation memakai auth.getUser, role/active employee,
  tabel melalui RLS dan read_payment_confirmation_refunds STABLE read-only.
  Tidak mensyaratkan sesi kas OPEN; peran aktif dan ledger tetap diverifikasi.
- RPC read_payment_confirmation_refunds aktual tersedia, memiliki pemeriksaan actor,
  role dan Training DENY; complete envelope, payment_count/digest dan ledger_revision.
  Browser loader menghitung digest dan membaca ulang identitas/ledger sebelum unduhan.
- Dua template ACTIVE en/58mm BOOKING/WALK_IN, satu variasi identitas.
- Source payment-confirmation-data.ts di PR83 identik dengan Lovable aktif.
  Tidak diperlukan perbaikan duplikat.
- issue_payment_receipt dan request_receipt_print tersedia di Cloud.
  Pemeriksaan definisi tidak menemukan syarat OPEN untuk non-Training pada jalur
  pembayaran lama, tetapi keberadaan/inspeksi source bukan PASS eksekusi cetak.
  issue membuat snapshot receipt; request menambah print_no di bawah lock receipt.
  Karena keduanya menulis data, tidak dipanggil dalam pemeriksaan ini.

## Perbedaan kontak yang sengaja dipertahankan

PDF/template aktif memakai WhatsApp0811669505; renderer thermal override0811669805.
DOKUMEN_PROYEK/THERMAL_CONTACT_NOTE_2026-11-13.md secara eksplisit menyatakan
instruksi Owner hanya mengubah renderer thermal dan membiarkan PDF/Cloud tetap.
Ini bukan bug baru atau izin mengubah template. Tidak mengubah kontak, desain,
snapshot historis atau keputusan Booking tepat2tamu.
Penyelarasan konfigurasi di masa depan adalah pekerjaan terpisah berizin Owner.

## Status gerbang dan langkah berikut

PASS LIVE: akses detail + unduhan PDF/JPG sesudah Closing (3/3 scoped).
PASS LOKAL/GITHUB: bukti lama tetap berlaku pada scope aslinya, tidak diulang.
SUDAH DIPERBAIKI TAPI BELUM AKTIF: paket9file navigasiHK/konteksFinance dan SQL
identitas Closing serta pending lainnya; pemeriksaan ini tidak mengaktifkannya.
BELUM DIUJI: cetak thermal/penomoran salinan melalui browser/printer fisik,
assistance operator berbeda, closing minus dan concurrency live.

Persiapan integrasi tetap6/7=85.7%; bukan persentase keseluruhan aplikasi.
OverallNO-GO karena gerbang perbaikan/aktivasi yang sebelumnya tetap terbuka.
Prioritas teknis tetap penerapan paket source9file setelah Support mengonfirmasi
re-attachment repository lama dan arah sync aman, lalu izin integrasi khusus Owner.
Pencarian Support terbaru tidak menemukan balasan lebih baru dari17Nov12:07WIB.
Tidak mengirim email atau menekan Connect.

Jika Owner kelak meminta uji thermal, siapkan izin terpisah yang menyebut aktivasi
gate/deployment yang diperlukan dan dua receipt untuk dua payment UUID existing.
Dampak write harus disebut: penerbitan receipt snapshot, print request/nomor salinan,
dan status dialog; browser tidak membuktikan keluarnya kertas. Jangan menggunakan
persetujuan satu DEMO/Closing yang telah selesai sebagai izin aktivasi/print.
