import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Kerangka, Daftar } from "@/components/kerangka";
import { LencanaTeks } from "@/components/status-kamar";
import { karyawan } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/karyawan")({
  head: () => meta("Karyawan", "Daftar karyawan Baturaden 25 Homestay: receptionist dan housekeeping."),
  component: HalamanKaryawan,
});

function HalamanKaryawan() {
  return (
    <Kerangka
      judul="Karyawan"
      keterangan={`${karyawan.length} karyawan`}
      aksi={
        <button className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lembut">
          <Plus className="h-4 w-4" /> Tambah
        </button>
      }
    >
      <Daftar>
        {karyawan.map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">{k.nama[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{k.nama}</p>
              <p className="text-xs text-muted-foreground">{k.id} · {k.posisi}</p>
            </div>
            <LencanaTeks status={k.aktif ? "Aktif" : "Tidak Aktif"} />
          </li>
        ))}
      </Daftar>
    </Kerangka>
  );
}
