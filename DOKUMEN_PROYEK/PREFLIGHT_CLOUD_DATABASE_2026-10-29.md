# Preflight Cloud Database — 29 Oktober 2026 (SELECT-only)

## Hasil langsung dari Lovable Cloud (project 017f6e78-15f2-4d07-a38c-87cb185279bf)

- `public.transactions`: 11 baris
- `public.guests`: 14 baris
- `public.payments`: 15 baris
- `transactions.price_snapshot`: kolom ADA; 11/11 transaksi memiliki snapshot, jumlah nilai Rp1.040.000 (diverifikasi sebelum ini).
- `transactions.guest_count`: kolom BELUM ADA.
- `create_training_reservation`: 0 definisi (BELUM ADA).
- `record_training_transaction_payment`: 0 definisi (BELUM ADA).
- `payment_receipts`: 0 relasi bernama itu (BELUM ADA).
- `receipt_template_versions`: 0 relasi bernama itu (BELUM ADA).
- `create_reservation`: 2 overload ada.
- `record_transaction_payment`: 3 overload ada.

Query hanya SELECT pada katalog dan tabel; tidak ada schema/data yang dimodifikasi.

## Keputusan NO-GO sementara
- Source `main` sudah merge PR #12, tetapi schema Cloud masih pra-Training/Extra Guest/Receipt.
- Perlu verifikasi identitas proyek produksi, backup yang **teruji restore pada lingkungan terpisah**, audit signature/ACL/RLS/caller eksternal, dan dependency migration sebelum production migration.
- Backup UI terlihat pada screenshot Owner 18–28 Oktober 2026 (terbaru 28 Okt 19:55:33 UTC); keberadaan backup bukan bukti uji restore.
- Jangan terapkan migration legacy EXECUTE revoke lebih awal daripada Training+Receipt+Extra Guest dan caller clearance.
- Staging yang terlihat lewat Supabase connector `bgtztcfbkcrvcipxbfti` **bukan** Cloud produksi Lovable.
