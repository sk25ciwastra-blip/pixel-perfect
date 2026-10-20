import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutGrid, BedDouble, CalendarDays, Receipt, Users, Sparkles, Wallet,
  IdCard, Settings, MoreHorizontal, X, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { usePeran } from "@/lib/peran";

type Menu = { ke: string; label: string; ikon: LucideIcon; ownerSaja?: boolean };

function bolehAksesMenu(ke: string, peran: string, posisiKode: string | null) {
  if (peran === "owner") return true;

  switch (posisiKode) {
    case "supervisor":
      return !["/karyawan", "/pengaturan"].includes(ke);
    case "receptionist":
      return ["/", "/kamar", "/booking", "/transaksi", "/tamu", "/keuangan"].includes(ke);
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
  { ke: "/housekeeping", label: "Housekeeping", ikon: Sparkles },
  { ke: "/keuangan", label: "Keuangan", ikon: Wallet, ownerSaja: true },
  { ke: "/karyawan", label: "Karyawan", ikon: IdCard, ownerSaja: true },
  { ke: "/pengaturan", label: "Pengaturan", ikon: Settings, ownerSaja: true },
];

const bawah: Menu[] = [
  { ke: "/", label: "Dashboard", ikon: LayoutGrid },
  { ke: "/kamar", label: "Room", ikon: BedDouble },
  { ke: "/booking", label: "Booking", ikon: CalendarDays },
  { ke: "/tamu", label: "Tamu", ikon: Users },
];

function Logo() {
  return (
    <div className="text-center leading-tight">
      <p className="font-serif text-[1.45rem] text-foreground">
        Baturaden <span className="text-gold-light">25</span>
      </p>
      <p className="font-serif text-[1.45rem] text-foreground">Homestay</p>
      <p className="mt-1 text-[0.58rem] font-semibold tracking-[0.28em] text-gold-light">
        BANDUNG
      </p>
    </div>
  );
}

function EmergencyButton() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function confirmEmergency() {
    setOpen(false);
    setNotice("Emergency belum terkirim: layanan notifikasi internal belum tersedia di backend.");
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => { setNotice(null); setOpen(true); }}
        title="Emergency"
        aria-label="Kirim permintaan Emergency"
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-v0-danger/50 bg-v0-danger/10 text-[11px] font-bold tracking-[0.18em] text-bahaya-foreground transition hover:bg-v0-danger/25 focus:outline-none focus:ring-2 focus:ring-v0-danger/60"
      >
        <AlertTriangle className="h-4 w-4" /><span>EMERGENCY</span>
      </button>
      {notice && <p role="alert" className="px-1 text-center text-[10px] leading-4 text-bahaya-foreground">{notice}</p>}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="emergency-dialog-title" className="w-full max-w-md rounded-2xl border border-border bg-popover p-5 text-foreground shadow-lembut">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bahaya text-bahaya-foreground"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h2 id="emergency-dialog-title" className="text-lg font-bold">Konfirmasi Emergency</h2>
                <p className="mt-1 text-sm text-muted-foreground">Permintaan bantuan akan ditujukan kepada Owner, Supervisor, Inspector, dan Housekeeping sesuai hak akses.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">Batal</button>
              <button type="button" onClick={confirmEmergency} className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground">Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Kerangka({
  judul, keterangan, aksi, children, tanpaJudul, mewah,
}: {
  judul: string; keterangan?: string; aksi?: ReactNode; children: ReactNode; tanpaJudul?: boolean; mewah?: boolean;
}) {
  const { peran, nama, posisi, posisiKode, keluar } = usePeran();
  const [lainnya, setLainnya] = useState(false);
  const menu = semuaMenu.filter((m) => m.ke !== "/pengaturan" && bolehAksesMenu(m.ke, peran, posisiKode));
  const menuLain = menu.filter((m) => !bawah.some((b) => b.ke === m.ke));

  return (
    <div className={`min-h-screen bg-background text-foreground`}>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-hidden border-r border-border bg-navy-deep px-4 py-6 text-foreground lg:flex">
        <div className="px-2"><Logo /></div>
        <nav className="mt-8 flex-1 space-y-1">
          {menu.map((m) => (
            <Link
              key={m.ke}
              to={m.ke}
              activeOptions={{ exact: m.ke === "/" }}
              activeProps={{ className: "bg-gradient-to-r from-gold-light/15 to-gold/5 font-semibold text-gold-light ring-1 ring-inset ring-gold/40" }}
              inactiveProps={{ className: "text-muted-foreground hover:bg-secondary hover:text-foreground" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <m.ikon className="h-[18px] w-[18px]" strokeWidth={1.6} />
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border pt-4">
          <EmergencyButton />
          <div className="px-2">
            <p className="text-sm font-semibold">{nama}</p>
            <p className="text-xs text-muted-foreground">{posisi}</p>
          </div>
          <button onClick={() => void keluar()} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/50">Keluar</button>
        </div>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-navy-deep/90 px-4 py-3 text-foreground backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => void keluar()} className="text-sm font-semibold text-gold-light">Keluar</button>
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
