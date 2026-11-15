import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Building2, Package, BedDouble, CreditCard, Percent, KeyRound, ChevronRight, Receipt, Wallet, LayoutGrid } from "lucide-react";
import { Kerangka } from "@/components/kerangka";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/pengaturan")({
  head: () => meta("Pengaturan", "Kelola konfigurasi Baturaden 25 Homestay."),
  component: HalamanPengaturan,
});

type Ke = "/tipe-kamar" | "/paket" | "/daftar-pengeluaran" | "/pengaturan-keuangan";
type Item = { ikon: LucideIcon; label: string; ket: string; ke?: Ke };

const kelompok: { judul: string; item: Item[] }[] = [
  { judul: "Operasional", item: [
    { ikon: LayoutGrid, label: "Manajemen Kamar", ket: "Administrasi data kamar homestay." },
    { ikon: BedDouble, label: "Tipe Kamar", ket: "Jenis kamar yang tersedia.", ke: "/tipe-kamar" },
    { ikon: Package, label: "Paket & Harga", ket: "Durasi paket dan tarif kamar.", ke: "/paket" },
    { ikon: Building2, label: "Profil Homestay", ket: "Nama, alamat, dan kontak." },
  ]},
  { judul: "Keuangan", item: [
    { ikon: CreditCard, label: "Metode Pembayaran", ket: "Cash, QRIS, dan Transfer." },
    { ikon: Receipt, label: "Daftar Pengeluaran", ket: "Jenis dan keperluan pengeluaran.", ke: "/daftar-pengeluaran" },
    { ikon: Percent, label: "Minimum DP & Komisi", ket: "Ketentuan DP dan komisi.", ke: "/pengaturan-keuangan" },
    { ikon: Wallet, label: "Rekening Owner", ket: "Rekening tujuan transfer.", ke: "/pengaturan-keuangan" },
  ]},
  { judul: "Akun & Keamanan", item: [
    { ikon: KeyRound, label: "Keamanan", ket: "Kata sandi dan PIN." },
  ]},
];

const gaya = `
.atur-grid{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:768px){.atur-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:1180px){.atur-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.atur-kartu{position:relative;display:flex;align-items:center;gap:14px;min-height:88px;padding:16px;border-radius:16px;
 background:linear-gradient(160deg,#fdfaf4 0%,#f8f4ec 55%,#efe7d8 100%);
 border:1px solid color-mix(in oklab,var(--gold) 45%,transparent);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -2px 0 color-mix(in oklab,var(--gold) 18%,transparent),0 10px 24px -14px rgba(0,0,0,.6),0 2px 6px -2px rgba(0,0,0,.35);
 transition:transform .18s ease,box-shadow .18s ease;color:#1d1a16;outline:none}
a.atur-kartu:hover,a.atur-kartu:focus-visible{transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 16px 30px -14px rgba(0,0,0,.65),0 0 0 1px color-mix(in oklab,var(--gold) 60%,transparent),0 0 18px -6px color-mix(in oklab,var(--gold) 55%,transparent)}
a.atur-kartu:focus-visible{box-shadow:0 0 0 3px var(--gold)}
.atur-kartu[aria-disabled=true]{opacity:.72;filter:saturate(.7)}
.atur-medali{display:grid;place-items:center;width:48px;height:48px;flex-shrink:0;border-radius:999px;color:var(--gold);
 background:radial-gradient(circle at 35% 30%,#3a332a,#0d0c0b 70%);
 box-shadow:inset 0 1px 1px rgba(255,255,255,.18),0 0 0 2px color-mix(in oklab,var(--gold) 70%,transparent),0 4px 10px -3px rgba(0,0,0,.6)}
.atur-judul{font-size:17px;font-weight:700;color:#1d1a16;line-height:1.25}
.atur-ket{font-size:13px;color:#5b5348;margin-top:2px}
.atur-lencana{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:#e6dccb;color:#5b5348;white-space:nowrap}
`;

function HalamanPengaturan() {
  return (
    <Kerangka judul="Pengaturan" keterangan="Kelola konfigurasi Baturaden 25 Homestay.">
      <style>{gaya}</style>
      <div className="space-y-8">
        {kelompok.map((k) => (
          <section key={k.judul} aria-labelledby={`grup-${k.judul}`}>
            <h2 id={`grup-${k.judul}`} className="font-serif text-2xl text-gold-light">{k.judul}</h2>
            <div className="mb-4 mt-2 h-px w-20 bg-gold" />
            <ul className="atur-grid">
              {k.item.map((m) => {
                const isi = (
                  <>
                    <span className="atur-medali"><m.ikon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="atur-judul block">{m.label}</span>
                      <span className="atur-ket block">{m.ket}</span>
                    </span>
                    {m.ke ? <ChevronRight className="h-5 w-5 shrink-0 text-gold-krem" /> : <span className="atur-lencana">Belum tersedia</span>}
                  </>
                );
                return (
                  <li key={m.label}>
                    {m.ke ? <Link to={m.ke} className="atur-kartu">{isi}</Link> : <div className="atur-kartu" aria-disabled="true">{isi}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Kerangka>
  );
}
