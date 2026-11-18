import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTable } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';

type ChecklistKey =
  | 'towel_ok'
  | 'mineral_water_ok'
  | 'tissue_ok'
  | 'ashtray_ok'
  | 'tv_remote_ok'
  | 'fan_ok'
  | 'exhaust_fan_ok';

type ChecklistState = Record<ChecklistKey, boolean | null>;
type ReasonState = Record<ChecklistKey, string>;

const items: Array<{ key: ChecklistKey; label: string }> = [
  { key: 'towel_ok', label: 'Handuk: 2 buah' },
  { key: 'mineral_water_ok', label: 'Air mineral: 2 botol' },
  { key: 'tissue_ok', label: 'Tisu: tersedia' },
  { key: 'ashtray_ok', label: 'Asbak: tersedia' },
  { key: 'tv_remote_ok', label: 'TV + Remot: normal' },
  { key: 'fan_ok', label: 'Kipas Angin: normal' },
  { key: 'exhaust_fan_ok', label: 'Exhaust Fan: normal' },
];

export function ChecklistHousekeeping({
  roomId,
  roomNumber,
  roomTypeName,
  onClose,
  onSaved,
}: {
  roomId: string;
  roomNumber: string;
  roomTypeName?: string;
  onClose: () => void;
  onSaved: (result: 'passed' | 'needs_action') => Promise<void>;
}) {
  const maintenance = useTable('housekeeping_maintenance');
  const checklistId = useRef(crypto.randomUUID());
  const [checks, setChecks] = useState<ChecklistState>({
    towel_ok: null,
    mineral_water_ok: null,
    tissue_ok: null,
    ashtray_ok: null,
    tv_remote_ok: null,
    fan_ok: null,
    exhaust_fan_ok: null,
  });
  const [reasons, setReasons] = useState<ReasonState>({
    towel_ok: '',
    mineral_water_ok: '',
    tissue_ok: '',
    ashtray_ok: '',
    tv_remote_ok: '',
    fan_ok: '',
    exhaust_fan_ok: '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const committed = useRef<'passed' | 'needs_action' | null>(null);
  const [saved, setSaved] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const superiorBToilet =
    roomTypeName === 'Superior B' && ['02', '03', '04'].includes(roomNumber)
      ? `Toilet Superior B · ${roomNumber}`
      : null;

  const lastSuperiorBToilet = superiorBToilet
    ? maintenance.rows
        .filter(
          (item) =>
            item.work_type === 'toilet' &&
            item.location_code === superiorBToilet,
        )
        .sort(
          (a, b) =>
            new Date(b.performed_at).getTime() -
            new Date(a.performed_at).getTime(),
        )[0]
    : undefined;

  async function save() {
    if (inFlight.current) return;
    setMessage('');

    if (!committed.current && Object.values(checks).some((value) => value === null)) {
      setMessage('Semua item checklist wajib dijawab.');
      return;
    }

    if (
      !committed.current && items.some(
        (item) => checks[item.key] === false && !reasons[item.key].trim(),
      )
    ) {
      setMessage('Setiap item bertanda X wajib memiliki alasan.');
      return;
    }

    inFlight.current = true;
    setSaving(true);

    try {
      if (!committed.current) {
        setUncertain(true);
        const { error } = await supabase.rpc('complete_housekeeping_checklist', {
          _room_id: roomId,
          _checklist_id: checklistId.current,
          _towel_ok: checks.towel_ok as boolean,
          _mineral_water_ok: checks.mineral_water_ok as boolean,
          _tissue_ok: checks.tissue_ok as boolean,
          _ashtray_ok: checks.ashtray_ok as boolean,
          _tv_remote_ok: checks.tv_remote_ok as boolean,
          _fan_ok: checks.fan_ok as boolean,
          _exhaust_fan_ok: checks.exhaust_fan_ok as boolean,
          _issue_note: JSON.stringify(
            Object.fromEntries(
              items.map((item) => [item.key.replace(/_ok$/, ''), reasons[item.key].trim()]),
            ),
          ),
        });

        if (error) {
          // PostgREST also returns transport errors here; preserve the submitted
          // answers and idempotency key until the outcome is confirmed.
          setMessage(error.message);
          return;
        }

        const result = Object.values(checks).every(Boolean)
          ? 'passed'
          : 'needs_action';
        setUncertain(false);
        committed.current = result;
        setSaved(true);
      }
      try {
        await onSaved(committed.current);
      } catch {
        setMessage('Checklist sudah tersimpan. Pemuatan ulang gagal. Coba muat ulang tanpa menyimpan kembali.');
        return;
      }
      onClose();
    } catch {
      setMessage('Hasil penyimpanan belum dapat dipastikan. Coba lagi memakai ID checklist yang sama.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Checklist akhir Kamar ${roomNumber}`}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-5 shadow-lembut"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Checklist akhir
            </p>
            <h2 className="text-lg font-bold">Kamar {roomNumber}</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.key}
              className="space-y-2"
            >
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm">{item.label}</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={saving || saved || uncertain}
                    size="sm"
                    variant={checks[item.key] === true ? 'default' : 'outline'}
                    aria-label={`${item.label} sesuai`}
                    onClick={() => {
                      setChecks((current) => ({
                        ...current,
                        [item.key]: true,
                      }));
                      setReasons((current) => ({
                        ...current,
                        [item.key]: '',
                      }));
                    }}
                  >
                    ✔
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || saved || uncertain}
                    size="sm"
                    variant={checks[item.key] === false ? 'destructive' : 'outline'}
                    aria-label={`${item.label} bermasalah`}
                    onClick={() =>
                      setChecks((current) => ({
                        ...current,
                        [item.key]: false,
                      }))
                    }
                  >
                    ✕
                  </Button>
                </div>
              </div>
              {checks[item.key] === false && (
                <label className="block text-sm">
                  Alasan {item.label}
                  <input
                    required
                    disabled={saving || saved || uncertain}
                    value={reasons[item.key]}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [item.key]: event.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
                    placeholder="Wajib diisi"
                  />
                </label>
              )}
            </div>
          ))}

          {superiorBToilet && (
            <div className="rounded-xl bg-secondary px-3 py-2 text-xs">
              <p className="font-semibold">Riwayat toilet Superior B</p>
              <p>
                {lastSuperiorBToilet
                  ? `${lastSuperiorBToilet.performed_by_name} · ${new Date(lastSuperiorBToilet.performed_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                  : 'Belum ada riwayat perawatan.'}
              </p>
            </div>
          )}

          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Batal
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Memproses…' : saved ? 'Muat ulang status' : 'Selesai Bersihkan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
