import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Landmark, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kerangka } from '@/components/kerangka';
import { rpc, useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-keuangan')({
  head: () => meta('Pengaturan Keuangan', 'Minimum DP, komisi, dan rekening Owner untuk transfer.'),
  component: HalamanPengaturanKeuangan,
});

function angka(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const input = 'h-10 min-w-0 w-full rounded-md border border-input bg-background/60 px-3 text-sm';
const label = 'block min-w-0 text-xs text-muted-foreground';

// Owner finance settings moved from Keuangan; same RPCs and Owner-only gate.
function HalamanPengaturanKeuangan() {
  const { posisiKode, training } = usePeran();
  const isOwner = posisiKode === 'owner' && !training.is_training;
  const commissionConfigs = useTable('finance_commission_configs', isOwner);
  const financeSettings = useTable('finance_settings', isOwner);
  const banks = useTable('finance_bank_accounts');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [minimumDpMode, setMinimumDpMode] = useState('AMOUNT');
  const [minimumDpValue, setMinimumDpValue] = useState('0');
  const [commissionMode, setCommissionMode] = useState('PERCENTAGE');
  const [commissionRate, setCommissionRate] = useState('8');
  const [perRoomAmount, setPerRoomAmount] = useState('0');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    const setting = financeSettings.rows[0];
    const config = [...commissionConfigs.rows].sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];
    if (setting) { setMinimumDpMode(setting.minimum_dp_mode); setMinimumDpValue(String(setting.minimum_dp_value)); }
    if (config) { setCommissionMode(config.mode); setCommissionRate(String(config.rate)); setPerRoomAmount(String(config.per_room_amount)); }
  }, [commissionConfigs.rows, financeSettings.rows]);

  async function run(action: () => Promise<{ error?: { message: string } | null }>) {
    setBusy(true); setMessage('');
    try {
      const result = await action();
      if (result.error) setMessage(result.error.message);
      else { setMessage('Tersimpan.'); await Promise.all([commissionConfigs.refresh(), financeSettings.refresh(), banks.refresh()]); }
    } finally { setBusy(false); }
  }

  if (!isOwner) {
    return <Kerangka judul="Pengaturan Keuangan"><p className="panel-mewah p-5 text-sm text-muted-foreground">Halaman ini khusus Owner.</p></Kerangka>;
  }

  return (
    <Kerangka judul="Pengaturan Keuangan">
      {message && <p role="alert" className="mb-4 rounded-md bg-secondary px-3 py-2 text-sm">{message}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel-mewah p-5">
          <div className="mb-4 flex items-center gap-3"><span className="ikon-bulat h-10 w-10 text-gold"><Settings2 size={20} aria-hidden="true" /></span><h2 className="font-serif text-xl">Pengaturan minimum DP dan Komisi</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}><span className="mb-1.5 block">Ketentuan minimum DP</span><select value={minimumDpMode} onChange={(e) => setMinimumDpMode(e.target.value)} className={input}><option value="AMOUNT">Minimum nominal</option><option value="PERCENTAGE">Minimum persentase</option></select></label>
            <label className={label}><span className="mb-1.5 block">Nilai minimum DP</span><input value={minimumDpValue} onChange={(e) => setMinimumDpValue(e.target.value)} type="number" min="0" step="0.01" className={input} /></label>
            <label className={label}><span className="mb-1.5 block">Ketentuan komisi</span><select value={commissionMode} onChange={(e) => setCommissionMode(e.target.value)} className={input}><option value="OFF">Komisi OFF</option><option value="PERCENTAGE">Persentase</option><option value="PER_ROOM">Per kamar</option></select></label>
            <label className={label}><span className="mb-1.5 block">Tarif komisi (%)</span><input value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} type="number" min="0" step="0.01" className={input} /></label>
            <label className={label}><span className="mb-1.5 block">Nominal per kamar</span><input value={perRoomAmount} onChange={(e) => setPerRoomAmount(e.target.value)} type="number" min="0" className={input} /></label>
          </div>
          <Button className="mt-4 w-full" disabled={busy} onClick={() => void run(async () => {
            const first = await rpc('set_finance_settings', { _minimum_dp_mode: minimumDpMode, _minimum_dp_value: angka(minimumDpValue) });
            if (first.error) return { error: first.error };
            const second = await rpc('set_finance_commission_config', { _mode: commissionMode, _rate: angka(commissionRate), _per_room_amount: angka(perRoomAmount) });
            return { error: second.error };
          })}>Simpan Konfigurasi</Button>
        </section>
        <section className="panel-mewah p-5">
          <div className="mb-4 flex items-center gap-3"><span className="ikon-bulat h-10 w-10 text-gold"><Landmark size={20} aria-hidden="true" /></span><h2 className="font-serif text-xl">Rekening Owner untuk Transfer</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}><span className="mb-1.5 block">Bank</span><input value={bankName} onChange={(e) => setBankName(e.target.value)} className={input} /></label>
            <label className={label}><span className="mb-1.5 block">Nama pemilik</span><input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={input} /></label>
            <label className={label}><span className="mb-1.5 block">Nomor rekening</span><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={input} /></label>
          </div>
          <Button className="mt-4 w-full" disabled={busy} onClick={() => void run(async () => {
            const { error } = await rpc('upsert_finance_bank_account', { _id: null, _bank_name: bankName, _account_name: accountName, _account_number: accountNumber, _logo_key: '', _active: true });
            return { error };
          })}>Tambah Rekening</Button>
          <ul className="mt-3 space-y-2 text-sm">{banks.rows.filter((bank) => bank.active).map((bank) => <li key={bank.id} className="rounded-md bg-secondary px-3 py-2">{bank.bank_name} · {bank.account_name} · {bank.account_number}</li>)}</ul>
        </section>
      </div>
    </Kerangka>
  );
}
