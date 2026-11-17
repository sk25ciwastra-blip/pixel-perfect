# Baturaden 25 Homestay — Walk-in Cash dan Closing positif

17 November 2026 WIB. Owner mengizinkan SATU skenario baru setelah
preflight di PR83 comment6946146935. Tidak mengulang Booking QRIS lama.

## PASS LIVE LOVABLE yang benar-benar selesai

Receptionist BTRDEMP-0001 / user abb11176-8f20-45f8-8514-5869ff00a9e7.
- Satu sesi baru29d2f77d-9014-4471-bd19-03afdda3270f, opening_cash0.
  opening_source_session_id947a7922-60db-4365-88e8-9fb963386eec sesuai mekanisme
  bawaan sesi FINAL sebelumnya; saldo tetap0. Sesi lama tidak diubah/dibuka ulang.
- Satu Walk-in BTRDTRX-000029 / 1c8a9e0a-e2f9-4cc5-b273-449eb97e22c1.
  Kamar12, Standard/P2, exactly2guests, price_snapshot70000.
  scheduled_check_inNULL; langsungcheck_in/roomoccupied.
- started_at18:04:03.365831WIB, ends_at20:04:03.365831WIB.
- Tepat satu pembayaran 2e1016d1-9109-4453-95c5-850db5757b87,
  methodCash, amount70000, sessionbaru diatas.
  created_by/recorded_by/opened_by semuanya Receptionist yang benar.
- Check-out normal TRX yang sama18:04:45.384428WIB -> roomDIRTY.
- Closing dilakukan saat akunReceptionist masih aktif, sebelum pergantianHK,
  untuk mengurangi permintaan login. Tidak memengaruhi kewenangan/pekerjaanHK.
- SesiFINAL18:05:23.393889WIB; snapshot cash_received70000,
  expected_cash70000,dibawa70000; opening/cash_expenses/cash_refunds/
  setor_cash/setor_transfer/di_laci/transfer_received semuanya0.
- Tepat satu alokasiDIBAWA/CASH70000:
  24e4737d-bcda-4711-9e16-864850997c61.
  created_by/recipient equalsReceptionist; closed_by/snapshot.closed_by sama.
  Handoffs0. Ini dataDEMO, tidak ada uang sungguhan dipindahkan.
- Tidak membuka sesi lanjutan untuk menguji saldo bawaan70000.

## PASS LIVE LOVABLE — Housekeeping tuntas 17 November 2026, 18:43 WIB

Owner berhasil login sendiri menggunakan akun HK baru, HK Work Demo:
BTRDEMP-0003 / user cb898468-3298-4af4-a079-40745e16059a.
SELECT membuktikan active=true, position=housekeeping. Akun dibuat Owner;
agen tidak membuat akun/reset password atau mengubah akun Dedi Mulyadi.

Melanjutkan SISA skenario yang telah diizinkan, tanpa TRX/sesi/pembayaran baru:
- Mulai Bersihkan sekali melalui menu Kamar12 pada akun HK yang benar.
- DIRTY -> CLEANING pada 18:42:47.332297 WIB.
- Job BTRDHK-000004 / 6addd6c8-92dd-41b3-ab99-47398cbeb95d,
  transaction_id=1c8a9e0a-e2f9-4cc5-b273-449eb97e22c1.
- Start history 18a77aa2-8eee-4db2-9753-919f549582c6.
- Checklist ceed9c01-7420-425e-9698-692a30871f08: tujuh jawaban true,
  result=passed, housekeeping_history_id menunjuk start di atas.
- Finish history 2e3d8645-d50d-4654-a2a1-3c68879c3370:
  CLEANING -> READY pada 18:43:35.944880 WIB.
- Job created_by, kedua history performed_by dan checklist performed_by
  semuanya akun HK Work Demo, bukan Dedi atau Receptionist.
- SELECT akhir: roomREADY; tepat satu job, satu checklist, satu start dan
  satu finish pada TRX29. Pembayaran tetap satu, total70000.
- UI menampilkan HK Work Demo / Petugas Kebersihan, antrean kosong,
  Perlu Dibersihkan0, Sedang Dibersihkan0, riwayat Kamar12 Selesai18.43.
- Jawaban checklist adalah data DEMO sintetis, bukan pemeriksaan fisik kamar.
- Tetap memakai route /housekeeping?bagian=checklist karena navigasi checklist
  utama yang diketahui belum diperbaiki di live. Tidak mengklaim navigasi PASS.

Hambatan login sebelumnya selesai melalui login sah akun HK baru oleh Owner.
Skenario Walk-in Cash + Closing positif + HK READY selesai seluruhnya.
Jangan ulangi skenario atau membuka sesi lanjutan (saldo bawaan70000) tanpa izin baru.

## Bug live baru dan kandidat perbaikan

Dashboard TransaksiTerbaru menampilkan pembayaran Walk-in sebagai BOOKING.
Sourceactual3218bd2: mapping semua pembayaran mengisi sub:"Booking",
dan render memakai fallback Booking. CloudTRX29 sendiri benar-benarWalk-in;
tidak ada bug penyimpanan/perhitungan yang ditemukan pada skenario ini.

Repair dalam PR83 yang sama:
- Jika scheduled_check_in tersedia -> Booking.
- Jika tidak ada jadwal dan started_at tersedia -> Walk-in.
- Jika transaksi tidak terbaca/identitas asal belum tersedia -> Pembayaran.
- Fallback renderer juga Pembayaran, tidak mengarang asal.
- Tidak mengubah uang, waktu, akses, RPC, layout atau desain.

Tiga regression casesBARU PASS memakai actual Dashboard mapping dari paket yang
diapply ke pinnedfixture: Walk-in tetapWalk-in (baselineBooking direproduksi),
Booking tetapBooking setelah check-in/checkout, transaksi takterbaca tidak
diklaimBooking/Walk-in. Amount/identity tetap.
Complete candidateTSX syntaxPASS; actualnine-file patch checkPASS terhadap
pinnedsourcehashes. Testrunner sempatgagal karena pemotonghunk menghilangkan
newlineakhir; diperbaiki di runner, bukan sourceaplikasi.
Tidak mengulang suitePASS lama.

Paket tetap9file; hunkDashboard yang sudah ada diperbarui, artifacthashmanifest
ikut diperbarui. SourceGitHub counterpart diperbaiki tanpa menyalin desainLovable.
SUDAH DIPERBAIKI TAPI BELUM AKTIF; Cloudsource tidak disentuh.

## Batas dan prioritas

PASSLIVE: Walk-inCash + Closingpositif.
PASSLIVE: cleanupHK→READY oleh HK Work Demo pada TRX29; tidak ada duplikasi.
KnownFAILnavigasiHK tetappending. NoGOkeseluruhan.
Persiapanintegrasi tetap6/7=85.7%, bukan kemajuan seluruh aplikasi.
Prioritaslangsung: integrasi9file setelah Support mengonfirmasi prosedur aman
untuk repository lama dan arah sync, kemudian izinOwnerkhusus. Tidak ada lagi
sisa transaksiDEMO yang diizinkan untuk dijalankan; bantuan sesi lintas identitas,
closingminus live, SQLpending dan aktivasi source belum diklaim PASSLIVE.
Tidak merge/deploy/publish/SQLCloud/flag/credit/Connect; tidak menyentuh
TRX27/TRX28 atau menghapus buktidemo. Tidak ada hak untuk mengulangi skenario ini.
