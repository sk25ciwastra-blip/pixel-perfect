import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Panel } from "@/components/kerangka";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Konfigurasi aplikasi Baturaden 25 Homestay.",
      },
      { property: "og:title", content: "Pengaturan — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Konfigurasi aplikasi Baturaden 25 Homestay.",
      },
    ],
  }),
  component: HalamanPengaturan,
});

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-sm">{label}</p>
      <p className="text-sm text-muted-foreground">{nilai}</p>
    </div>
  );
}

function HalamanPengaturan() {
  return (
    <Kerangka judul="Pengaturan" keterangan="Konfigurasi aplikasi">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel judul="Informasi Homestay">
          <div className="divide-y divide-border">
            <Baris label="Nama" nilai="Baturaden 25 Homestay" />
            <Baris label="Alamat" nilai="Baturaden, Banyumas" />
            <Baris label="Nomor WhatsApp" nilai="0812-0000-2525" />
          </div>
        </Panel>

        <Panel judul="Operasional">
          <div className="divide-y divide-border">
            <Baris label="Jam check-in" nilai="14.00" />
            <Baris label="Jam check-out" nilai="12.00" />
            <Baris label="Metode pembayaran" nilai="Cash, QRIS, Transfer" />
          </div>
        </Panel>
      </div>
    </Kerangka>
  );
}
