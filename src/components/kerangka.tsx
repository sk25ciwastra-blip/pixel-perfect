import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutGrid, BedDouble, CalendarDays, Receipt, Users, Sparkles, Wallet,
  IdCard, Settings, MoreHorizontal, X, FileBarChart, LogOut, type LucideIcon,
} from "lucide-react";
import { usePeran } from "@/lib/peran";
import skyline from "@/assets/skyline-malam.jpg";

type Menu = { ke: string; label: string; ikon: LucideIcon; ownerSaja?: boolean; anak?: { bagian: string; label: string }[] };

function bolehAksesMenu(ke: string, peran: string, posisiKode: string | null) {
  if (peran === "owner") return true;

  switch (posisiKode) {
    case "supervisor":
      return !["/karyawan", "/pengaturan"].includes(ke);
    case "receptionist":
      return ["/", "/kamar", "/booking", "/transaksi", "/tamu", "/keuangan", "/laporan"].includes(ke);
    case "housekeeping":
      return ["/", "/kamar", "/housekeeping"].includes(ke);
    case "inspector":
      return ["/", "/kamar", "/booking", "/transaksi", "/tamu", "/housekeeping"].includes(ke);
    case "investor":
      return ["/", "/kamar"].includes(ke);
    default:
      return false;
  }
}

const semuaMenu: Menu[] = [
  { ke: "/", label: "Dashboard", ikon: LayoutGrid },
  { ke: "/kamar", label: "Room", ikon: BedDouble },
  { ke: "/booking", label: "Booking", ikon: CalendarDays },
  { ke: "/transaksi", label: "Transaksi", ikon: Receipt },
  { ke: "/tamu", label: "Tamu", ikon: Users },
  { ke: "/housekeeping", label: "Housekeeping", ikon: Sparkles, anak: [
    { bagian: "status", label: "Status Housekeeping" },
    { bagian: "checklist", label: "Checklist Housekeeping" },
    { bagian: "perawatan", label: "Perawatan Berkala" },
    { bagian: "riwayat", label: "Riwayat Housekeeping" },
  ] },
  { ke: "/keuangan", label: "Keuangan", ikon: Wallet, ownerSaja: true },
  { ke: "/laporan", label: "Laporan Operasional", ikon: FileBarChart, anak: [
    { bagian: "closing", label: "Closing Shift" },
    { bagian: "riwayat", label: "Riwayat Closing" },
    { bagian: "harian", label: "Rekap Harian" },
    { bagian: "pendapatan", label: "Rekap Pendapatan" },
  ] },
  { ke: "/karyawan", label: "Karyawan", ikon: IdCard, ownerSaja: true },
  { ke: "/pengaturan", label: "Pengaturan", ikon: Settings, ownerSaja: true },
];

const bawah: Menu[] = [
  { ke: "/", label: "Dashboard", ikon: LayoutGrid },
  { ke: "/kamar", label: "Room", ikon: BedDouble },
  { ke: "/booking", label: "Booking", ikon: CalendarDays },
  { ke: "/tamu", label: "Tamu", ikon: Users },
];

function LambangTeratai({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M32 4c5 6 6 14 0 24C26 18 27 10 32 4Z" />
      <path d="M32 28c-4-8-10-13-19-14 0 9 8 15 19 14Z" />
      <path d="M32 28c4-8 10-13 19-14 0 9-8 15-19 14Z" />
      <path d="M32 30c-8 2-17 0-24-6 6 7 15 10 24 9 9 1 18-2 24-9-7 6-16 8-24 6Z" />
      <path d="M14 36h36" strokeOpacity="0.6" />
    </svg>
  );
}

function Logo({ ringkas }: { ringkas?: boolean }) {
  if (ringkas) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <LambangTeratai className="h-6 w-9 shrink-0 text-gold" />
        <p className="truncate font-serif text-lg leading-none text-foreground">
          Baturaden <span className="text-gold-light">25</span> Homestay
        </p>
      </div>
    );
  }
  return (
    <div className="text-center leading-tight">
      <LambangTeratai className="mx-auto mb-2 h-9 w-14 text-gold drop-shadow-[0_0_10px_oklch(0.76_0.115_82/0.45)]" />
      <p className="font-serif text-[1.5rem] text-foreground">
        Baturaden <span className="text-gold-light">25</span>
      </p>
      <p className="font-serif text-[1.5rem] text-foreground">Homestay</p>
      <div className="mx-auto mt-2 flex items-center justify-center gap-2">
        <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold" />
        <span className="text-[0.55rem] font-semibold tracking-[0.3em] text-gold">MANAJEMEN</span>
        <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold" />
      </div>
    </div>
  );
}

export function Kerangka({
  judul, keterangan, aksi, children, tanpaJudul, penuh,
}: {
  judul: string; keterangan?: string; aksi?: ReactNode; children: ReactNode; tanpaJudul?: boolean;
  /** Konten memenuhi seluruh lebar setelah sidebar (Dashboard). */
  penuh?: boolean;
}) {
  const { peran, nama, posisi, posisiKode, keluar } = usePeran();
  const [lainnya, setLainnya] = useState(false);
  const lokasi = useRouterState({ select: (r) => ({ path: r.location.pathname, bagian: (r.location.search as { bagian?: string }).bagian }) });
  const menu = semuaMenu.filter((m) => m.ke !== "/pengaturan" && bolehAksesMenu(m.ke, peran, posisiKode));
  const menuLain = menu.filter((m) => !bawah.some((b) => b.ke === m.ke));

  return (
    <div className={`min-h-screen bg-background text-foreground`}>
      {/* Sidebar desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col overflow-hidden border-r border-gold/15 text-foreground lg:flex"
        style={{ background: "var(--sidebar-mewah)" }}
      >
        <img src={skyline} alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-72 w-full object-cover object-center opacity-30 [mask-image:linear-gradient(to_top,black_10%,transparent)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-gold/40 via-gold/10 to-transparent" />
        <div className="relative px-5 pb-5 pt-7"><Logo /></div>
        <div className="relative mx-5 h-px bg-gradient-to-r from-transparent via-gold/35 to-transparent" />
        <nav className="relative mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {menu.map((m) => (
            <div key={m.ke}>
            <Link
              to={m.ke}
              activeOptions={{ exact: m.ke === "/" }}
              activeProps={{ className: "emas-isi font-semibold" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-gold/[0.07] hover:text-foreground" }}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.9rem] transition-all"
            >
              <m.ikon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
              <span className="truncate">{m.label}</span>
            </Link>
            {m.anak && lokasi.path === m.ke && (
              <div className="ml-6 mt-1.5 space-y-0.5 border-l border-gold/25 pl-3">
                {m.anak.map((a, idx) => {
                  const aktif = (lokasi.bagian ?? m.anak?.[0]?.bagian) === a.bagian;
                  return (
                    <Link key={a.bagian} to={m.ke} search={{ bagian: a.bagian } as never}
                      className={`block rounded-md px-2 py-1.5 text-xs transition ${aktif ? "font-semibold text-gold-light" : "text-muted-foreground hover:text-foreground"}`}
                      data-idx={idx}>
                      {a.label}
                    </Link>
                  );
                })}
              </div>
            )}
            </div>
          ))}
        </nav>
        <div className="relative m-3 rounded-2xl border border-gold/20 bg-background/70 p-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="emas-isi grid size-10 shrink-0 place-items-center rounded-full font-serif text-base font-bold">
              {(nama || "P").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{nama}</p>
              <p className="truncate text-xs text-gold">{posisi}</p>
            </div>
          </div>
          <button onClick={() => void keluar()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-gold/60 hover:text-gold-light">
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </div>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gold/20 bg-navy-deep/90 px-4 py-3 text-foreground backdrop-blur lg:hidden">
        <Logo ringkas />
        <button onClick={() => void keluar()} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-gold-light">Keluar</button>
      </header>

      <main className={`relative pb-28 lg:ml-[228px] lg:pb-12 ${penuh ? "" : "px-4 pt-6 lg:px-10 lg:pt-0"}`}>
        {penuh ? children : (
        <>
          {!tanpaJudul && (
            <div className="relative -mx-4 mb-6 overflow-hidden px-4 lg:-mx-10 lg:px-10 lg:pt-10">
              <img src={skyline} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_70%] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
              <div className="relative mx-auto flex max-w-[1480px] flex-wrap items-end justify-between gap-3 pb-6">
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-gold">BATURADEN 25 HOMESTAY</p>
                  <h1 className="mt-1 font-serif text-3xl tracking-tight text-foreground lg:text-[2.4rem]">{judul}</h1>
                  <div className="mt-2 h-px w-20 bg-gradient-to-r from-gold to-transparent" />
                  {keterangan && <p className="mt-2 text-sm text-muted-foreground">{keterangan}</p>}
                </div>
                {aksi}
              </div>
            </div>
          )}
          <div className="relative mx-auto max-w-[1480px]">{children}</div>
        </>
        )}
      </main>

      {/* Navigasi bawah HP */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {bawah.filter((m) => bolehAksesMenu(m.ke, peran, posisiKode)).map((m) => (
            <li key={m.ke}>
              <Link
                to={m.ke}
                activeOptions={{ exact: m.ke === "/" }}
                activeProps={{ className: "text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              >
                <m.ikon className="h-5 w-5" />
                {m.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              onClick={() => setLainnya(true)}
              className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              Lainnya
            </button>
          </li>
        </ul>
      </nav>

      {lainnya && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setLainnya(false)}>
          <div className="absolute inset-0 bg-navy-deep/75 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-gold/30 px-4 pb-8 pt-4"
            style={{ background: "var(--sidebar-mewah)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-base font-semibold">Menu lainnya</p>
              <button onClick={() => setLainnya(false)} className="grid h-9 w-9 place-items-center rounded-full bg-secondary" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {menuLain.map((m) => (
                <li key={m.ke}>
                  <Link
                    to={m.ke}
                    onClick={() => setLainnya(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium hover:bg-secondary"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                      <m.ikon className="h-[18px] w-[18px]" />
                    </span>
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function Judul({ children, aksi }: { children: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {aksi}
    </div>
  );
}

export function Panel({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="panel-mewah overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <h2 className="font-serif text-xl text-gold-light">{judul}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Angka({ label, nilai, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{nilai}</p>
      {catatan && <p className="text-xs text-muted-foreground">{catatan}</p>}
    </div>
  );
}

export function Daftar({ children }: { children: ReactNode }) {
  return <ul className="panel-mewah divide-y divide-border overflow-hidden">{children}</ul>;
}

export function KotakCari({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-full border border-gold/30 bg-navy-deep/80 px-5 text-base shadow-lembut outline-none transition placeholder:text-muted-foreground/80 focus:border-gold focus:ring-4 focus:ring-gold/15"
    />
  );
}
