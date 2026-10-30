# Checkpoint jejak pemakaian RPC Lovable Cloud — 30 Oktober 2026

**Status: READ-ONLY SELESAI / BUKTI EXTERNAL CALLER TIDAK KONKLUSIF / CLOUD NO-GO.**

## Target dan metode
- Database operasional Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`, bukan Staging.
- `pg_stat_statements` ekstensi versi 1.11 tersedia. `pg_stat_statements_info.stats_reset` = `2026-09-28 02:10:59.565853+00`; `dealloc` = 0.
- Semua query pemeriksaan SELECT-only. Tidak mengambil teks SQL mentah, identifier tamu, atau payload transaksi; hanya agregat.

## Agregat fingerprint SQL yang menyebut RPC
| Family | Fingerprint | Total calls pada statement terkait |
| --- | ---: | ---: |
| create_reservation | 29 | 58 |
| record_transaction_payment | 16 | 45 |

Klasifikasi token pertama dari fingerprint menunjukkan `CREATE`, `GRANT`, `REVOKE`, `DO`, `WITH`, dan komentar (`--`). **Tidak ada entry yang token pertamanya `SELECT` pada kumpulan fingerprint yang diperiksa.**

## Interpretasi yang benar
- Angka di atas **BUKAN** jumlah transaksi Booking/pembayaran. Banyak entry adalah DDL dan pemeriksaan katalog yang sekadar menyebut nama RPC.
- Statistik statement tidak membuktikan pemanggil eksternal tidak ada; jalur API, normalisasi query, reset historis, dan waktu observasi membatasi bukti.
- Tidak cukup untuk membenarkan `REVOKE` signature legacy 10/3/4.
- Keputusan aman tetap: aktivasi additive Training → Extra Guest → Receipt dan verifikasi; pencabutan EXECUTE legacy hanya tahap terakhir setelah clearance terpisah.
- Backup UI historis dan Drizzle 9/9 sudah diverifikasi pada checkpoint lain; jangan ulang pemeriksaan yang telah selesai.
- Tidak ada perubahan schema/data, akses, migration, deploy, atau desain.

**Next gate:** bukti konsumen eksternal melalui kanal telemetry/runtime yang berwenang (jika tersedia) atau strategi cutover terukur; backup/restore terisolasi tetap harus PASS sebelum write produksi.
