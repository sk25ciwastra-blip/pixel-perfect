import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, CalendarPlus, Sparkles, ChevronRight } from "lucide-react";
import { Kerangka, Judul, Daftar } from "@/components/kerangka";
import { LencanaTeks } from "@/components/status-kamar";
import { usePeran } from "@/lib/peran";
import { rupiah } from "@/lib/data-contoh";
import { useTable } from "@/lib/data-live";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => meta("Ringkasan", "Ringkasan harian Baturaden 25 Homestay: pendapatan, kamar, booking, dan housekeeping."),
  component: Ringkasan,
});

function Ringkasan() {
  const { peran, nama, posisi } = usePeran();
  const rooms = useTable("rooms"); const transactions = useTable("transactions"); const guests = useTable("guests");
  const kamar = rooms.rows; const booking = transactions.rows;
  const hitung = (s: string) => kamar.filter((k) => k.status === ({ siap: "ready", terisi: "occupied", perlu: "dirty" } as Record<string, string>)[s]).length;
  const hariIni = booking.filter((b) => new Date(b.created_at).toDateString() === new Date().toDateString());


  const statistik = [
    ...(peran === "owner" ? [{ label: "Pendapatan hari ini", nilai: rupiah(booking.filter(b=>new Date(b.created_at).toDateString()===new Date().toDateString()).reduce((sum,b)=>sum+Number(b.price_snapshot??0),0)), kelas: "text-primary", lebar: true }] : []),
    { label: "Booking hari ini", nilai: String(hariIni.length), kelas: "text-foreground" },
    { label: "Kamar tersedia", nilai: String(hitung("siap")), kelas: "text-siap-foreground" },
    { label: "Kamar terisi", nilai: String(hitung("terisi")), kelas: "text-terisi-foreground" },
    { label: "Perlu dibersihkan", nilai: String(hitung("perlu")), kelas: "text-perlu-foreground" },
  ];

  return (
    <Kerangka judul="Ringkasan" tanpaJudul>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Halo, {nama.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statistik.map((s) => (
          <div key={s.label} className={`rounded-2xl border border-border bg-card p-4 shadow-lembut ${"lebar" in s && s.lebar ? "col-span-2 sm:col-span-1" : ""}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 text-xl font-bold tracking-tight ${s.kelas}`}>{s.nilai}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <Judul>Aksi Cepat</Judul>
        <div className="grid grid-cols-3 gap-3">
          {posisi !== "Petugas Kebersihan" && <Link to="/check-in" className="flex flex-col items-center gap-2 rounded-2xl bg-primary px-3 py-5 text-sm font-semibold text-primary-foreground shadow-lembut">
            <LogIn className="h-6 w-6" /> Check-in
          </Link>}
          {posisi !== "Petugas Kebersihan" && <Link to="/booking" className="flex flex-col items-center gap-2 rounded-2xl bg-primary-soft px-3 py-5 text-sm font-semibold text-primary">
            <CalendarPlus className="h-6 w-6" /> Booking
          </Link>}
          <Link to="/housekeeping" className="flex flex-col items-center gap-2 rounded-2xl bg-primary-soft px-3 py-5 text-sm font-semibold text-primary">
            <Sparkles className="h-6 w-6" /> Housekeeping
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <Judul aksi={posisi !== "Petugas Kebersihan" && <Link to="/booking" className="flex items-center text-xs font-semibold text-primary">Semua <ChevronRight className="h-4 w-4" /></Link>}>
          Booking Hari Ini
        </Judul>
        <Daftar>
          {hariIni.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-12 shrink-0 text-center">
                <p className="text-sm font-bold">{new Date(b.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{guests.rows.find(g=>g.id===b.guest_id)?.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{b.transaction_number}</p>
                {b.status === 'CHECK_IN' && (
  <p className="truncate text-xs text-amber-600 font-medium mt-0.5">
    Sisa waktu: {b.checkout_time ? new Date(new Date(b.checkout_time).getTime() - new Date().getTime()).toISOString().substr(11, 8) : "00:00:00"}
  </p>
)}

              </div>
              <LencanaTeks status={b.status === "booking" ? "Booking" : b.status === "check_in" ? "Check-in" : b.status === "check_out" ? "Check-out" : "Dibatalkan"} />
            </li>
          ))}
        </Daftar>
      </section>
    </Kerangka>
  );
}
