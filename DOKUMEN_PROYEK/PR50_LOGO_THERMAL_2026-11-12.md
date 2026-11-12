# Logo thermal PR #50

Tambahan pada branch `fix/thermal-receipt-layout-20261112`, setelah review
`758d58f`. Hanya logo header thermal; layout tiga variasi dipertahankan.

- Sumber Owner: `C:/Users/USER/Downloads/logo_homestay_baturaden_25.png`.
  Salinan byte-identik: `public/assets/receipt-thermal-logo-source.png`.
  SHA-256: `637f1889886e78e9c19dee5f5cf88e10ee0ef5b9b0b039032511c0e0a2fc975d`.
- Aset cetak: `src/assets/receipt-thermal-logo-monochrome.png`, 1239 × 496,
  PNG grayscale 1-bit, 7.7 KB. Hanya diimpor oleh `receipt-print.ts` memakai
  `?inline`; HTML hasil cetak berisi data URI lokal, tanpa permintaan gambar eksternal.
- Reproduksi: `node scripts/prepare-thermal-logo.cjs`. Komposit putih,
  threshold luminance 180, crop ruang putih dengan margin 8 piksel sumber.
  Tidak ada resampling, penggambaran ulang, penggantian huruf/font atau ikon.
  Badge biru menjadi hitam, centang tetap putih; DAILY & WEEKLY tetap utuh.
- Tampilan: lebar 50 mm di area isi 53 mm; tinggi proporsional sekitar 20 mm,
  maksimum 21 mm. Gambar eager/synchronous decode, tidak diberi page break.

## Verifikasi tambahan

- PASS tes terfokus logo untuk WALK-IN lunas, BOOKING DP, BOOKING pelunasan,
  escaping yang terdampak penambahan gambar, serta batas header/aset monokrom.
  Suite lain yang sudah PASS tidak diulang.
- PASS typecheck installed TypeScript `tsc --noEmit` dengan config sementara
  extends `tsconfig.json`, include `src/lib/receipt-print.ts`, types
  `vite/client,node`; config dihapus setelah pemeriksaan.
- PASS Edge headless pada tiga fixture lokal terisolasi: logo termuat;
  lebar artikel 219.20 px, scrollWidth 219 px, logo 188.97 × 75.64 px.
  Tidak ada overflow horizontal. PDF dari HTML renderer asli masing-masing
  satu halaman, tanpa halaman kosong tambahan pada fixture.
  Fixture pengukur awal menambah elemen setelah article dan menghasilkan
  halaman ekstra; ekspor final memakai HTML renderer asli tanpa instrumentasi.
- PASS pemeriksaan visual file monokrom: tulisan dan ikon utuh.
- PASS source hash sama dengan file Downloads; tidak ada aset/logo lama dihapus.

NOT REACHED: printer fisik 58 mm, keterbacaan hasil cetak perangkat nyata,
kesesuaian final dengan gambar Library asli, dan persetujuan visual Owner.
PDF headless memakai kertas virtual browser, bukan bukti panjang potong printer.

RPC, angka/perhitungan, snapshot, gates, copies, idempotency dan satu receipt
per pembayaran tetap. Tidak ada perubahan logo global/PDF WhatsApp/UI lain,
Cloud/SQL/DEMO/flags, Lovable, merge, deploy atau publish.
