import { createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Landmark, ShieldCheck, Pencil, Power } from 'lucide-react';
import { ActionResultDialog, type ActionResultState } from '@/components/action-result-dialog';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { Button } from '@/components/ui/button';
import { rpc, useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-rekening-owner')({
  head: () => meta('Rekening Owner', 'Kelola rekening penerima transfer Baturaden 25 Homestay.'),
  component: RekeningOwner,
});

type Bank = ReturnType<typeof useTable<'finance_bank_accounts'>>['rows'][number];
function RekeningOwner() {
  const { siap, posisiKode, training } = usePeran();
  const owner = siap && posisiKode === 'owner' && !training.is_training;
  const banks = useTable('finance_bank_accounts', owner);
  const [selected, setSelected] = useState<Bank | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionResult, setActionResult] = useState<ActionResultState | null>(null);

  function edit(bank: Bank) {
    setSelected(bank);
    setBankName(bank.bank_name);
    setAccountName(bank.account_name);
    setAccountNumber(bank.account_number);
    setError('');
  }
  function reset() {
    setSelected(null);
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || busy || banks.loading || !!banks.error) return;
    const name = bankName.trim();
    const holder = accountName.trim();
    const number = accountNumber.replace(/\s/g, '');
    if (!name || !holder || !/^[0-9]{5,30}$/.test(number)) {
      const detail = 'Periksa nama bank, nama pemilik rekening, dan nomor rekening (5–30 digit).';
      setError(detail);
      setActionResult({ kind: 'error', title: 'Rekening belum dapat disimpan', description: detail });
      return;
    }
    setBusy(true);
    setError('');
    const editing = selected !== null;
    let writeConfirmed = false;
    try {
      const { error: writeError } = await rpc('upsert_finance_bank_account', {
        _id: selected?.id ?? null, _bank_name: name, _account_name: holder,
        _account_number: number, _logo_key: selected?.logo_key ?? '',
        _active: selected?.active ?? true,
      });
      if (writeError) throw new Error(writeError.message);
      writeConfirmed = true;
      await banks.refresh({ throwOnError: true });
      reset();
      setActionResult({
        kind: 'success',
        title: editing ? 'Rekening berhasil diperbarui' : 'Rekening berhasil ditambahkan',
        description: editing
          ? 'Perubahan rekening telah disimpan dan daftar rekening berhasil diperbarui.'
          : 'Rekening Owner telah disimpan dan muncul dalam daftar rekening.',
      });
    } catch {
      const detail = writeConfirmed
        ? 'Perubahan mungkin sudah tersimpan, tetapi daftar rekening belum dapat diperbarui. Periksa data sebelum mengulangi.'
        : 'Penyimpanan rekening belum berhasil dikonfirmasi. Periksa data dan akses sebelum mencoba kembali.';
      setError(detail);
      setActionResult({
        kind: 'error',
        title: writeConfirmed ? 'Periksa kembali data rekening' : 'Rekening gagal disimpan',
        description: detail,
      });
    } finally {
      setBusy(false);
    }
  }
  async function toggle(bank: Bank) {
    if (!owner || busy || banks.loading || !!banks.error) return;
    setBusy(true);
    setError('');
    let writeConfirmed = false;
    try {
      const { error: writeError } = await rpc('upsert_finance_bank_account', {
        _id: bank.id, _bank_name: bank.bank_name, _account_name: bank.account_name,
        _account_number: bank.account_number, _logo_key: bank.logo_key, _active: !bank.active,
      });
      if (writeError) throw new Error(writeError.message);
      writeConfirmed = true;
      await banks.refresh({ throwOnError: true });
      if (selected?.id === bank.id) reset();
      setActionResult({
        kind: 'success',
        title: bank.active ? 'Rekening berhasil dinonaktifkan' : 'Rekening berhasil diaktifkan',
        description: bank.active
          ? 'Status rekening telah diperbarui menjadi nonaktif.'
          : 'Status rekening telah diperbarui menjadi aktif.',
      });
    } catch {
      const detail = writeConfirmed
        ? 'Status rekening mungkin sudah berubah, tetapi daftar belum dapat dimuat ulang. Periksa kembali sebelum mengulangi.'
        : 'Perubahan status rekening belum berhasil dikonfirmasi. Periksa data sebelum mencoba kembali.';
      setError(detail);
      setActionResult({
        kind: 'error',
        title: writeConfirmed ? 'Periksa kembali status rekening' : 'Perubahan status rekening gagal',
        description: detail,
      });
    } finally {
      setBusy(false);
    }
  }

  if (!siap) return <Kerangka judul="Rekening Owner"><SubPengaturan><p>Memeriksa akses…</p></SubPengaturan></Kerangka>;
  if (!owner) return <Kerangka judul="Rekening Owner"><SubPengaturan><p role="alert">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;

  return (
    <Kerangka judul="Rekening Owner" keterangan="Rekening tujuan transfer milik Owner.">
      <SubPengaturan>
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="panel-mewah p-5 sm:p-7" aria-labelledby="rekening-owner-title">
            <div className="mb-5 flex items-start gap-3">
              <span className="ikon-bulat flex size-11 shrink-0 items-center justify-center text-gold"><Landmark size={22} aria-hidden="true" /></span>
              <div>
                <h1 id="rekening-owner-title" className="font-serif text-xl font-bold">{selected ? 'Ubah Rekening Owner' : 'Tambah Rekening Owner'}</h1>
                <p className="mt-1 text-sm text-muted-foreground">Rekening resmi yang digunakan sebagai tujuan transfer. Hanya Owner yang dapat mengelolanya.</p>
              </div>
            </div>
            <form onSubmit={e => void save(e)} className="space-y-4">
              <label className="block text-sm font-semibold">Nama bank
                <input required maxLength={100} value={bankName} onChange={e => setBankName(e.target.value)} disabled={busy} placeholder="Contoh: BCA" className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold">Nama pemilik rekening
                <input required maxLength={150} value={accountName} onChange={e => setAccountName(e.target.value)} disabled={busy} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold">Nomor rekening
                <input required inputMode="numeric" maxLength={30} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} disabled={busy} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm" />
              </label>
              <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />Cek kembali nomor rekening sebelum disimpan. Rekening lama tidak dihapus otomatis.</p>
              {(error || banks.error) && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error || banks.error}</p>}
              <Button className="w-full" disabled={busy || banks.loading || !!banks.error}>{busy ? 'Menyimpan…' : selected ? 'Simpan Perubahan Rekening' : 'Tambah Rekening'}</Button>
              {selected && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={reset}>Batal Mengubah</Button>}
            </form>
          </section>

          <section className="panel-mewah p-5 sm:p-7" aria-label="Daftar rekening Owner">
            <h2 className="font-serif text-lg font-bold">Daftar Rekening Owner</h2>
            <p className="mt-1 mb-4 text-xs text-muted-foreground">Rekening aktif maupun nonaktif tetap ditampilkan untuk pengawasan Owner.</p>
            {banks.loading && <p role="status" className="text-sm">Memuat rekening…</p>}
            {!banks.loading && !banks.error && banks.rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada rekening yang tercatat.</p>}
            <div className="space-y-3">
              {banks.rows.map(bank => <div key={bank.id} className="rounded-xl border border-gold/20 bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{bank.bank_name} <span className="ml-2 text-xs font-normal text-muted-foreground">{bank.active ? 'Aktif' : 'Nonaktif'}</span></p>
                    <p className="mt-1 break-all font-mono text-sm">{bank.account_number}</p>
                    <p className="mt-1 text-xs text-muted-foreground">a.n. {bank.account_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => edit(bank)}><Pencil className="mr-1 size-3.5" />Ubah</Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggle(bank)}><Power className="mr-1 size-3.5" />{bank.active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                  </div>
                </div>
              </div>)}
            </div>
          </section>
        </div>
        <ActionResultDialog result={actionResult} onClose={() => setActionResult(null)} />
      </SubPengaturan>
    </Kerangka>
  );
}
