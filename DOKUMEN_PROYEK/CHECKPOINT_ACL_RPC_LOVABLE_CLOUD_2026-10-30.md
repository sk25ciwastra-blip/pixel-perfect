# Checkpoint ACL RPC Lovable Cloud — 30 Oktober 2026

**Status: ACL SIGNATURE READ-ONLY TERVERIFIKASI / EXTERNAL CALLER BELUM CLEAR / MIGRASI CLOUD NO-GO.**

## Target benar
- Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` (database operasional), bukan Supabase Staging `bgtztcfbkcrvcipxbfti`.
- Pemeriksaan memakai `lovable_query_database` dengan SELECT terhadap `pg_proc`/ `pg_namespace` dan `has_function_privilege`, tanpa memanggil RPC.

## Hasil aktual
| Signature | anon EXECUTE | authenticated EXECUTE | SECURITY DEFINER |
| --- | --- | --- | --- |
| create_reservation 10 parameter (legacy) | false | true | true |
| create_reservation 12 parameter | false | true | true |
| record_transaction_payment 3 parameter (legacy) | false | true | true |
| record_transaction_payment 4 parameter (legacy) | false | true | true |
| record_transaction_payment 5 parameter | false | true | true |

Kueri berhasil dan mengembalikan lima signature tersebut. Tidak ada kesimpulan tentang signature 13/Training yang tidak muncul pada hasil ini; status absennya telah dicatat pada preflight lain.

## Implikasi dan gate berikut
- Hak EXECUTE legacy pada `authenticated` masih nyata; pencabutan tidak boleh dilakukan sampai seluruh pemanggil eksternal terverifikasi dan kontrak pengganti Training/Extra Guest/Receipt sudah aktif.
- Source RPC preflight baru dari PR #13 telah merged ke `main` pada 29 Oktober. Ini pemeriksaan produksi pertama yang menunjukkan hak EXECUTE secara eksplisit.
- Belum ada bukti nol pemanggil eksternal. Audit frontend di repository tidak otomatis mencakup semua klien.
- Backup UI sudah diperiksa sebelum checkpoint ini; **jangan ulang permintaan screenshot backup**. Restorability terisolasi tetap belum PASS.
- **Tidak ada DDL/DML, REVOKE, deploy, migration, restore, atau perubahan desain.** Status aktivasi Cloud tetap NO-GO.
