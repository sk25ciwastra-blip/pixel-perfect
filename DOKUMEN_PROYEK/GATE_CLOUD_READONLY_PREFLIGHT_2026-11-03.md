# Gate Cloud Lovable — preflight read-only (3 November 2026)

**Baturaden 25 Homestay** · Cloud project `017f6e78-15f2-4d07-a38c-87cb185279bf` · **NO-GO aktivasi Extra Guest/Receipt**.

## Bukti query katalog RPC

Diperiksa langsung pada `pg_proc`, `pg_namespace`, privilege efektif dan `prosecdef` di Cloud Lovable.

| Fungsi | Signature Cloud | Authenticated EXECUTE | Anon EXECUTE | PUBLIC EXECUTE | SECURITY DEFINER |
|---|---|---|---|---|---|
| `create_reservation` | 10 argumen legacy | Ya | Tidak | Tidak | Ya |
| `create_reservation` | 12 argumen (_idempotency_key, _session_id) | Ya | Tidak | Tidak | Ya |
| `check_in_booking` | _transaction_id uuid | Ya | Tidak | Tidak | Ya |
| `get_finance_session_summary` | _session_id uuid | Ya | Tidak | Tidak | Ya |
| `issue_payment_receipt` | Belum ada | — | — | — | — |
| `request_receipt_print` | Belum ada | — | — | — | — |
| `record_receipt_print_result` | Belum ada | — | — | — | — |

Katalog Cloud: `payments`, `transactions` tersedia; tabel Receipt tidak tersedia. `create_reservation` dengan `_guest_count` juga tidak ada.

## Penilaian risiko

1. **Kesesuaian caller legacy:** dua signature `create_reservation` masih dipakai. Migrasi penambahan `_guest_count` **harus mempertahankan signature lama** sampai frontend yang benar-benar deployed dan caller eksternal dipastikan aman. Jangan jalankan `20261022000004_revoke_legacy_rpc_execute.sql` dalam tahap ini.
2. **SECURITY DEFINER:** fungsi operasional berhak istimewa; review ownership, validasi `auth.uid()`, otorisasi kas/supervisor/training, batas idempotency, dan GRANT wajib sebelum aktivasi backend. SELECT privilege efektif mengonfirmasi anon/PUBLIC tidak punya EXECUTE pada fungsi yang sudah diperiksa, tetapi **tidak membuktikan** implementasi semua aturan otorisasi benar.
3. **Receipt:** schema/tabel/RPC belum tersedia, jadi tombol Receipt dan cetak riwayat harus OFF. Per-payment counters dan event audit mesti diuji, termasuk popup diblokir, reprint salinan, serta penanganan refund/closing.
4. **Price snapshot & Finance:** migrasi hanya forward-only; tidak mengubah transaksi historis, status kas, komisi, atau penomoran. Harga Standard P4 Owner-final 90k/100k sudah dicatat di GitHub dan hasil pengujian lokal PASS.
5. **Frontend:** PR #25 sudah merged ke GitHub `main`, namun Lovable source belum disinkronkan. Lovable hanya menambah `src/lib/fitur.ts` terpisah dan **tidak** memakai tiga-gate `feature-flags.ts`; jangan aktifkan sakelar Lovable mandiri.

## Rekomendasi tahap berikutnya (tanpa Cloud write)

- Review migrasi Extra Guest dan Receipt yang sudah ada terhadap schema Cloud dan urutan dependency; siapkan skrip preflight `SELECT` plus rollback/recovery plan.
- Pertahankan overload 10/12 argumen saat menambahkan signature 13 argumen; cek tidak ada konflik overload dan tidak ada penurunan privilege.
- Pastikan frontend Lovable/deployed menggunakan source terbaru dan backend-ready/Owner-approved gate **sebelum** aktivasi. Sinkronisasi source dan publish harus dipisah dari migrasi.
- Jalankan uji end-to-end lokal/staging yang relevan, jangan ulang Finance150/Training yang telah PASS tanpa perubahan berkaitan.
- Minta persetujuan Owner yang spesifik untuk **setiap** Cloud migration/aktivasi/publish.

**Tidak dilakukan**: query write, migrasi Cloud, deployment, publish, atau perubahan role/grant.
