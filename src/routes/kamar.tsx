import { overtimeRoomIds } from '@/lib/room-overtime';
import { checklistForReadyJob } from '@/lib/checklist-for-ready-job';
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { UserRound, Brush, BedDouble, Clock3, CalendarDays, NotebookPen, LogIn } from "lucide-react";
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
import { aksiKartuKamar } from "@/lib/aksi-kartu-kamar";
import { PopupKamarTerisi } from "@/components/popup-kamar-terisi";
import { PopupPerluTindakan, type KamarPerluTindakan } from "@/components/popup-perlu-tindakan";
import { labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";
import { useTable, type Room } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/kamar")({
  head: () => meta("Status Kamar", "Status dan pengelolaan kamar Baturaden 25 Homestay."),
  validateSearch: (s: Record<string, unknown>): { bagian?: "semua" | "tersedia" | "terisi" | "perlu" | "overtime" | undefined } => ({
    bagian: ["semua", "tersedia", "terisi", "perlu", "overtime"].includes(String(s["bagian"])) ? (s["bagian"] as "semua") : undefined,
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
  ].filter((item): item is string => Boolean(item));
}

function HalamanKamar() {
  const { posisiKode } = usePeran();
  const queryClient = useQueryClient();
  const canCheckIn = bolehCheckIn(posisiKode);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [waktuSekarang, setWaktuSekarang] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setWaktuSekarang(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
  const rooms = useTable("rooms");
  const types = useTable("room_types");
  const transactions = useTable("transactions");
  const history = useTable("housekeeping_history");
  const checklists = useTable("housekeeping_checklists");
  const historyRows = history.rows;
  const checklistRows = checklists.rows;

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [informationRoom, setInformationRoom] = useState<Room | null>(null);
  const [occupiedRoom, setOccupiedRoom] = useState<Room | null>(null);
  const [overtimeNotice, setOvertimeNotice] = useState<(KamarPerluTindakan & { trigger: HTMLButtonElement }) | null>(null);
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

  const { bagian = "semua" } = Route.useSearch();
  const statusFilter = filterBagian[bagian] ?? null;
  const overtimeIds = useMemo(
    () => overtimeRoomIds(rooms.rows, transactions.rows, waktuSekarang),
    [rooms.rows, transactions.rows, waktuSekarang],
  );
  const overtimeView = bagian === "overtime";
  const overtimePending = overtimeView && (rooms.loading || transactions.loading);
  const overtimeError = overtimeView && (rooms.error || transactions.error);
  const groupedRooms = useMemo(() => {
    const visible = (room: Room) => overtimeView
      ? !overtimePending && !overtimeError && overtimeIds.has(room.id)
      : !statusFilter || room.status === statusFilter;
    const groups: Array<{ label: string; rooms: Room[] }> = kelompokKamar.map((group) => ({
      label: group.label,
      rooms: group.nomor
        .map((roomNumber) => rooms.rows.find((room) => room.room_number === roomNumber))
        .filter((room): room is Room => Boolean(room))
        .filter(visible),
    }));

    const otherRooms = rooms.rows.filter((room) => !nomorKamarTerpetakan.has(room.room_number) && visible(room));

    if (otherRooms.length) {
      groups.push({ label: "KAMAR LAINNYA", rooms: otherRooms });
    }

    return groups.filter((group) => group.rooms.length > 0);
  }, [rooms.rows, statusFilter, overtimeView, overtimeIds, overtimePending, overtimeError]);

  function openRoom(room: Room) {
    const action = aksiKartuKamar(room, canCheckIn);
    if (action === 'status') {
      setOccupiedRoom(room);
      return;
    }
    if (action === 'check_in') {
      setSelectedRoomId(room.id);
      setCheckInOpen(true);
      return;
    }
    setInformationRoom(room);
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
            {canCheckIn && <Button className="h-10 shrink-0 gap-3 rounded-xl px-6" onClick={() => { setSelectedRoomId(''); setCheckInOpen(true); }}><LogIn className="size-5" />Check-in Langsung</Button>}
          </div>
        </header>
        {overtimeView && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status">Overtime &gt;120 menit · {overtimePending || overtimeError ? "Belum terverifikasi" : `${overtimeIds.size} kamar`} · Tetap TERISI sampai Check-out yang sah.</p>
          <Link to="/kamar" search={{ bagian: "semua" }} className="text-gold underline underline-offset-4">Lihat semua kamar</Link>
        </div>}
        {overtimeView && transactions.error && <p role="alert" className="mt-3 text-sm text-destructive">Gagal memuat transaksi: {transactions.error}</p>}
        {overtimeView && !rooms.loading && transactions.loading && <p className="mt-5 text-sm text-muted-foreground">Memuat transaksi kamar…</p>}
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
                  const overtime = overtimeIds.has(room.id);
                  const housekeepingJob =
                    status === "siap" ? latestReadyHistory.get(room.id) : undefined;
                  const checklist = checklistForReadyJob(housekeepingJob, historyRows, checklistRows);
                  const issues = checklist ? formatIssueDetails(checklist) : [];

                  return (
                    <div
                      key={room.id}
                      className={`kamar-kartu ${overtime ? "ring-2 ring-destructive" : ""}`}
                      data-overtime={overtime ? "true" : undefined}
                      role="button" tabIndex={0}
                      aria-label={`Kamar ${room.room_number} · ${room.active ? labelStatusKamar[status] : 'Tidak aktif'}`}
                      onClick={() => openRoom(room)}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openRoom(room); } }}
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
                      </div>
                      <div className="kamar-isi">
                      <p className="kamar-nomor">{room.room_number}</p>
                      <p className="kamar-tipe">
                        {roomType?.name ?? "Tipe kamar belum tersedia"}
                      </p>
                      <div className="kamar-info">
                      {overtime && (
                        <button
                          type="button"
                          className="kamar-perlu-tombol font-bold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                          aria-label={'Perlu tindakan! Lihat keterangan kamar ' + room.room_number}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOvertimeNotice({
                              roomNumber: room.room_number,
                              transactionNumber: transaction?.transaction_number ?? null,
                              trigger: event.currentTarget,
                            });
                          }}
                        >
                          Perlu tindakan!
                        </button>
                      )}
                      {transaction && (
                        <Button
                          variant="link"
                          className="kamar-nomorator"
                          title="Lihat Detail Transaksi"
                          aria-label={`Lihat Detail Transaksi ${transaction.transaction_number}`}
                          onClick={event => { event.stopPropagation(); setDetailTransactionId(transaction.id); }}
                        >
                          {transaction.transaction_number}
                        </Button>
                      )}

                      {status === "siap" && housekeepingJob && (
                        <Button
                          variant="link"
                          onClick={event => {
                            event.stopPropagation();
                            setDetailHousekeeping({
                              roomNumber: room.room_number,
                              jobNumber: housekeepingJob.job_number as string,
                              action: housekeepingJob.action,
                              note: housekeepingJob.note,
                              performedBy: housekeepingJob.performed_by_name,
                              createdAt: housekeepingJob.created_at,
                              issues,
                            });
                          }}
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
                          title={issues.join(" · ")}
                          onClick={event => {
                            event.stopPropagation();
                            setDetailHousekeeping({
                              roomNumber: room.room_number,
                              jobNumber: housekeepingJob.job_number as string,
                              action: housekeepingJob.action,
                              note: housekeepingJob.note,
                              performedBy: housekeepingJob.performed_by_name,
                              createdAt: housekeepingJob.created_at,
                              issues,
                            });
                          }}
                        >
                          ❌ {issues.length} catatan HK
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
          <div className="kamar-legenda-item kamar-lampu-siap"><span className="kamar-lampu" /><span>Tersedia</span></div>
          <div className="kamar-legenda-item kamar-lampu-terisi"><span className="kamar-lampu" /><span>Terisi</span></div>
          <div className="kamar-legenda-item kamar-lampu-sedang"><span className="kamar-lampu" /><span>Sedang dibersihkan</span></div>
          <div className="kamar-legenda-item kamar-lampu-nonaktif"><span className="kamar-lampu" /><span>Tidak aktif</span></div>
          <div className="kamar-legenda-item kamar-lampu-perlu"><span className="kamar-lampu" /><span>Perlu dibersihkan</span></div>
        </div>}

        {!rooms.loading && !rooms.error && !overtimePending && !overtimeError && !statusFilter && !groupedRooms.length && (
          <p className="mt-8 text-center text-sm text-muted-foreground">{overtimeView ? "Tidak ada kamar overtime lebih dari 120 menit saat ini." : "Kamar tidak ditemukan."}</p>
        )}
      </div>

      {checkInOpen && canCheckIn && <FormulirPemesanan initialRoomId={selectedRoomId} mode="check_in" onClose={() => setCheckInOpen(false)} onSaved={async () => {
        await Promise.all([rooms.refresh(), transactions.refresh(), queryClient.invalidateQueries({ queryKey: ['daftar-transaksi'] }), queryClient.invalidateQueries({ queryKey: ['tahun-transaksi'] })]);
      }} />}

      {informationRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 p-4 backdrop-blur-sm" onClick={() => setInformationRoom(null)}>
          <section role="dialog" aria-modal="true" aria-label="Informasi Kamar" className={kelasPopupDetail} onClick={event => event.stopPropagation()}>
            <HeaderDetail title="Informasi Kamar" nomor={informationRoom.room_number} onClose={() => setInformationRoom(null)} />
            <div className="space-y-3 p-5">
              <NilaiDetail label="Kamar" icon={BedDouble}>{informationRoom.room_number} · {types.rows.find(type => type.id === informationRoom.room_type_id)?.name ?? 'Tipe belum tersedia'}</NilaiDetail>
              <NilaiDetail label="Status" icon={BedDouble}>{informationRoom.active ? labelStatusKamar[statusMap[informationRoom.status]] : 'Tidak aktif'}</NilaiDetail>
              {informationRoom.notes && <p className="whitespace-pre-wrap text-sm">{informationRoom.notes}</p>}
              {!informationRoom.active && <p className="text-sm text-muted-foreground">Kamar tidak aktif. Check-in tidak tersedia.</p>}
              {informationRoom.active && informationRoom.status !== 'ready' && <p role="alert" className="text-sm text-muted-foreground">Kamar belum tersedia untuk Check-in Langsung. {informationRoom.status === 'occupied' ? 'Kamar masih terisi; Check-in ganda tidak diizinkan.' : 'Kamar harus berstatus tersedia terlebih dahulu.'}</p>}
              {informationRoom.active && informationRoom.status === 'ready' && !canCheckIn && <p className="text-sm text-muted-foreground">Akses Anda tidak mengizinkan Check-in Langsung.</p>}
              <div className="flex justify-end"><Button variant="outline" onClick={() => setInformationRoom(null)}>Tutup</Button></div>
            </div>
          </section>
        </div>
      )}

      {occupiedRoom && <PopupKamarTerisi nomor={occupiedRoom.room_number} room={occupiedRoom} onClose={() => setOccupiedRoom(null)} />}
      {overtimeNotice && <PopupPerluTindakan rooms={[overtimeNotice]} trigger={overtimeNotice.trigger} onClose={() => setOvertimeNotice(null)} />}

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
