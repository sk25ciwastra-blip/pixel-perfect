import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Kerangka, Judul, Daftar } from "@/components/kerangka";
import { LencanaTeks } from "@/components/status-kamar";
import { booking } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/booking")({
  head: () => meta("Booking", "Daftar booking kamar Baturaden 25 Homestay beserta statusnya."),
  component: HalamanBooking,
});

function Baris({ b }: { b: (typeof booking)[number] }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-14 shrink-0 rounded-xl bg-secondary py-1.5 text-center">
        <p className="text-[10px] font-medium uppercase text-muted-foreground">{b.tanggal.split(" ").slice(0, 2).join(" ")}</p>
        <p className="text-sm font-bold">{b.jam}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{b.tamu}</p>
        <p className="truncate text-xs text-muted-foreground">{b.kode} · Kamar {b.kamar}</p>
      </div>
      <LencanaTeks status={b.status} />
    </li>
  );
}

function HalamanBooking() {
  const akanDatang = booking.filter((b) => b.status === "Booking");
  const lainnya = booking.filter((b) => b.status !== "Booking");
  return (
    <Kerangka
      judul="Booking"
      keterangan="Daftar pemesanan kamar"
      aksi={
        <button className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lembut">
          <Plus className="h-4 w-4" /> Booking Baru
        </button>
      }
    >
      <Judul>Akan Datang</Judul>
      <Daftar>{akanDatang.map((b) => <Baris key={b.kode} b={b} />)}</Daftar>
      <div className="mt-8"><Judul>Riwayat</Judul></div>
      <Daftar>{lainnya.map((b) => <Baris key={b.kode} b={b} />)}</Daftar>
    </Kerangka>
  );
}
