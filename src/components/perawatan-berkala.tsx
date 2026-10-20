import { rpc } from "@/lib/data-live";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTable } from "@/lib/data-live";

type WorkType = "linen" | "fan" | "toilet";

type Task = {
  key: string;
  workType: WorkType;
  roomId: string | null;
  locationCode: string;
  label: string;
  intervalDays: number;
  roomStatus?: string;
  last?: {
    operational_date: string;
    performed_at: string;
    performed_by_name: string;
  };
};

const workTypeLabel: Record<WorkType, string> = {
  linen: "Sprei",
  fan: "Kipas Angin",
  toilet: "Toilet",
};

const toiletLocations = [
  { locationCode: "Toilet Lantai 2 · Kiri", intervalDays: 1 },
  { locationCode: "Toilet Lantai 2 · Kanan", intervalDays: 1 },
  { locationCode: "Toilet Lantai 1 · Kiri", intervalDays: 15 },
  { locationCode: "Toilet Lantai 1 · Kanan", intervalDays: 15 },
  { locationCode: "Toilet Superior B · 02", intervalDays: 1 },
  { locationCode: "Toilet Superior B · 03", intervalDays: 1 },
  { locationCode: "Toilet Superior B · 04", intervalDays: 1 },
];

function tanggalWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sudahJatuhTempo(lastDate: string | undefined, intervalDays: number) {
  if (!lastDate) return true;

  const today = Date.parse(tanggalWib() + "T00:00:00+07:00");
  const last = Date.parse(lastDate + "T00:00:00+07:00");
  return today - last >= intervalDays * 24 * 60 * 60 * 1000;
}

export function PerawatanBerkala({ readOnly = false }: { readOnly?: boolean }) {
  const maintenance = useTable("housekeeping_maintenance");
  const rooms = useTable("rooms");
  const roomTypes = useTable("room_types");
  const employees = useTable("employees", !readOnly);
  const maintenanceRows = maintenance.rows;
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<WorkType | null>(null);
  const [performedBy, setPerformedBy] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const tasks = useMemo<Task[]>(() => {
    const lastByKey = new Map<string, (typeof maintenanceRows)[number]>();

    for (const item of maintenanceRows) {
      const key = item.work_type + ":" + item.location_code;
      const current = lastByKey.get(key);

      if (
        !current ||
        new Date(item.performed_at).getTime() > new Date(current.performed_at).getTime()
      ) {
        lastByKey.set(key, item);
      }
    }

    const roomTasks: Task[] = rooms.rows
      .filter((room) => room.active && room.room_number !== "01")
      .flatMap((room) =>
        (["linen", "fan"] as const).map((workType) => {
          const locationCode = room.room_number;
          const last = lastByKey.get(workType + ":" + locationCode);

          return {
            key: workType + ":" + room.id,
            workType,
            roomId: room.id,
            locationCode,
            label: workTypeLabel[workType] + " · Kamar " + room.room_number,
            intervalDays: workType === "linen" ? 2 : 30,
            roomStatus: room.status,
            ...(last
              ? {
                  last: {
                    operational_date: last.operational_date,
                    performed_at: last.performed_at,
                    performed_by_name: last.performed_by_name,
                  },
                }
              : {}),
          };
        }),
      );

    const sharedToiletTasks: Task[] = toiletLocations
      .filter((location) => !location.locationCode.startsWith("Toilet Superior B"))
      .map((location) => {
        const last = lastByKey.get("toilet:" + location.locationCode);

        return {
          key: "toilet:" + location.locationCode,
          workType: "toilet",
          roomId: null,
          locationCode: location.locationCode,
          label: location.locationCode,
          intervalDays: location.intervalDays,
          ...(last
            ? {
                last: {
                  operational_date: last.operational_date,
                  performed_at: last.performed_at,
                  performed_by_name: last.performed_by_name,
                },
              }
            : {}),
        };
      });

    const superiorToiletTasks: Task[] = toiletLocations
      .filter((location) => location.locationCode.startsWith("Toilet Superior B"))
      .map((location) => {
        const roomNumber = location.locationCode.split("·").at(-1)?.trim() ?? "";
        const room = rooms.rows.find(
          (item) =>
            item.active &&
            item.room_number === roomNumber &&
            roomTypes.rows
              .find((type) => type.id === item.room_type_id)
              ?.name.trim()
              .toLowerCase() === "superior b",
        );
        const last = lastByKey.get("toilet:" + location.locationCode);

        return {
          key: "toilet:" + location.locationCode,
          workType: "toilet",
          roomId: room?.id ?? null,
          locationCode: location.locationCode,
          label: location.locationCode,
          intervalDays: location.intervalDays,
          ...(room ? { roomStatus: room.status } : {}),
          ...(last
            ? {
                last: {
                  operational_date: last.operational_date,
                  performed_at: last.performed_at,
                  performed_by_name: last.performed_by_name,
                },
              }
            : {}),
        };
      });

    return [...roomTasks, ...sharedToiletTasks, ...superiorToiletTasks];
  }, [maintenanceRows, roomTypes.rows, rooms.rows]);

  const dueTasks = useMemo(
    () => tasks.filter((task) => sudahJatuhTempo(task.last?.operational_date, task.intervalDays)),
    [tasks],
  );

  const categories = useMemo(() => {
    const counts = new Map<WorkType, number>();

    for (const task of dueTasks) {
      counts.set(task.workType, (counts.get(task.workType) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([workType, count]) => ({
        workType,
        label: workTypeLabel[workType],
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [dueTasks]);

  const visibleTasks = selectedCategory
    ? dueTasks.filter((task) => task.workType === selectedCategory)
    : [];

  async function recordSelected() {
    const selectedTasks = visibleTasks.filter((task) => selected.includes(task.key));
    if (!selectedTasks.length) return;

    setSaving(true);
    setMessage("");

    const results = await Promise.all(
      selectedTasks.map(async (task) => {
        const { error } = await rpc("record_housekeeping_maintenance", {
          _maintenance_id: crypto.randomUUID(),
          _work_type: task.workType,
          _room_id: task.roomId as string,
          _location_code: task.locationCode,
          _performed_by: performedBy || undefined,
          _note: note,
        });

        return { task, error };
      }),
    );

    const succeeded = results.filter((result) => !result.error);
    const failed = results.filter((result) => result.error);

    await maintenance.refresh();
    setSelected((current) =>
      current.filter((key) => !succeeded.some((result) => result.task.key === key)),
    );
    setSaving(false);
    setMessage(
      failed.length
        ? String(succeeded.length) + " perawatan tercatat, " + String(failed.length) + " gagal."
        : String(succeeded.length) + " perawatan tercatat.",
    );
  }

  function kembaliKeKategori() {
    setSelectedCategory(null);
    setSelected([]);
    setMessage("");
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Perawatan Berkala</h2>
          <p className="text-sm text-muted-foreground">
            Pilih kategori untuk melihat pekerjaan yang jatuh tempo.
          </p>
        </div>
        {selectedCategory && (
          <Button type="button" variant="outline" onClick={kembaliKeKategori}>
            Kembali
          </Button>
        )}
      </div>

      {message && <p className="rounded-xl bg-secondary px-3 py-2 text-sm">{message}</p>}

      {maintenance.error || rooms.error ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Data perawatan berkala belum tersedia dari database.
        </p>
      ) : !selectedCategory ? (
        categories.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.workType}
                className="rounded-2xl border border-border bg-card p-5 text-left shadow-lembut"
              >
                <p className="text-base font-bold">{category.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {category.count} pekerjaan jatuh tempo
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={() => {
                    setSelectedCategory(category.workType);
                    setSelected([]);
                    setMessage("");
                  }}
                >
                  Lihat Daftar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada perawatan yang jatuh tempo.
          </p>
        )
      ) : (
        <>
          {!readOnly && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="text-sm">
                Petugas pelaksana
                <select
                  value={performedBy}
                  onChange={(event) => setPerformedBy(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"
                >
                  <option value="">Saya sendiri</option>
                  {employees.rows
                    .filter((employee) => employee.active && employee.position === "housekeeping")
                    .map((employee) => (
                      <option key={employee.user_id} value={employee.user_id}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm">
                Catatan
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3"
                  placeholder="Opsional"
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold">{workTypeLabel[selectedCategory]}</p>
              <p className="text-sm text-muted-foreground">
                {visibleTasks.length} pekerjaan jatuh tempo
              </p>
            </div>
            {!readOnly && (
              <Button disabled={!selected.length || saving} onClick={() => void recordSelected()}>
                Catat ({selected.length})
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTasks.map((task) => {
              const waitingAccess = task.roomStatus === "occupied";

              return (
                <label
                  key={task.key}
                  className="rounded-2xl border border-border bg-card p-4 shadow-lembut"
                >
                  <div className="flex items-start gap-3">
                    {!readOnly && (
                      <input
                        type="checkbox"
                        disabled={waitingAccess}
                        checked={selected.includes(task.key)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, task.key]
                              : current.filter((key) => key !== task.key),
                          )
                        }
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{task.label}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        {waitingAccess ? "MENUNGGU AKSES" : "JATUH TEMPO"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {task.last
                          ? "Terakhir: " +
                            task.last.performed_by_name +
                            " · " +
                            new Date(task.last.performed_at).toLocaleString("id-ID", {
                              timeZone: "Asia/Jakarta",
                            })
                          : "Belum ada riwayat perawatan"}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
