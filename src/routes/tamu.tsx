import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Kerangka, Daftar, KotakCari } from "@/components/kerangka";
import { tamu } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/tamu")({
  head: () => meta("Tamu", "Data tamu Baturaden 25 Homestay dengan pencarian nama dan nomor HP."),
  component: HalamanTamu,
});

function HalamanTamu() {
  const [cari, setCari] = useState("");
  const hasil = tamu.filter(
    (t) => t.nama.toLowerCase().includes(cari.toLowerCase()) || t.telepon.replace(/-/g, "").includes(cari.replace(/-/g, "")),
  );
  return (
    <Kerangka judul="Tamu" keterangan={`${tamu.length} tamu tercatat`}>
      <KotakCari value={cari} onChange={setCari} placeholder="Cari nama atau nomor HP" />
      <div className="mt-4">
        <Daftar>
          {hasil.map((t) => (
            <li key={t.telepon} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                {t.nama[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.nama}</p>
                <p className="text-xs text-muted-foreground">{t.telepon}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-muted-foreground">Terakhir</p>
                <p className="text-xs font-medium">{t.terakhir}</p>
              </div>
            </li>
          ))}
        </Daftar>
        {hasil.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">Tamu tidak ditemukan.</p>}
      </div>
    </Kerangka>
  );
}
