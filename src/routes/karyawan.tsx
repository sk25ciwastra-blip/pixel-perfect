import { createFileRoute } from "@tanstack/react-router";
import { Kerangka } from "@/components/kerangka";
import { karyawan } from "@/lib/data-contoh";

export const Route = createFileRoute("/karyawan")({
  head: () => ({
    meta: [
      { title: "Karyawan — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Pengelolaan data karyawan Baturaden 25 Homestay beserta posisi dan statusnya.",
      },
      { property: "og:title", content: "Karyawan — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Pengelolaan data karyawan Baturaden 25 Homestay beserta posisi dan statusnya.",
      },
    ],
  }),
  component: HalamanKaryawan,
});

function HalamanKaryawan() {
  return (
    <Kerangka
      judul="Karyawan"
      keterangan="Data akun karyawan"
      aksi={
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Tambah Karyawan
        </button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">PIN</th>
              <th className="px-4 py-3 font-medium">Posisi</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {karyawan.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3 font-medium">{k.nama}</td>
                <td className="px-4 py-3 text-muted-foreground">{k.id}</td>
                <td className="px-4 py-3 text-muted-foreground">{k.pin}</td>
                <td className="px-4 py-3">{k.posisi}</td>
                <td className="px-4 py-3">{k.aktif ? "Aktif" : "Nonaktif"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kerangka>
  );
}
