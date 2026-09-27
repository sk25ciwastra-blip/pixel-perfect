import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Kerangka } from "@/components/kerangka";
import { tamu } from "@/lib/data-contoh";

export const Route = createFileRoute("/tamu")({
  head: () => ({
    meta: [
      { title: "Tamu — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Data tamu Baturaden 25 Homestay dengan pencarian nama dan nomor HP.",
      },
      { property: "og:title", content: "Tamu — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Data tamu Baturaden 25 Homestay dengan pencarian nama dan nomor HP.",
      },
    ],
  }),
  component: HalamanTamu,
});

function HalamanTamu() {
  const [cari, setCari] = useState("");
  const hasil = tamu.filter(
    (t) =>
      t.nama.toLowerCase().includes(cari.toLowerCase()) ||
      t.telepon.replace(/-/g, "").includes(cari.replace(/-/g, "")),
  );

  return (
    <Kerangka judul="Tamu" keterangan="Cari tamu berdasarkan nama atau nomor HP">
      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari nama atau nomor HP/WhatsApp"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/30"
      />

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {hasil.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Tamu tidak ditemukan.
          </li>
        )}
        {hasil.map((t) => (
          <li
            key={t.telepon}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{t.nama}</p>
              <p className="text-xs text-muted-foreground">{t.telepon}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.kunjungan} kali menginap
            </p>
          </li>
        ))}
      </ul>
    </Kerangka>
  );
}
