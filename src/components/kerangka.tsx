import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutGrid, BedDouble, CalendarDays, Receipt, Users, Sparkles, Wallet,
  IdCard, Settings, MoreHorizontal, X, type LucideIcon,
} from "lucide-react";
import { usePeran } from "@/lib/peran";

type Menu = { ke: string; label: string; ikon: LucideIcon; ownerSaja?: boolean };

const semuaMenu: Menu[] = [
  { ke: "/", label: "Ringkasan", ikon: LayoutGrid },
  { ke: "/kamar", label: "Kamar", ikon: BedDouble },
  { ke: "/booking", label: "Booking", ikon: CalendarDays },
  { ke: "/transaksi", label: "Transaksi", ikon: Receipt },
  { ke: "/tamu", label: "Tamu", ikon: Users },
  { ke: "/housekeeping", label: "Housekeeping", ikon: Sparkles },
  { ke: "/keuangan", label: "Keuangan", ikon: Wallet, ownerSaja: true },
  { ke: "/karyawan", label: "Karyawan", ikon: IdCard, ownerSaja: true },
  { ke: "/pengaturan", label: "Pengaturan", ikon: Settings, ownerSaja: true },
];

const bawah: Menu[] = [
  { ke: "/", label: "Beranda", ikon: LayoutGrid },
  { ke: "/kamar", label: "Kamar", ikon: BedDouble },
  { ke: "/booking", label: "Booking", ikon: CalendarDays },
  { ke: "/tamu", label: "Tamu", ikon: Users },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
        25
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Baturaden 25</p>
        <p className="text-xs text-muted-foreground">Homestay</p>
      </div>
    </div>
  );
}

function PilihPeran() {
  const { peran, setPeran } = usePeran();
  return (
    <div className="flex rounded-full bg-secondary p-1 text-xs font-medium">
      {(["owner", "karyawan"] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPeran(p)}
          className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
            peran === p ? "bg-background text-primary shadow-lembut" : "text-muted-foreground"
          }`}
        >
          {p === "owner" ? "Owner" : "Karyawan"}
        </button>
      ))}
    </div>
  );
}

export function Kerangka({
  judul, keterangan, aksi, children, tanpaJudul,
}: {
  judul: string; keterangan?: string; aksi?: ReactNode; children: ReactNode; tanpaJudul?: boolean;
}) {
  const { peran, nama, posisi } = usePeran();
  const [lainnya, setLainnya] = useState(false);
  const menu = semuaMenu.filter((m) => peran === "owner" || !m.ownerSaja);
  const menuLain = menu.filter((m) => !bawah.some((b) => b.ke === m.ke));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background px-4 py-5 lg:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 flex-1 space-y-1">
          {menu.map((m) => (
            <Link
              key={m.ke}
              to={m.ke}
              activeOptions={{ exact: m.ke === "/" }}
              activeProps={{ className: "bg-primary-soft text-primary font-semibold" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-secondary hover:text-foreground" }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
            >
              <m.ikon className="h-[18px] w-[18px]" strokeWidth={2} />
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="px-2">
            <p className="text-sm font-semibold">{nama}</p>
            <p className="text-xs text-muted-foreground">{posisi}</p>
          </div>
          <PilihPeran />
        </div>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="w-40 shrink-0"><PilihPeran /></div>
      </header>

      <main className="px-4 pb-28 pt-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-5xl">
          {!tanpaJudul && (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{judul}</h1>
                {keterangan && <p className="mt-1 text-sm text-muted-foreground">{keterangan}</p>}
              </div>
              {aksi}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Navigasi bawah HP */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {bawah.map((m) => (
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
          <div className="absolute inset-0 bg-foreground/30" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background px-4 pb-8 pt-4"
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
    <section className="rounded-2xl border border-border bg-card p-4 shadow-lembut sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{judul}</h2>
      <div className="mt-3">{children}</div>
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
  return <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-lembut">{children}</ul>;
}

export function KotakCari({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
    />
  );
}
