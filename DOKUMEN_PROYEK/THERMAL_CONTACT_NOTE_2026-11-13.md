# Kontak header dan catatan thermal — 13 November 2026

Instruksi Owner: hanya renderer thermal 58 mm. Logo DAILY & WEEKLY tetap
40 mm, terpusat, proporsional, dengan file/ikon/tulisan yang sama.

## Override kontak presentasi

`THERMAL_CONTACT` di `src/lib/receipt-print.ts` menampilkan:

- Jl. Baturaden Raya No. 25, Ciwastra
- Kota Bandung
- WhatsApp: 0811669805

Override ini sengaja mengungguli kontak template/snapshot, termasuk nomor lama
0811669505, pada tampilan thermal saja. Judul identitas tetap dari snapshot.
Tidak ada mutasi template database, snapshot historis atau Cloud. PDF WhatsApp
dan halaman aplikasi tidak berubah. Font kontak 10 px, hitam dan rata tengah;
nama homestay tetap 14 px.

Setelah konfigurasi resmi diselaraskan melalui pekerjaan yang disetujui Owner,
hapus konstanta `THERMAL_CONTACT` dan pulihkan tiga ekspresi header menjadi
`templateHeader.address || h.address`, `templateHeader.city || h.city`, serta
`templateHeader.whatsapp || h.whatsapp`. Sesuaikan tes override pada saat itu.
Dokumen ini tidak mengizinkan perubahan Cloud untuk menyelaraskannya sekarang.

## Catatan tamu

Setelah status, garis footer yang sudah ada mendahului CATATAN (tebal), lalu:

Pembayaran yang telah diterima **_tidak dapat dibatalkan maupun dikembalikan_** dengan alasan apa pun.

Renderer memakai `<strong><em>...</em></strong>` dengan `font-weight:700` dan
`font-style:italic` eksplisit. Awalan/akhiran kalimat memakai font normal.
Ucapan terima kasih Inggris dan nomor permintaan cetak tetap sesudah catatan.
Ini informasi presentasi untuk tamu; aturan refund, akses, transaksi dan hak
konsumen yang diwajibkan hukum tidak diubah oleh renderer atau dokumen ini.

## Pemeriksaan terdampak

- PASS 4 tes terfokus: WALK-IN footer yang terdampak dan header/footer tiga
  variasi. Menguji nomor lama vs override baru, snapshot tidak berubah, redaksi
  tepat, bold italic, satu CATATAN, urutan footer dan logo 40 mm.
- PASS typecheck installed TypeScript `tsc --noEmit`, config sementara extends
  `tsconfig.json`, include `src/lib/receipt-print.ts`, types `vite/client,node`.
- PASS Edge headless lokal: tiga fixture dummy, logo termuat, ukuran artikel
  219.20 px dengan scrollWidth 219 px, logo 151.17 px dan offset pusat 0.
  Kontak hitam/center; catatan satu kali; heading 700, kalimat normal 400,
  frasa penting 700/italic. PDF ketiganya satu halaman dan memuat Arial Bold Italic.
- Suite PASS lain tidak diulang. Tidak ada RPC/database/transaksi untuk preview.

Preview lokal (HTML tanpa JavaScript) berada di
`C:/Users/USER/AppData/Local/Temp/BTRD25-thermal-contact-note-20261113/`:
`01-WALK-IN-LUNAS.html`, `02-BOOKING-DP.html`, `03-BOOKING-PELUNASAN.html`.
Ini folder sementara Windows, bukan aset aplikasi atau file dalam commit.

NOT REACHED: printer fisik, keterbacaan italic pada perangkat 58 mm, panjang
kertas/potongan nyata dan persetujuan visual Owner. Kertas virtual browser
tidak membuktikan hasil cetak fisik.

Tidak ada perubahan perhitungan, RPC, gates, idempotency, SALINAN/COPY,
aturan satu pembayaran satu receipt, aset logo atau fitur lain; tidak ada
Cloud SQL/DEMO/flags, Lovable, merge, deploy atau publish.
