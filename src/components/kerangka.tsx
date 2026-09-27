import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { usePeran } from "@/lib/peran";

const menuOwner = [
  { ke: "/", label: "Ringkasan" },
  { ke: "/kamar", label: "Kamar" },
  { ke: "/booking", label: "Booking" },
  { ke: "/transaksi", label: "Transaksi" },
  { ke: "/tamu", label: "Tamu" },
  { ke: "/housekeeping", label: "Housekeeping" },
  { ke: "/keuangan", label: "Keuangan" },
  { ke: "/karyawan", label: "Karyawan" },
  { ke: "/pengaturan", label: "Pengaturan" },
] as const;

const menuKaryawan = [
  { ke: "/", label: "Ringkasan" },
  { ke: "/kamar", label: "Kamar" },
  { ke: "/booking", label: "Booking" },
  { ke: "/transaksi", label: "Transaksi" },
  { ke: "/tamu", label: "Tamu" },
  { ke: "/housekeeping", label: "Housekeeping" },
] as const;

export function Kerangka({
  judul,
  keterangan,
  aksi,
  children,
}: {
  judul: string;
  keterangan?: string;
  aksi?: ReactNode;
  children: ReactNode;
}) {
  const { peran, setPeran, nama, posisi } = usePeran();
  const menu = peran === "owner" ? menuOwner : menuKaryawan;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              Baturaden 25 Homestay
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {nama} · {posisi}
            </p>
          </div>
          <div className="flex shrink-0 rounded-full border border-border p-0.5 text-xs">
            <button
              onClick={() => setPeran("owner")}
              className={`rounded-full px-3 py-1 transition-colors ${
                peran === "owner"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Owner
            </button>
            <button
              onClick={() => setPeran("karyawan")}
              className={`rounded-full px-3 py-1 transition-colors ${
                peran === "karyawan"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Karyawan
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2 text-sm">
            {menu.map((item) => (
              <li key={item.ke}>
                <Link
                  to={item.ke}
                  activeOptions={{ exact: item.ke === "/" }}
                  activeProps={{
                    className:
                      "bg-secondary text-foreground font-medium",
                  }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="inline-block whitespace-nowrap rounded-md px-3 py-1.5 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {judul}
            </h1>
            {keterangan && (
              <p className="mt-1 text-sm text-muted-foreground">{keterangan}</p>
            )}
          </div>
          {aksi}
        </div>
        {children}
      </main>
    </div>
  );
}

export function Panel({
  judul,
  children,
}: {
  judul: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-4 sm:p-5">
      <h2 className="text-sm font-medium text-muted-foreground">{judul}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Angka({
  label,
  nilai,
  catatan,
}: {
  label: string;
  nilai: string;
  catatan?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{nilai}</p>
      {catatan && <p className="text-xs text-muted-foreground">{catatan}</p>}
    </div>
  );
}
