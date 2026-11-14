import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { UserRound, Brush, BedDouble, Pencil, Clock3, CalendarDays, NotebookPen, Plus, LogIn } from "lucide-react";
import "@/components/kamar.css";
import { LatarHeader } from "@/components/latar-header";
import { konteksHeader } from "@/lib/konteks-header";
import { useQueryClient } from "@tanstack/react-query";
import { FormulirPemesanan } from "@/components/formulir-pemesanan";
import { bolehCheckIn } from "@/lib/aksi-operasional";
import { HeaderDetail, BagianDetail, NilaiDetail, kelasPopupDetail } from "@/components/detail-premium";
import { DetailTransaksi } from "@/components/detail-transaksi";
import { Kerangka } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";
import { useTable, type Room } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/kamar")({
  head: () => meta("Status Kamar", "Status dan pengelolaan kamar Baturaden 25 Homestay."),
  validateSearch: (s: Record<string, unknown>): { bagian?: "semua" | "tersedia" | "terisi" | "perlu" | undefined } => ({
    bagian: ["semua", "tersedia", "terisi", "perlu"].includes(String(s["bagian"])) ? (s["bagian"] as "semua") : undefined,
  }),
  component: HalamanKamar,
});

const filterBagian: Record<string, Room["status"] | null> = { semua: null, tersedia: "ready", terisi: "occupied", perlu: "dirty" };

const statusMap: Record<Room["status"], StatusKamar> = {
  ready: "siap",
  occupied: "terisi",
  dirty: "perlu",
  cleaning: "sedang",
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
  const queryClient = useQueryClient();
  const canCheckIn = bolehCheckIn(posisiKode);
  const [checkInOpen, setCheckInOpen] = useState(false);
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

  const { bagian = "semua" } = Route.useSearch();
  const statusFilter = filterBagian[bagian] ?? null;
  const groupedRooms = useMemo(() => {
    const groups: Array<{ label: string; rooms: Room[] }> = kelompokKamar.map((group) => ({
      label: group.label,
      rooms: group.nomor
        .map((roomNumber) => rooms.rows.find((room) => room.room_number === roomNumber))
        .filter((room): room is Room => Boolean(room))
        .filter((room) => !statusFilter || room.status === statusFilter),
    }));

    const otherRooms = rooms.rows.filter((room) => !nomorKamarTerpetakan.has(room.room_number) && (!statusFilter || room.status === statusFilter));

    if (otherRooms.length) {
      groups.push({ label: "KAMAR LAINNYA", rooms: otherRooms });
    }

    return groups.filter((group) => group.rooms.length > 0);
  }, [rooms.rows, statusFilter]);

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
      judul="Status Kamar"
      tanpaJudul
    >
      <div className="halaman-kamar">
        <header className="kamar-header">
          <LatarHeader path="/kamar" />
          <div className="kamar-header-isi">
            <div className="kamar-header-judul">
              <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-gold">BATURADEN 25 HOMESTAY</p>
              <h1 className="mt-1 font-serif text-3xl text-foreground lg:text-[2.4rem]">Status Kamar</h1>
              <div className="mt-2 h-px w-20 bg-gradient-to-r from-gold to-transparent" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">Informasi ketersediaan dan kondisi kamar secara langsung</p>
            </div>
            <p className="kamar-header-kutipan">“{konteksHeader['/kamar']}”</p>
            {canCheckIn && <Button className="h-10 shrink-0 gap-3 rounded-xl px-6" onClick={() => setCheckInOpen(true)}><LogIn className="size-5" />Check-in</Button>}
          </div>
        </header>
        {rooms.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {rooms.error}
          </p>
        )}
        {rooms.loading && <p className="mt-5 text-sm text-muted-foreground">Memuat kamar…</p>}
        {!rooms.loading && statusFilter && groupedRooms.length === 0 && <p className="panel-mewah mt-5 px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada kamar dengan status ini saat ini.</p>}

        <div className="kamar-daftar">
          {groupedRooms.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-2">
                <BedDouble className="size-4 text-gold" strokeWidth={1.6} />
                <h2 className="text-xs font-bold uppercase text-gold-light">{group.label}</h2>
                <span className="ml-1 text-xs text-foreground">{group.rooms.length} kamar</span>
                <span className="h-px flex-1 bg-gradient-to-r from-gold to-gold/20" />
              </div>
              <div className="kamar-kelompok">
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
                      className="kamar-kartu"
                    >
                      <span className={`kamar-lampu kamar-lampu-${room.active ? status : 'nonaktif'}`} role="img" aria-label={room.active ? labelStatusKamar[status] : 'Tidak aktif'} title={room.active ? labelStatusKamar[status] : 'Tidak aktif'} />
                      <div className="kamar-plakat">
                        <svg viewBox="0 0 64 82" fill="none" stroke="currentColor" aria-hidden="true" preserveAspectRatio="none">
                          <path d="M13 4H51Q51 9 58 9V73Q51 73 51 78H13Q13 73 6 73V9Q13 9 13 4Z" strokeWidth="1.1" />
                          <path d="M16 1H48M2 15V67M62 15V67M16 81H48" strokeWidth=".5" opacity=".3" />
                          <circle cx="12" cy="5" r="1.8" fill="currentColor" /><circle cx="52" cy="5" r="1.8" fill="currentColor" /><circle cx="12" cy="77" r="1.8" fill="currentColor" /><circle cx="52" cy="77" r="1.8" fill="currentColor" />
                        </svg>
                        <svg className="kamar-ikon-ranjang" viewBox="0 0 54 42" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 21V12Q7 7 13 7H41Q47 7 47 12V21M3 33V25Q3 21 8 21H46Q51 21 51 25V33M3 28H51M3 33H51M4 33V37M50 33V37" />
                          <path d="M10 20V17Q10 14 14 14H21Q25 14 25 17V20M29 20V17Q29 14 33 14H40Q44 14 44 17V20M6 25H48" />
                          <path d="M8 5Q10 3 13 3H41Q44 3 46 5" strokeWidth=".65" opacity=".65" />
                        </svg>
                        {peran === 'owner' && <Button variant="outline" size="icon" className="kamar-ubah" aria-label={`Ubah kamar ${room.room_number}`} title={`Ubah kamar ${room.room_number}`} onClick={() => edit(room)}><Pencil className="size-3" /></Button>}
                      </div>
                      <div className="kamar-isi">
                      <p className="kamar-nomor">{room.room_number}</p>
                      <p className="kamar-tipe">
                        {roomType?.name ?? "Tipe kamar belum tersedia"}
                      </p>
                      <div className="kamar-info">
                      {transaction && (
                        <Button
                          variant="link"
                          className="font-mono"
                          onClick={() => setDetailTransactionId(transaction.id)}
                        >
                          {transaction.transaction_number}
                        </Button>
                      )}

                      {status === "siap" && housekeepingJob && (
                        <Button
                          variant="link"
                          className="font-mono"
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
                        </Button>
                      )}

                      {status === "siap" && !housekeepingJob && (
                        <p>
                          {history.error || checklists.error
                            ? "Data HK resmi belum tersedia."
                            : "HK belum tercatat."}
                        </p>
                      )}

                      {status === "siap" && housekeepingJob && checklists.error && (
                        <p>
                          Checklist HK resmi belum tersedia.
                        </p>
                      )}

                      {issues.length > 0 && housekeepingJob && (
                        <Button
                          variant="link"
                          className="mt-1 text-left"
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
                        </Button>
                      )}

                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!rooms.loading && groupedRooms.length > 0 && <div className="kamar-legenda" aria-label="Keterangan status kamar">
          <div className="kamar-legenda-item kamar-lampu-siap"><span className="kamar-lampu" /><strong>HIJAU</strong><span>· Tersedia</span></div>
          <div className="kamar-legenda-item kamar-lampu-terisi"><span className="kamar-lampu" /><strong>MERAH</strong><span>· Terisi</span></div>
          <div className="kamar-legenda-item kamar-lampu-sedang"><span className="kamar-lampu" /><strong>BIRU LANGIT</strong><span>· Dibersihkan</span></div>
          <div className="kamar-legenda-item kamar-lampu-nonaktif"><span className="kamar-lampu" /><strong>ABU-ABU</strong><span>· Tidak aktif</span></div>
          {rooms.rows.some((room) => room.active && room.status === 'dirty') && <div className="kamar-legenda-item kamar-lampu-perlu"><span className="kamar-lampu" /><strong>AMBER</strong><span>· Perlu dibersihkan</span></div>}
        </div>}
        {peran === 'owner' && <div className="mt-4 flex justify-end"><Button variant="outline" size="sm" onClick={() => edit()}><Plus className="size-3.5" />Kamar</Button></div>}

        {!rooms.loading && !groupedRooms.length && (
          <p className="mt-8 text-center text-sm text-muted-foreground">Kamar tidak ditemukan.</p>
        )}
      </div>

      {checkInOpen && canCheckIn && <FormulirPemesanan mode="check_in" onClose={() => setCheckInOpen(false)} onSaved={async () => {
        await Promise.all([rooms.refresh(), transactions.refresh(), queryClient.invalidateQueries({ queryKey: ['daftar-transaksi'] }), queryClient.invalidateQueries({ queryKey: ['tahun-transaksi'] })]);
      }} />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4"
          onClick={() => setDetailHousekeeping(null)}
        >
          <section
            role="dialog" aria-modal="true" aria-label="Detail Housekeeping"
            className={kelasPopupDetail}
            onClick={(event) => event.stopPropagation()}
          >
            <HeaderDetail title="Detail Housekeeping" nomor={detailHousekeeping.jobNumber} onClose={() => setDetailHousekeeping(null)} panorama />
            <div className="space-y-3 p-4 sm:p-5">
              <BagianDetail title="Informasi kamar & pekerjaan" icon={BedDouble}><div className="grid gap-3 sm:grid-cols-2">
                <NilaiDetail label="Kamar" icon={BedDouble}>Kamar {detailHousekeeping.roomNumber}</NilaiDetail>
                <NilaiDetail label="Aksi pekerjaan" icon={Brush}>{detailHousekeeping.action}</NilaiDetail>
                <NilaiDetail label="Petugas" icon={UserRound}>{detailHousekeeping.performedBy}</NilaiDetail>
                <NilaiDetail label="Nomor pekerjaan" icon={NotebookPen}>{detailHousekeeping.jobNumber}</NilaiDetail>
              </div></BagianDetail>
              <BagianDetail title="Riwayat waktu" icon={Clock3}><NilaiDetail label="Waktu pekerjaan" icon={CalendarDays}>{new Date(detailHousekeeping.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</NilaiDetail></BagianDetail>
              {detailHousekeeping.note && (
                <BagianDetail title="Catatan Housekeeping" icon={NotebookPen}><p className="whitespace-pre-wrap break-words rounded-lg border border-gold/15 bg-background/60 p-3 leading-relaxed">{detailHousekeeping.note}</p></BagianDetail>
              )}
              {detailHousekeeping.issues.length > 0 && (
                <BagianDetail title="Kekurangan / kerusakan" icon={Brush}>
                  <ul className="list-disc space-y-2 rounded-lg border border-bahaya-foreground/25 bg-bahaya/30 py-3 pl-8 pr-3 text-bahaya-foreground">
                    {detailHousekeeping.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </BagianDetail>
              )}
            </div>
          </section>
        </div>
      )}
    </Kerangka>
  );
}
