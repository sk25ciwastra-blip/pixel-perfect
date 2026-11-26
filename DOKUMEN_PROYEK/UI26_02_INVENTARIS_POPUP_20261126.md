# Baturaden 25 Homestay — Inventaris popup hasil tindakan UI-26-02

**Tanggal audit source:** 26 November 2026 WIB.
**Basis:** repository `sk25ciwastra-blip/pixel-perfect` pada `main` commit `8a779d43ad29bbecfab24b1b5741ca43c391a73d` sebelum implementasi tahap keenam. Status tiap poin di bawah adalah **pemeriksaan kode**, bukan UAT LIVE.

## A. Sudah diintegrasikan ke komponen resmi

| Tahap | Modul | PR | Status kode | Bukti visual Owner |
| --- | --- | --- | --- | --- |
| 1 | Pengaturan → Rekening Owner | #191 | MERGED | PASS visual **sukses tambah rekening** saja |
| 2 | Pengaturan → Profil Homestay | #192 | MERGED | Belum UAT visual |
| 3 | Pengaturan → Manajemen Kamar | #193 | MERGED | Belum UAT visual |
| 4 | Pengaturan → Minimum DP & Komisi | #194 | MERGED | PASS visual **sukses simpan konfigurasi** saja |
| 5 | Pengaturan → Template WhatsApp | #195 | MERGED | Belum UAT visual |

Popup result resmi: `src/components/action-result-dialog.tsx`. **PASS source/CI ≠ PASS visual/persistensi.** Popup gagal, tombol Tutup yang benar-benar diklik, verifikasi data setelah reload, dan kasus tersimpan sebagian belum semuanya UAT.

## B. Inventaris belum memakai dialog hasil resmi

| Modul/file | Temuan saat audit | Kategori | Keputusan |
| --- | --- | --- | --- |
| `src/components/papan-informasi.tsx` | Tambah/ubah/hapus Pengumuman Owner memakai pesan hasil inline; hapus memakai `window.confirm` | **Hasil aksi & konfirmasi terpisah** | **Tahap 6 pada PR terpisah:** integrasikan hasil tindakan saja; **pertahankan konfirmasi sebelum hapus** dan pastikan hasil setelah readback |
| `src/components/reservation-offer-queue.tsx` | Toast pada tanda sudah dikirim, pembatalan permintaan, dan penyalinan | Hasil status reservasi **berisiko state**; copy clipboard adalah umpan balik ringan | HOLD penggantian status sampai kontrak transition `SENT/CANCELLED`, no-Booking dan modal teruji. Toast salin **tetap** agar tidak mengganggu alur |
| `src/components/formulir-pemesanan.tsx` | Toast sukses/gagal pada konversi reservasi dan Booking; ada komponen bukti `CheckInBerhasil` | **Transaksi/Booking, sensitif** | HOLD. Jangan mengganti popup/receipt Check-in, Reservasi, Booking atau alur pembayaran sebagai pekerjaan kosmetik |
| `src/components/reservation-whatsapp-message.tsx` | Toast setelah teks berhasil disalin | Umpan balik clipboard | Pertahankan toast ringan, tidak perlu popup modal |
| `src/components/konfirmasi-pembayaran.tsx` | Dialog hasil Check-in dan akses bukti pembayaran/struk | Bukti transaksi | Pertahankan; gate tersendiri |
| `src/components/popup-kamar-terisi.tsx`, `popup-perlu-tindakan.tsx` | Dialog status kamar terisi/perlu tindakan | Informasi operasional | Pertahankan, bukan hasil penyimpanan |
| `src/components/hapus-data-demo.tsx` | Dialog konfirmasi hapus/arsip data demo | Konfirmasi sensitif | Pertahankan proteksi, jangan konversi ke dialog hasil |
| `src/routes/keuangan.tsx`, `src/routes/housekeeping.tsx`, `src/routes/index.tsx` | `window.confirm` sebelum tindakan kritis | Konfirmasi *sebelum aksi* | Pertahankan. Perbaikan UX konfirmasi harus punya peninjauan/guard masing-masing |
| `src/components/pengumuman-sidebar.tsx`, `src/routes/booking.tsx`, `src/routes/tamu.tsx` | Dialog konten/penampil informasi | Bukan popup hasil | Tidak perlu ganti secara massal |

Inventaris berdasarkan pemakaian `toast.success/error/warning`, `window.confirm`, `<Dialog` dan komponen hasil. Ini **audit target utama yang ditemukan**, bukan jaminan setiap bentuk pesan di seluruh aplikasi sudah tercakup.

## C. Prinsip pengujian dan pekerjaan lanjutan

1. **Jangan** menyatakan berhasil sebelum write diakui dan readback yang relevan berhasil. Jika readback gagal atau hilang karena race, laporkan status belum pasti dan minta pemeriksaan.
2. **Konfirmasi** sebelum menghapus/membatalkan, **notifikasi** setelah hasil operasi, dan **struk** pembayaran adalah tiga kebutuhan berbeda. Komponen hasil tidak boleh mengambil alih konfirmasi atau receipt.
3. Jangan membuat/menyetujui Booking, pembayaran, kamar, komisi, template ACTIVE, ataupun pesan tamu untuk sekadar melihat desain popup.
4. Tahap 6 `PapanInformasi` adalah perubahan kode frontend. Penghapusan tetap membutuhkan `window.confirm`, dan hasil tambah/ubah/hapus baru tampil sesudah pemeriksaan ulang daftar. Bila hasil tidak terverifikasi, jangan klaim berhasil.
5. Perubahan GitHub **tidak** otomatis berarti preview/publikasi Lovable atau UAT Owner. Gate SQL Cloud Overtime dan backup/restore tetap berlaku.

**Status:** UI-26-02 masih **PARTIAL**. Pembaruan status setelah PR tahap 6 wajib membedakan `BRANCH`, `CI`, `MERGED`, `LOVABLE SOURCE`, `PUBLISH`, dan `UAT VISUAL`.
