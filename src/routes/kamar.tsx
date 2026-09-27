import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock } from "lucide-react";
import { Kerangka, KotakCari } from "@/components/kerangka";
import { kamar, labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/kamar")({
  head: () => meta("Kamar", "Status kamar Baturaden 25 Homestay: siap, terisi, perlu dan sedang dibersihkan."),
  component: HalamanKamar,
});

const latar: Record<StatusKamar, string> = {
  siap: "bg-siap/60 border-siap-foreground/15",
  terisi: "bg-terisi/60 border-terisi-foreground/15",
  perlu: "bg-perlu/60 border-perlu-foreground/15",
  sedang: "bg-sedang/60 border-sedang-foreground/15",
};
const teks: Record<StatusKamar, string> = {
  siap: "text-siap-foreground", terisi: "text-terisi-foreground",
  perlu: "text-perlu-foreground", sedang: "text-sedang-foreground",
};

function HalamanKamar() {
  const [filter, setFilter] = useState<"semua" | StatusKamar>("semua");
  const [cari, setCari] = useState("");
  const urutan: Record<StatusKamar, number> = { terisi: 0, perlu: 1, sedang: 2, siap: 3 };
  const daftar = kamar
    .filter((k) => (filter === "semua" || k.status === filter) && k.nomor.includes(cari.trim()))
    .sort((a, b) => urutan[a.status] - urutan[b.status] || (a.sisaMenit ?? 0) - (b.sisaMenit ?? 0));

  const pilihan: ("semua" | StatusKamar)[] = ["semua", "siap", "terisi", "perlu", "sedang"];

  return (
    <Kerangka judul="Kamar" keterangan={`${kamar.length} kamar`}>
      <KotakCari value={cari} onChange={setCari} placeholder="Cari nomor kamar" />
      <div className="-mx-4 mt-3 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {pilihan.map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {p === "semua" ? "Semua" : labelStatusKamar[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {daftar.map((k) => {
          const mendesak = k.status === "terisi" && (k.sisaMenit ?? 999) <= 30;
          return (
            <div key={k.nomor} className={`flex flex-col rounded-2xl border p-4 ${latar[k.status]} ${mendesak ? "ring-2 ring-bahaya-foreground/40" : ""}`}>
              <p className="text-xs text-muted-foreground">Kamar</p>
              <p className="text-2xl font-bold tracking-tight">{k.nomor}</p>
              <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${teks[k.status]}`}>{labelStatusKamar[k.status]}</p>

              {k.status === "terisi" && (
                <div className="mt-3 rounded-xl bg-background/80 p-3">
                  <p className="truncate text-sm font-semibold">{k.tamu}</p>
                  <p className="text-xs text-muted-foreground">{k.paket}</p>
                  <div className={`mt-2 flex items-center gap-1.5 ${mendesak ? "text-bahaya-foreground" : "text-terisi-foreground"}`}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-mono text-base font-bold tabular-nums">{k.sisa}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Selesai {k.selesai}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {daftar.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">Kamar tidak ditemukan.</p>}
    </Kerangka>
  );
}
