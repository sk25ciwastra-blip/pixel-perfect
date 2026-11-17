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

## TERHAMBAT — jangan menyatakan READY

Login privat yang dimintaHK pertama masih berakhir sebagaiReceptionist.
Tidak melakukan tindakanHK dengan peran tersebut.
Percobaan privat berikutnya ditolak aplikasi:
'Alamat email atau kata sandi tidak sesuai.'
Tidak mengulang tebakan password, resetakun/password, atau mengubah akses.

SELECT akhir: TRXcheck_out, roomDIRTY, hk_jobs0, checklists0.
Pekerjaan tersisa yang sudah DIIZINKAN adalah login sahHK BTRDEMP-0002/
Dedi Mulyadi, mulai bersihkan -> checklist7 -> selesaiREADY untuk TRX29 ini saja.
Boleh memakai routechecklist yang sudah diketahui sebagai workaround navigasi.
Tidak membuatTRX/sesi/pembayaran baru. Handofflogin privat disiapkan.
Persetujuan skenario tetap berlaku untuk sisaHK; tidak perlu meminta izinDEMO ulang.

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
NOTREACHED: cleanupHK→READY karena autentikasiHK, bukan bukti RPCgagal.
KnownFAILnavigasiHK tetappending. NoGOkeseluruhan.
Persiapanintegrasi tetap6/7=85.7%, bukan kemajuan seluruh aplikasi.
Prioritaslangsung: tuntaskan sisaHK pada TRX29 setelah loginprivat yang sah.
Sesudahnya integrasi9file setelah Supportaman + izinOwnerkhusus.
Tidak merge/deploy/publish/SQLCloud/flag/credit/Connect; tidak menyentuh
TRX27/TRX28 atau menghapus buktidemo. Tidak ada hak untuk mengulangi skenario ini.
