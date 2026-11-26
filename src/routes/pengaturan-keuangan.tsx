import { createFileRoute } from '@tanstack/react-router';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { useEffect, useState } from 'react';
import { Settings2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionResultDialog, type ActionResultState } from '@/components/action-result-dialog';
import { Kerangka } from '@/components/kerangka';
import { rpc, useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-keuangan')({
  head: () => meta('Minimum DP & Komisi', 'Pengaturan minimum DP dan komisi Baturaden 25 Homestay.'),
  component: HalamanPengaturanKeuangan,
});

function angka(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// Owner finance settings moved from Keuangan; same RPCs and Owner-only gate.
function HalamanPengaturanKeuangan() {
  const { posisiKode, training } = usePeran();
  const isOwner = posisiKode === 'owner' && !training.is_training;
  const commissionConfigs = useTable('finance_commission_configs', isOwner);
  const financeSettings = useTable('finance_settings', isOwner);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState<ActionResultState | null>(null);
  const [minimumDpMode, setMinimumDpMode] = useState('AMOUNT');
  const [minimumDpValue, setMinimumDpValue] = useState('0');
  const [commissionMode, setCommissionMode] = useState('PERCENTAGE');
  const [commissionRate, setCommissionRate] = useState('8');
  const [perRoomAmount, setPerRoomAmount] = useState('0');

  useEffect(() => {
    const setting = financeSettings.rows[0];
    const config = [...commissionConfigs.rows].sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];
    if (setting) { setMinimumDpMode(setting.minimum_dp_mode); setMinimumDpValue(String(setting.minimum_dp_value)); }
    if (config) { setCommissionMode(config.mode); setCommissionRate(String(config.rate)); setPerRoomAmount(String(config.per_room_amount)); }
  }, [commissionConfigs.rows, financeSettings.rows]);

  async function run(
    action: () => Promise<{ error?: { message: string } | null; partial?: boolean; validationError?: string }>,
    successLabel: string,
  ) {
    if (!isOwner || busy) return;
    setBusy(true);
    setActionResult(null);
    try {
      // The two existing RPC calls are deliberately not treated as atomic.
      // We must not claim full success if only the first (minimum DP) was accepted.
      const result = await action();
      if (result.error) {
        if (result.partial) {
          const reread = await Promise.allSettled([
            financeSettings.refresh({ throwOnError: true }),
            commissionConfigs.refresh({ throwOnError: true }),
          ]);
          const readFailed = reread.some(item => item.status === 'rejected');
          setActionResult({
            kind: 'error',
            title: 'Konfigurasi tersimpan sebagian',
            description: readFailed
              ? 'Minimum DP sudah diterima sistem, tetapi pembaruan komisi bermasalah dan data terbaru belum dapat diperiksa. Periksa kedua pengaturan sebelum menyimpan ulang.'
              : 'Minimum DP berhasil disimpan, tetapi komisi belum berhasil diperbarui. Periksa kedua pengaturan sebelum mengulangi penyimpanan.',
          });
        } else {
          setActionResult({
            kind: 'error',
            title: result.validationError ? 'Nilai pengaturan belum valid' : 'Konfigurasi belum dapat disimpan',
            description: result.validationError ??
              'Sistem belum dapat mengonfirmasi penyimpanan Minimum DP. Periksa pengaturan yang berlaku sebelum mencoba kembali.',
          });
        }
        return;
      }

      // A backend acknowledgement alone cannot prove what is currently readable.
      const reread = await Promise.allSettled([
        financeSettings.refresh({ throwOnError: true }),
        commissionConfigs.refresh({ throwOnError: true }),
      ]);
      if (reread.some(item => item.status === 'rejected')) {
        setActionResult({
          kind: 'error',
          title: 'Periksa kembali konfigurasi',
          description: 'Kedua penyimpanan diterima sistem, tetapi hasil terbaru belum dapat dibaca sepenuhnya. Periksa Minimum DP dan komisi sebelum menyimpan ulang.',
        });
        return;
      }
      setActionResult({
        kind: 'success',
        title: successLabel,
        description: 'Pengaturan Minimum DP dan komisi telah disimpan, dan data terbaru berhasil dimuat ulang.',
      });
    } catch {
      setActionResult({
        kind: 'error',
        title: 'Hasil penyimpanan belum dapat dipastikan',
        description: 'Terjadi gangguan saat memproses konfigurasi. Sebagian perubahan mungkin sudah tersimpan. Periksa Minimum DP dan komisi sebelum mencoba kembali.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) {
    return <Kerangka judul="Pengaturan Keuangan"><SubPengaturan><p className="panel-mewah p-5 text-sm text-muted-foreground">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;
  }

  return (
    <Kerangka judul="Minimum DP & Komisi" keterangan="Pengaturan keuangan Owner Baturaden 25 Homestay.">
      <SubPengaturan>
        <section className="panel-mewah mx-auto max-w-2xl p-5 sm:p-7" aria-labelledby="judul-minimum-dp">
          <div className="mb-5 flex items-start gap-3">
            <span className="ikon-bulat flex size-11 shrink-0 items-center justify-center text-gold"><Settings2 size={22} aria-hidden="true" /></span>
            <div>
              <h1 id="judul-minimum-dp" className="font-serif text-xl font-bold">Minimum DP & Komisi</h1>
              <p className="mt-1 text-sm text-muted-foreground">Ketentuan pembayaran awal reservasi dan perhitungan komisi karyawan.</p>
            </div>
          </div>
          {(financeSettings.loading || commissionConfigs.loading) && <p role="status" className="mb-3 text-sm">Memuat pengaturan keuangan…</p>}
          {(financeSettings.error || commissionConfigs.error) && <p role="alert" className="mb-3 text-sm text-destructive">{financeSettings.error || commissionConfigs.error}</p>}
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Ketentuan minimum DP
              <select value={minimumDpMode} onChange={e => setMinimumDpMode(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm">
                <option value="AMOUNT">Minimum nominal</option><option value="PERCENTAGE">Minimum persentase</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">Nilai minimum DP {minimumDpMode === 'PERCENTAGE' ? '(%)' : '(Rp)'}
              <input value={minimumDpValue} onChange={e => setMinimumDpValue(e.target.value)} type="number" min="0" step={minimumDpMode === 'PERCENTAGE' ? '0.01' : '1'} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
            </label>
            <div className="h-px bg-gold/20" />
            <label className="block text-sm font-semibold">Ketentuan komisi
              <select value={commissionMode} onChange={e => setCommissionMode(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm">
                <option value="OFF">Komisi OFF</option><option value="PERCENTAGE">Persentase</option><option value="PER_ROOM">Per kamar</option>
              </select>
            </label>
            {commissionMode === 'PERCENTAGE' && <label className="block text-sm font-semibold">Tarif komisi (%)
              <input value={commissionRate} onChange={e => setCommissionRate(e.target.value)} type="number" min="0" max="100" step="0.01" className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
            </label>}
            {commissionMode === 'PER_ROOM' && <label className="block text-sm font-semibold">Nominal komisi per kamar (Rp)
              <input value={perRoomAmount} onChange={e => setPerRoomAmount(e.target.value)} type="number" min="0" step="1" className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
            </label>}
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />Perubahan mengikuti aturan backend resmi dan tidak mengubah transaksi yang telah ditutup.</p>
            <Button className="w-full" disabled={busy || financeSettings.loading || commissionConfigs.loading || !!financeSettings.error || !!commissionConfigs.error} onClick={() => void run(async () => {
              const dp = Number(minimumDpValue);
              const rate = Number(commissionRate);
              const roomAmount = Number(perRoomAmount);
              if (!Number.isFinite(dp) || dp < 0 || (minimumDpMode === 'PERCENTAGE' && dp > 100)) return { error: { message: 'Nilai DP tidak valid.' }, validationError: 'Nilai DP tidak valid.' };
              if (commissionMode === 'PERCENTAGE' && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return { error: { message: 'Persentase komisi harus 0–100.' }, validationError: 'Persentase komisi harus 0–100.' };
              if (commissionMode === 'PER_ROOM' && (!Number.isFinite(roomAmount) || roomAmount < 0)) return { error: { message: 'Nominal per kamar tidak valid.' }, validationError: 'Nominal per kamar tidak valid.' };
              const first = await rpc('set_finance_settings', { _minimum_dp_mode: minimumDpMode, _minimum_dp_value: dp });
              if (first.error) return { error: first.error };
              const second = await rpc('set_finance_commission_config', { _mode: commissionMode, _rate: angka(commissionRate), _per_room_amount: angka(perRoomAmount) });
              return { error: second.error, partial: Boolean(second.error) };
            }, 'Minimum DP dan komisi berhasil disimpan')}>
              {busy ? 'Menyimpan…' : 'Simpan Konfigurasi'}
            </Button>
          </div>
        </section>
        <ActionResultDialog result={actionResult} onClose={() => setActionResult(null)} />
      </SubPengaturan>
    </Kerangka>
  );
}
