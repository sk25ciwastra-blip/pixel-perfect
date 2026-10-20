import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Kerangka, Judul } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { LencanaStatus } from '@/components/status-kamar';
import type { StatusKamar } from '@/lib/data-contoh';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { ChecklistHousekeeping } from '@/components/checklist-housekeeping';
import { PerawatanBerkala } from '@/components/perawatan-berkala';

export const Route = createFileRoute('/housekeeping')({
  head: () =>
    meta(
      'Kebersihan Kamar',
      'Kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay.',
    ),
  component: Halaman,
});

type Section = {
  key: 'dirty' | 'needs_action' | 'cleaning' | 'ready';
  judul: string;
  label: StatusKamar;
  rooms: ReturnType<typeof useTable<'rooms'>>['rows'];
};

function Halaman() {
  const { posisiKode } = usePeran();
  const canAdvance =
    posisiKode === 'owner' ||
    posisiKode === 'supervisor' ||
    posisiKode === 'housekeeping';
  const canOverride = posisiKode === 'owner' || posisiKode === 'supervisor';

  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checklistRoomId, setChecklistRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const rooms = useTable('rooms');
  const types = useTable('room_types');
  const history = useTable('housekeeping_history');
  const checklists = useTable('housekeeping_checklists');
  const transactions = useTable('transactions');

  const transactionNumbers = useMemo(
    () => new Map(transactions.rows.map((transaction) => [transaction.id, transaction.transaction_number])),
    [transactions.rows],
  );

  const operationalRooms = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rooms.rows.filter((room) => {
      if (room.room_number === '01') return false;
      if (!term) return true;

      return (
        room.room_number.toLowerCase().includes(term) ||
        history.rows.some(
          (item) =>
            item.room_id === room.id &&
            (item.job_number?.toLowerCase().includes(term) ||
              (item.transaction_id
                ? transactionNumbers.get(item.transaction_id)?.toLowerCase().includes(term)
                : false)),
        )
      );
    });
  }, [history.rows, rooms.rows, search, transactionNumbers]);

  const latestChecklist = useMemo(() => {
    const map = new Map<string, (typeof checklists.rows)[number]>();

    for (const checklist of checklists.rows) {
      const current = map.get(checklist.room_id);

      if (
        !current ||
        new Date(checklist.created_at).getTime() >
          new Date(current.created_at).getTime()
      ) {
        map.set(checklist.room_id, checklist);
      }
    }

    return map;
  }, [checklists.rows]);

  const needsActionIds = useMemo(
    () =>
      new Set(
        operationalRooms
          .filter(
            (room) =>
              latestChecklist.get(room.id)?.result === 'needs_action',
          )
          .map((room) => room.id),
      ),
    [latestChecklist, operationalRooms],
  );

  const sections: Section[] = [
    {
      key: 'dirty',
      judul: 'Perlu Dibersihkan',
      label: 'perlu',
      rooms: operationalRooms.filter((room) => room.status === 'dirty'),
    },
    {
      key: 'needs_action',
      judul: 'Perlu Tindakan',
      label: 'perlu',
      rooms: operationalRooms.filter((room) => needsActionIds.has(room.id)),
    },
    {
      key: 'cleaning',
      judul: 'Sedang Dibersihkan',
      label: 'sedang',
      rooms: operationalRooms.filter(
        (room) => room.status === 'cleaning' && !needsActionIds.has(room.id),
      ),
    },
    {
      key: 'ready',
      judul: 'Sudah Siap',
      label: 'siap',
      rooms: operationalRooms.filter(
        (room) => room.status === 'ready' && !needsActionIds.has(room.id),
      ),
    },
  ];

  const dirtyRooms = sections.find((section) => section.key === 'dirty')?.rooms ?? [];
  const allDirtySelected =
    dirtyRooms.length > 0 && dirtyRooms.every((room) => selectedIds.includes(room.id));
  const activeRooms = operationalRooms.filter((room) => room.active);
  const selesaiHariIni = new Set(
    history.rows
      .filter(
        (item) =>
          item.action === 'finish_cleaning' &&
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jakarta',
          }).format(new Date(item.created_at)) ===
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Jakarta',
            }).format(new Date()),
      )
      .map((item) => item.room_id),
  ).size;

  function refreshAll() {
    return Promise.all([
      rooms.refresh(),
      history.refresh(),
      checklists.refresh(),
    ]);
  }

  async function advanceOne(id: string) {
    setProcessingIds((current) => [...current, id]);
    setMessage('');

    try {
      const { error: advanceError } = await supabase.rpc(
        'advance_room_cleaning',
        { _room_id: id },
      );

      if (advanceError) {
        setMessage(advanceError.message);
        return false;
      }

      return true;
    } finally {
      setProcessingIds((current) => current.filter((item) => item !== id));
    }
  }

  async function startSelected() {
    const ids = [...selectedIds];

    if (!ids.length) return;

    setProcessingIds(ids);
    setMessage('');

    const results = await Promise.all(
      ids.map(async (id) => {
        const { error: advanceError } = await supabase.rpc(
          'advance_room_cleaning',
          { _room_id: id },
        );

        return { id, error: advanceError };
      }),
    );

    const succeeded = results.filter((result) => !result.error).map((result) => result.id);
    const failed = results.filter((result) => result.error);

    setSelectedIds((current) => current.filter((id) => !succeeded.includes(id)));
    setProcessingIds([]);
    await refreshAll();

    setMessage(
      failed.length
        ? `${succeeded.length} kamar dimulai, ${failed.length} kamar gagal karena status berubah atau tidak tersedia.`
        : `${succeeded.length} kamar berhasil dimulai.`,
    );
  }

  async function overrideReady(id: string, roomNumber: string) {
    const confirmed = window.confirm(
      `Jadikan Kamar ${roomNumber} SIAP sekarang?\n\nGunakan override hanya jika kamar sudah dipastikan bersih. Tindakan ini akan tercatat.`,
    );

    if (!confirmed) return;

    setProcessingIds((current) => [...current, id]);
    setMessage('');

    try {
      const { error: overrideError } = await supabase.rpc(
        'override_room_ready',
        { _room_id: id },
      );

      if (overrideError) {
        setMessage(overrideError.message);
        return;
      }

      await refreshAll();
    } finally {
      setProcessingIds((current) => current.filter((item) => item !== id));
    }
  }

  const checklistRoom = checklistRoomId
    ? rooms.rows.find((room) => room.id === checklistRoomId)
    : undefined;
  const checklistRoomType = checklistRoom
    ? types.rows.find((type) => type.id === checklistRoom.room_type_id)
    : undefined;

  return (
    <Kerangka judul="Housekeeping" keterangan="Kebersihan kamar hari ini">
      {message && (
        <p role="status" className="mb-4 rounded-xl bg-secondary px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['READY', activeRooms.filter((room) => room.status === 'ready').length],
          ['TERISI', activeRooms.filter((room) => room.status === 'occupied').length],
          ['PERLU DIBERSIHKAN', activeRooms.filter((room) => room.status === 'dirty').length],
          ['SELESAI HARI INI', selesaiHariIni],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-lembut">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <label className="mb-6 block text-sm font-semibold">
        Cari nomor kamar, TRX, atau HK
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Contoh: BTRDHK-000001"
          className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal"
        />
      </label>

      {canAdvance && dirtyRooms.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allDirtySelected}
              onChange={(event) =>
                setSelectedIds(
                  event.target.checked ? dirtyRooms.map((room) => room.id) : [],
                )
              }
            />
            Pilih Semua
          </label>
          <Button
            disabled={!selectedIds.length || processingIds.length > 0}
            onClick={() => void startSelected()}
          >
            MULAI ({selectedIds.length}) KAMAR
          </Button>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.key}>
            <Judul
              aksi={
                <span className="text-xs font-semibold text-muted-foreground">
                  {section.rooms.length}
                </span>
              }
            >
              {section.judul}
            </Judul>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.rooms.map((room) => {
                const roomType = types.rows.find((type) => type.id === room.room_type_id);
                const roomHistory = history.rows
                  .filter((item) => item.room_id === room.id)
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime(),
                  )
                  .slice(0, 3);

                return (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-lembut"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold">Kamar {room.room_number}</p>
                        <p className="text-sm text-muted-foreground">{roomType?.name}</p>
                      </div>
                      {section.key === 'needs_action' ? (
                        <span className="rounded-full bg-perlu px-2.5 py-1 text-[11px] font-semibold uppercase text-perlu-foreground">
                          Perlu Tindakan
                        </span>
                      ) : (
                        <LencanaStatus status={section.label} />
                      )}
                    </div>

                    {roomHistory.map((item) => (
                      <div key={item.id} className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs">
                        <p className="font-semibold">
                          {item.action === 'start_cleaning'
                            ? 'Mulai dibersihkan'
                            : item.action === 'finish_cleaning'
                              ? 'Selesai dibersihkan'
                              : 'Override menjadi siap'}
                        </p>
                        <p className="text-muted-foreground">
                          {item.performed_by_name} ·{' '}
                          {new Date(item.created_at).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                          })}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {item.job_number ?? 'HK legacy'}
                          {item.transaction_id && transactionNumbers.get(item.transaction_id)
                            ? ` · ${transactionNumbers.get(item.transaction_id)}`
                            : ''}
                        </p>
                        {item.note && <p>{item.note}</p>}
                      </div>
                    ))}

                    {section.key === 'dirty' && canAdvance && (
                      <label className="mt-4 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(room.id)}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, room.id]
                                : current.filter((id) => id !== room.id),
                            )
                          }
                        />
                        Pilih kamar
                      </label>
                    )}

                    {section.key === 'dirty' && canAdvance && (
                      <Button
                        className="mt-4 h-12 w-full rounded-xl uppercase"
                        disabled={processingIds.includes(room.id)}
                        onClick={() => void advanceOne(room.id)}
                      >
                        {processingIds.includes(room.id)
                          ? 'Memproses...'
                          : 'Mulai Bersihkan'}
                      </Button>
                    )}

                    {(section.key === 'cleaning' || section.key === 'needs_action') &&
                      room.status === 'cleaning' &&
                      canAdvance && (
                      <Button
                        className="mt-4 h-12 w-full rounded-xl uppercase"
                        disabled={processingIds.includes(room.id)}
                        onClick={() => setChecklistRoomId(room.id)}
                      >
                        {section.key === 'needs_action'
                          ? 'Periksa Kembali'
                          : 'Telah Dibersihkan'}
                      </Button>
                    )}

                    {section.key === 'needs_action' && room.status === 'ready' && (
                      <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        READY dengan kekurangan tercatat. Tinjau alasan pada riwayat audit di atas.
                      </p>
                    )}

                    {room.status !== 'ready' && canOverride && (
                      <Button
                        variant="outline"
                        className="mt-2 h-11 w-full rounded-xl uppercase"
                        disabled={processingIds.includes(room.id)}
                        onClick={() => void overrideReady(room.id, room.room_number)}
                      >
                        Jadikan Siap
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <PerawatanBerkala readOnly={!canAdvance} />

      {checklistRoom && (
        <ChecklistHousekeeping
          roomId={checklistRoom.id}
          roomNumber={checklistRoom.room_number}
          roomTypeName={checklistRoomType?.name ?? ''}
          onClose={() => setChecklistRoomId(null)}
          onSaved={async () => {
            await refreshAll();
          }}
        />
      )}
    </Kerangka>
  );
}
