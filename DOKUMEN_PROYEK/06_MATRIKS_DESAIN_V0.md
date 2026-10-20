# Matriks Integrasi Desain v0 — Baturaden 25 Homestay

**Checkpoint:** FASE A, 2026-10-19  
**Sumber fungsi/data:** aplikasi asli `pixel-perfect-read`  
**Sumber visual:** `C:\Users\USER\Documents\Codex\v0-dashboard-preview`  
**Status:** FASE B Dashboard selesai lokal; desain Login/halaman lain tetap menunggu persetujuan Owner.

## Batas referensi

Referensi v0 adalah proyek Next.js 16/React dengan Tailwind v4 dan data mock khusus preview. Arsip `C:\Users\USER\Documents\baturaden-25-dashboard-prototype.zip` ditemukan tetapi tidak diekstrak atau diubah. Server preview v0 tidak dijalankan.

Komponen v0 yang terbukti tersedia:

- `components/dashboard/sidebar.tsx`
- `components/dashboard/hero-header.tsx`
- `components/dashboard/kpi-cards.tsx`
- `components/dashboard/room-cards.tsx`
- `components/dashboard/activity-feed.tsx`
- `components/dashboard/quick-actions.tsx`
- `components/dashboard/revenue-chart.tsx`
- `components/dashboard/payment-donut.tsx`
- `components/dashboard/amount-visibility.tsx`
- `components/dashboard/dashboard-shell.tsx`

`lib/mock-data.ts` secara eksplisit hanya data preview. Tidak boleh disalin sebagai sumber data aplikasi asli.

## Matriks pemetaan

| Halaman asli | Referensi v0 | Perubahan visual fase ini | Risiko | Status |
|---|---|---|---|---|
| `/auth` | Tidak ada halaman Login v0 | Tidak diubah; auth asli tetap Supabase/Lovable OAuth/password | Mengarang desain Login resmi | TIDAK ADA REFERENSI / DITUNDA |
| Shared layout/sidebar | `Sidebar`, sebagian `HeroHeader` | Token navy/gold ditambahkan; Sidebar asli diadaptasi secara selektif; route/role/Emergency dipertahankan | Menimpa guard/menu atau Emergency | SELESAI FASE A |
| `/` Dashboard | `dashboard-shell`, KPI, room, activity, quick actions, charts, donut, hero | Hero navy/gold, KPI live, Activity live untuk Owner, revenue live dari payments, breakdown live payment/expense sesuai akses, Quick Actions styled; tabel P0-02 tetap menjadi sumber fungsi | v0 memakai mock data dan kartu kamar; konflik dengan tabel P0-02 | SELESAI FASE B LOKAL |
| `/kamar` | Tidak ada halaman operasional khusus | Tidak diubah | Mengarang kartu ROOM/HK dari v0 | TIDAK ADA REFERENSI |
| `/booking` | Hanya label navigasi/Quick Actions | Tidak diubah | Merusak desain Booking yang sudah disetujui | TIDAK ADA REFERENSI |
| `/transaksi` | Hanya pencarian demo di HeroHeader/Room refs | Tidak diubah | Mock search tidak boleh menggantikan query live | TIDAK ADA REFERENSI |
| `/tamu` | Tidak ada | Tidak diubah | Mengarang layout tamu | TIDAK ADA REFERENSI |
| `/housekeeping` | Hanya label/ikon navigasi | Tidak diubah | Menghilangkan workflow Housekeeping resmi | TIDAK ADA REFERENSI |
| `/keuangan` | Hanya Quick Action/Laporan Keuangan | Tidak diubah | Mengganti Finance live dengan donut mock | TIDAK ADA REFERENSI |
| `/karyawan` | Hanya label navigasi | Tidak diubah | Merusak role/permission Owner | TIDAK ADA REFERENSI |
| `/pengaturan` | Hanya label navigasi | Tidak diubah | Membedakan role/settings dari source asli | TIDAK ADA REFERENSI |
| Emergency | Tombol HELP/Emergency di Sidebar v0 | Emergency asli dipertahankan; hanya konteks warna/sidebar yang diselaraskan | v0 hanya preview dan tidak punya backend notifikasi | SELEKTIF / BACKEND TETAP ASLI |

## Token visual v0 yang dipetakan

Token v0 dicatat dalam `src/styles.css` menggunakan oklch dan dipakai selektif oleh Sidebar pada FASE A:

| Token v0 | Referensi | Pemakaian aplikasi asli |
|---|---|---|
| `navy` | `#0d2a63` | token `--navy`, tersedia sebagai `bg-navy`/`text-navy` |
| `navy-deep` | `#08183d` | Sidebar/header mobile FASE A |
| `navy-soft` | `#1a3f8a` | border/varian visual |
| `gold`, `gold-light`, `gold-dark` | `#c9a14a`, `#ecd08a`, `#a87a2a` | active nav, brand, aksen |
| `v0-success/info/warning/danger/violet` | palette v0 | tersedia untuk fase halaman yang memiliki referensi |

Belum ada perubahan global pada warna semantic `primary` aplikasi agar halaman tanpa referensi tidak berubah tanpa dasar. Dashboard FASE B memakai token v0 secara selektif; halaman lain tetap menunggu referensi dan persetujuan.

## Kompatibilitas fungsi

- Auth tetap `PeranProvider`, `AccessGate`, Supabase password/OAuth, dan `auth` route asli.
- Menu tetap memakai `bolehAksesMenu` dan route asli; tidak disalin dari state `active` mock v0.
- Emergency tetap memakai komponen dan status backend asli.
- Query live, RPC, P0-01 nomorator, P0-02 tabel Dashboard, P0-02B Check-out, sesi kas, dual identity, Training, RLS, dan audit tidak diubah.

## Keputusan checkpoint

FASE A selesai setelah audit, matriks, token visual selektif, dan adaptasi Sidebar/layout. FASE B Dashboard selesai lokal setelah gaya Hero/KPI/Activity/Chart/Breakdown/Quick Actions diadaptasi ke data live sambil mempertahankan tabel `Kamar Sedang Terisi` dan tiga aksi P0-02. Desain Login dan halaman operasional lain tetap menunggu persetujuan Owner.
