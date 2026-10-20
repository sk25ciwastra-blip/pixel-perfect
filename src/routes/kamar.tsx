import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { DetailTransaksi } from "@/components/detail-transaksi";
import { Kerangka } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";
import { useTable, type Room } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/kamar")({
  head: () => meta("Status Room", "Status dan pengelolaan kamar Baturaden 25 Homestay."),
  component: HalamanKamar,
});

const statusMap: Record<Room["status"], StatusKamar> = {
  ready: "siap",
  occupied: "terisi",
  dirty: "perlu",
  cleaning: "sedang",
};

const latar: Record<StatusKamar, string> = {
  siap: "bg-siap/60 border-siap-foreground/15",
  terisi: "bg-terisi/60 border-terisi-foreground/15",
  perlu: "bg-perlu/60 border-perlu-foreground/15",
  sedang: "bg-sedang/60 border-sedang-foreground/15",
};

const teks: Record<StatusKamar, string> = {
  siap: "text-siap-foreground",
  terisi: "text-terisi-foreground",
  perlu: "text-perlu-foreground",
  sedang: "text-sedang-foreground",
};

const kelompokKamar = [
  { label: "STANDARD ROOM", nomor: ["06", "07", "08", "09", "12"] },
  { label: "SUPERIOR ROOM", nomor: ["02", "03", "04", "11"] },
  { label: "DELUXE ROOM", nomor: ["05", "10"] },
] as const;

const nomorKamarTerpetakan = new Set<string>(kelompokKamar.flatMap((group) => group.nomor));

type DetailHousekeeping = {
  roomNumber: string;
  jobNumber: string;
  action: string;
  note: string;
  performedBy: string;
  createdAt: string;
  issues: string[];
};

type ChecklistRow = ReturnType<typeof useTable<"housekeeping_checklists">>["rows"][number];

function formatIssueDetails(checklist: ChecklistRow) {
  return [
    !checklist.ashtray_ok && (checklist.ashtray_reason || "Asbak"),
    !checklist.exhaust_fan_ok && (checklist.exhaust_fan_reason || "Kipas exhaust"),
    !checklist.fan_ok && (checklist.fan_reason || "Kipas"),
    !checklist.mineral_water_ok && (checklist.mineral_water_reason || "Air mineral"),
    !checklist.tissue_ok && (checklist.tissue_reason || "Tisu"),
    !checklist.towel_ok && (checklist.towel_reason || "Handuk"),
    !checklist.tv_remote_ok && (checklist.tv_remote_reason || "Remote TV"),
    checklist.issue_note.trim(),
  ].filter((item): item is string => Boolean(item));
}

function HalamanKamar() {
  const { peran, posisiKode } = usePeran();
  const rooms = useTable("rooms");
  const types = useTable("room_types");
  const transactions = useTable("transactions");
  const history = useTable("housekeeping_history");
  const checklists = useTable("housekeeping_checklists");
  const historyRows = history.rows;
  const checklistRows = checklists.rows;

  const [editing, setEditing] = useState<Room | null>(null);
  const [open, setOpen] = useState(false);
  const [nomor, setNomor] = useState("");
  const [tipe, setTipe] = useState("");
  const [catatan, setCatatan] = useState("");
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [detailHousekeeping, setDetailHousekeeping] = useState<DetailHousekeeping | null>(null);

  const latestReadyHistory = useMemo(() => {
    const map = new Map<string, (typeof historyRows)[number]>();

    for (const item of historyRows) {
      if (item.to_status !== "ready" || !item.job_number) continue;
      const current = map.get(item.room_id);
      if (
        !current ||
        new Date(item.created_at).getTime() > new Date(current.created_at).getTime()
      ) {
        map.set(item.room_id, item);
      }
    }

    return map;
  }, [historyRows]);

  const latestChecklist = useMemo(() => {
    const map = new Map<string, (typeof checklistRows)[number]>();

    for (const item of checklistRows) {
      const current = map.get(item.room_id);
      if (
        !current ||
        new Date(item.created_at).getTime() > new Date(current.created_at).getTime()
      ) {
        map.set(item.room_id, item);
      }
    }

    return map;
  }, [checklistRows]);

  const groupedRooms = useMemo(() => {
    const groups: Array<{ label: string; rooms: Room[] }> = kelompokKamar.map((group) => ({
      label: group.label,
      rooms: group.nomor
        .map((roomNumber) => rooms.rows.find((room) => room.room_number === roomNumber))
        .filter((room): room is Room => Boolean(room)),
    }));

    const otherRooms = rooms.rows.filter((room) => !nomorKamarTerpetakan.has(room.room_number));

    if (otherRooms.length) {
      groups.push({ label: "ROOM LAINNYA", rooms: otherRooms });
    }

    return groups.filter((group) => group.rooms.length > 0);
  }, [rooms.rows]);

  function edit(room?: Room) {
    setEditing(room ?? null);
    setNomor(room?.room_number ?? "");
    setTipe(room?.room_type_id ?? "");
    setCatatan(room?.notes ?? "");
    setActive(room?.active ?? true);
    setOpen(true);
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const selectedType = tipe || types.rows[0]?.id;

    if (!nomor.trim() || !selectedType) {
      setMessage("Periksa nomor dan tipe kamar.");
      return;
    }

    const payload = {
      room_number: nomor.trim(),
      room_type_id: selectedType,
      notes: catatan,
      active,
    };
    const result = editing
      ? await supabase.from("rooms").update(payload).eq("id", editing.id)
      : await supabase.from("rooms").insert(payload);

    if (result.error) {
      setMessage(
        result.error.code === "23505" ? "Nomor kamar sudah digunakan." : result.error.message,
      );
      return;
    }

    setOpen(false);
    await rooms.refresh();
  }

  return (
    <Kerangka
      judul="Status Room"
      keterangan={`${rooms.rows.length} Room`}
      aksi={
        peran === "owner" && (
          <Button className="h-11 rounded-xl" onClick={() => edit()}>
            Tambah
          </Button>
        )
      }
    >
      <div className="border-t border-border pt-5">
        {rooms.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {rooms.error}
          </p>
        )}
        {rooms.loading && <p className="mt-5 text-sm text-muted-foreground">Memuat kamar…</p>}

        <div className="mt-5 space-y-6">
          {groupedRooms.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {group.rooms.map((room) => {
                  const status = statusMap[room.status];
                  const roomType = types.rows.find((type) => type.id === room.room_type_id);
                  const transaction =
                    status === "terisi"
                      ? transactions.rows
                          .filter((item) => item.room_id === room.id && item.status === "check_in")
                          .sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                          )[0]
                      : undefined;
                  const housekeepingJob =
                    status === "siap" ? latestReadyHistory.get(room.id) : undefined;
                  const checklist = latestChecklist.get(room.id);
                  const issues = checklist ? formatIssueDetails(checklist) : [];

                  return (
                    <div
                      key={room.id}
                      className={`flex flex-col rounded-2xl border p-4 ${latar[status]}`}
                    >
                      <p className="text-xs text-muted-foreground">ROOM</p>
                      <p className="text-2xl font-bold">{room.room_number}</p>
                      <p className={`mt-1 text-[11px] font-bold uppercase ${teks[status]}`}>
                        {labelStatusKamar[status]}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        {roomType?.name?.toUpperCase() ?? "TIPE KAMAR BELUM TERSEDIA"}
                      </p>

                      {transaction && (
                        <button
                          type="button"
                          className="mt-3 text-left font-mono text-xs font-semibold text-primary hover:underline"
                          onClick={() => setDetailTransactionId(transaction.id)}
                        >
                          {transaction.transaction_number}
                        </button>
                      )}

                      {status === "siap" && housekeepingJob && (
                        <button
                          type="button"
                          className="mt-3 text-left font-mono text-xs font-semibold text-primary hover:underline"
                          onClick={() =>
                            setDetailHousekeeping({
                              roomNumber: room.room_number,
                              jobNumber: housekeepingJob.job_number as string,
                              action: housekeepingJob.action,
                              note: housekeepingJob.note,
                              performedBy: housekeepingJob.performed_by_name,
                              createdAt: housekeepingJob.created_at,
                              issues,
                            })
                          }
                        >
                          {housekeepingJob.job_number}
                        </button>
                      )}

                      {status === "siap" && !housekeepingJob && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {history.error || checklists.error
                            ? "Data HK resmi belum tersedia."
                            : "HK belum tercatat."}
                        </p>
                      )}

                      {status === "siap" && housekeepingJob && checklists.error && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Checklist HK resmi belum tersedia.
                        </p>
                      )}

                      {issues.length > 0 && housekeepingJob && (
                        <button
                          type="button"
                          className="mt-3 rounded-xl bg-bahaya px-3 py-2 text-left text-xs text-bahaya-foreground hover:bg-bahaya/80"
                          onClick={() =>
                            setDetailHousekeeping({
                              roomNumber: room.room_number,
                              jobNumber: housekeepingJob.job_number as string,
                              action: housekeepingJob.action,
                              note: housekeepingJob.note,
                              performedBy: housekeepingJob.performed_by_name,
                              createdAt: housekeepingJob.created_at,
                              issues,
                            })
                          }
                        >
                          ❌ {issues.join(" · ")}
                        </button>
                      )}

                      {peran === "owner" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => edit(room)}
                        >
                          Ubah
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!rooms.loading && !groupedRooms.length && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Kamar tidak ditemukan.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-md space-y-3 rounded-2xl bg-background p-5 shadow-lembut"
          >
            <h2 className="text-lg font-bold">{editing ? "Ubah kamar" : "Tambah kamar"}</h2>
            <label className="block text-sm">
              Nomor kamar
              <input
                required
                value={nomor}
                onChange={(event) => setNomor(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              Tipe kamar
              <select
                required
                value={tipe}
                onChange={(event) => setTipe(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"
              >
                <option value="" disabled>
                  Pilih tipe kamar
                </option>
                {types.rows.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Catatan
              <input
                value={catatan}
                onChange={(event) => setCatatan(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"
              />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Aktif
            </label>
            {message && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </div>
          </form>
        </div>
      )}

      {detailTransactionId && (
        <DetailTransaksi
          transactionId={detailTransactionId}
          mode={posisiKode === "housekeeping" ? "housekeeping" : "full"}
          onClose={() => setDetailTransactionId(null)}
        />
      )}

      {detailHousekeeping && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
          onClick={() => setDetailHousekeeping(null)}
        >
          <section
            className="w-full max-w-md rounded-2xl bg-background p-5 shadow-lembut"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Detail pekerjaan Housekeeping</p>
                <h2 className="text-lg font-bold">Kamar {detailHousekeeping.roomNumber}</h2>
              </div>
              <Button type="button" variant="outline" onClick={() => setDetailHousekeeping(null)}>
                Tutup
              </Button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">HK:</span>{" "}
                <span className="font-mono font-semibold">{detailHousekeeping.jobNumber}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Aksi:</span> {detailHousekeeping.action}
              </p>
              <p>
                <span className="text-muted-foreground">Petugas:</span>{" "}
                {detailHousekeeping.performedBy}
              </p>
              <p>
                <span className="text-muted-foreground">Waktu:</span>{" "}
                {new Date(detailHousekeeping.createdAt).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}
              </p>
              {detailHousekeeping.note && (
                <p>
                  <span className="text-muted-foreground">Catatan:</span> {detailHousekeeping.note}
                </p>
              )}
              {detailHousekeeping.issues.length > 0 && (
                <div className="rounded-xl bg-bahaya p-3 text-bahaya-foreground">
                  <p className="font-semibold">❌ Kekurangan/kerusakan</p>
                  <ul className="mt-1 list-disc pl-5">
                    {detailHousekeeping.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Kerangka>
  );
}
