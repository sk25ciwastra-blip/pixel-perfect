import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Package, BedDouble, CreditCard, Percent, KeyRound, ChevronRight } from "lucide-react";
import { Kerangka, Daftar } from "@/components/kerangka";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/pengaturan")({
  head: () => meta("Pengaturan", "Pengaturan umum Baturaden 25 Homestay."),
  component: HalamanPengaturan,
});

const menu = [
  { ikon: Building2, label: "Profil Homestay", ket: "Nama, alamat, kontak" },
  { ikon: BedDouble, label: "Tipe Kamar", ket: "Jenis kamar", ke: "/tipe-kamar" },
  { ikon: Package, label: "Paket & Harga", ket: "Durasi dan tarif", ke: "/paket" },
  { ikon: CreditCard, label: "Metode Pembayaran", ket: "Cash, QRIS, Transfer" },
  { ikon: Percent, label: "Komisi", ket: "Besaran komisi karyawan" },
  { ikon: KeyRound, label: "Keamanan", ket: "Kata sandi dan PIN" },
];

function HalamanPengaturan() {
  return (
    <Kerangka judul="Pengaturan">
      <Daftar>
        {menu.map((m) => (
          <li key={m.label}>
            <Link to={"ke" in m ? m.ke : "/pengaturan"} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-secondary">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <m.ikon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.ket}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </Daftar>
    </Kerangka>
  );
}
