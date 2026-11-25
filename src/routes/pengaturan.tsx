import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Building2, Package, BedDouble, Percent, KeyRound, ChevronRight, Receipt, Wallet, LayoutGrid, MessageSquareText } from "lucide-react";
import { Kerangka } from "@/components/kerangka";
import { usePeran } from "@/lib/peran";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/pengaturan")({
  head: () => meta("Pengaturan", "Kelola konfigurasi Baturaden 25 Homestay."),
  component: HalamanPengaturan,
});

type Ke = "/tipe-kamar" | "/paket" | "/daftar-pengeluaran" | "/pengaturan-keuangan" | "/pengaturan-keamanan" | "/pengaturan-template-whatsapp" | "/pengaturan-profil-homestay" | "/pengaturan-manajemen-kamar" | "/pengaturan-rekening-owner";
type Item = { ikon: LucideIcon; label: string; ket: string; ke?: Ke };

const kelompok: { judul: string; item: Item[] }[] = [
  { judul: "Operasional", item: [
    { ikon: LayoutGrid, label: "Manajemen Kamar", ket: "Tambah, ubah, dan aktif/nonaktif kamar.", ke: "/pengaturan-manajemen-kamar" },
    { ikon: BedDouble, label: "Tipe Kamar", ket: "Jenis kamar yang tersedia.", ke: "/tipe-kamar" },
    { ikon: Package, label: "Paket & Harga", ket: "Durasi paket dan tarif kamar.", ke: "/paket" },
    { ikon: Building2, label: "Profil Homestay", ket: "Nama, alamat, dan kontak.", ke: "/pengaturan-profil-homestay" },
    { ikon: MessageSquareText, label: "Template WhatsApp", ket: "Pesan resmi per fitur; khusus Owner.", ke: "/pengaturan-template-whatsapp" },
  ]},
  { judul: "Keuangan", item: [
    { ikon: Receipt, label: "Daftar Pengeluaran", ket: "Jenis dan keperluan pengeluaran.", ke: "/daftar-pengeluaran" },
    { ikon: Percent, label: "Minimum DP & Komisi", ket: "Ketentuan DP dan komisi.", ke: "/pengaturan-keuangan" },
    { ikon: Wallet, label: "Rekening Owner", ket: "Rekening tujuan transfer.", ke: "/pengaturan-rekening-owner" },
  ]},
  { judul: "Akun & Keamanan", item: [
    { ikon: KeyRound, label: "Keamanan", ket: "Ubah password akun Anda sendiri.", ke: "/pengaturan-keamanan" },
  ]},
];

const gaya = `
.atur-grid{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:768px){.atur-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:1180px){.atur-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.atur-grid>li{display:flex;min-width:0}
.atur-kartu{position:relative;display:flex;align-items:center;gap:14px;min-height:88px;width:100%;padding:16px;border-radius:8px;
 background:var(--finance-paper-satin);border:1px solid var(--premium-line);
 box-shadow:var(--finance-paper-relief);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease;color:var(--premium-ink);outline:none}
.atur-kartu::after{content:'';position:absolute;inset:1px;border-radius:7px;pointer-events:none;box-shadow:inset 0 1px 0 var(--premium-surface)}
a.atur-kartu:hover,a.atur-kartu:focus-visible{transform:translateY(-2px);border-color:var(--gold-krem);box-shadow:var(--finance-paper-relief),0 8px 20px -12px color-mix(in oklab,var(--gold) 45%,transparent)}
a.atur-kartu:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
a.atur-kartu:active{transform:translateY(0)}
.atur-kartu[aria-disabled=true]{background:var(--premium-paper);border-color:color-mix(in oklab,var(--premium-line) 70%,transparent)}
.atur-kartu[aria-disabled=true] .atur-medali{color:var(--muted-foreground)}
.atur-medali{display:grid;place-items:center;width:48px;height:48px;flex-shrink:0;border-radius:50%;color:var(--gold);
 background:var(--finance-dark-satin);border:1px solid color-mix(in oklab,var(--gold) 60%,var(--border));
 box-shadow:var(--finance-panel-relief),0 3px 7px -3px color-mix(in oklab,var(--premium-ink) 40%,transparent);transition:border-color .22s ease}
a.atur-kartu:hover .atur-medali{border-color:var(--gold-light)}
.atur-judul{font-size:17px;font-weight:700;color:var(--premium-ink);line-height:1.3}
.atur-ket{font-size:13px;line-height:1.5;color:var(--premium-muted);margin-top:3px}
.atur-lencana{font-size:10px;font-weight:600;padding:4px 8px;border-radius:8px;background:var(--premium-highlight);border:1px solid var(--premium-line);color:var(--premium-muted);white-space:nowrap}
@media(max-width:600px){.atur-kartu{padding:14px;gap:12px}.atur-judul{font-size:15px}.atur-medali{width:42px;height:42px}.atur-ket{font-size:12px}.atur-lencana{white-space:normal;max-width:76px;text-align:center}}
@media(prefers-reduced-motion:reduce){.atur-kartu,.atur-medali{transition:none}a.atur-kartu:hover,a.atur-kartu:focus-visible{transform:none}}
`;

function HalamanPengaturan() {
  const { peran } = usePeran();
  const kelompokTampil = peran === "owner" ? kelompok : kelompok.filter((k) => k.judul === "Akun & Keamanan");
  return (
    <Kerangka judul="Pengaturan" keterangan="Kelola konfigurasi Baturaden 25 Homestay.">
      <style>{gaya}</style>
      <div className="space-y-8">
        {kelompokTampil.map((k) => (
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
