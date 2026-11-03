import { rpc } from "@/lib/data-live";
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Wallet, Banknote, QrCode, Landmark, Percent, RotateCcw, ArrowUpRight, ArrowDownLeft, ClipboardCheck, CalendarDays, ReceiptText, Coins, Check, Search, SlidersHorizontal, Send, BadgeCheck, Clock, Upload, Info, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kerangka } from '@/components/kerangka';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import { rupiah } from '@/lib/data-contoh';
import { meta } from '@/lib/meta';
import { setSesiKasKonteks } from '@/lib/sesi-kas';
import { ReceiptTemplateEditor } from '@/components/receipt-template-editor';
import { featureFlags } from '@/lib/feature-flags';

export const Route = createFileRoute('/keuangan')({
  head: () => meta('Keuangan', 'Sesi kas, penerimaan, closing, dan pengawasan keuangan.'),
  component: HalamanKeuangan,
});

type NumericSummaryValue = number | string | null | undefined;
type Summary = {
  expected_cash?: NumericSummaryValue;
  opening_cash?: NumericSummaryValue;
  cash?: NumericSummaryValue;
  expenses?: NumericSummaryValue;
  refunds?: NumericSummaryValue;
  snapshot?: { expected_cash?: NumericSummaryValue } | null;
  [key: string]: unknown;
};

function angkaRingkasan(value: NumericSummaryValue) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function angka(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const panelIcons: Record<string, LucideIcon> = {
  'Sesi Kas': Wallet, 'Closing Sesi Kas': ClipboardCheck, 'Aktivitas Keuangan': ReceiptText,
  'Setoran': Upload, 'Serah terima DI LACI': Wallet, 'Refund Owner': RotateCcw, 'Ringkasan Hari Ini': Clock,
};

// Page-local presentation keeps existing data, conditions, and finance actions unchanged.
function Panel({ judul, sub, kanan, children }: { judul: string; sub?: string; kanan?: ReactNode; children: ReactNode }) {
  const Icon = panelIcons[judul] ?? Info;
  return (
    <section className="panel-mewah min-w-0 overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ikon-bulat h-11 w-11 shrink-0 text-gold"><Icon size={22} aria-hidden="true" /></span>
          <div className="min-w-0"><h2 className="font-serif text-2xl leading-tight text-foreground">{judul}</h2>{sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}</div>
        </div>
        {kanan}
      </div>
      {children}
    </section>
  );
}

function HalamanKeuangan() {
  const { posisiKode, training } = usePeran();
  const isTraining = training.is_training;
  const isOwner = posisiKode === 'owner' && !isTraining;
  const canCloseOthers = !isTraining && (isOwner || posisiKode === 'supervisor');
  const [userId, setUserId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary>({});
  const [openingCash, setOpeningCash] = useState('0');
  const [setorCash, setSetorCash] = useState('0');
  const [setorTransfer, setSetorTransfer] = useState('0');
  const [diLaci, setDiLaci] = useState('0');
  const [dibawa, setDibawa] = useState('0');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [closingReason, setClosingReason] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [filterBuka, setFilterBuka] = useState(false);
  const [filterJenis, setFilterJenis] = useState<'' | 'Penerimaan' | 'Setoran' | 'Pengeluaran' | 'Refund'>('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('CASH');
  const [depositBankId, setDepositBankId] = useState('');
  const [depositProof, setDepositProof] = useState('');
  const [refundTransactionId, setRefundTransactionId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundSourceType, setRefundSourceType] = useState('OWNER_FUNDS');
  const [refundSourceSessionId, setRefundSourceSessionId] = useState('');
  const [handoffActual, setHandoffActual] = useState('');
  const [handoffReason, setHandoffReason] = useState('');

  const sessions = useTable('finance_cash_sessions');
  const deposits = useTable('finance_deposits');
  const banks = useTable('finance_bank_accounts');
  const employees = useTable('employees');
  const handoffs = useTable('finance_drawer_handoffs');
  const expenses = useTable('finance_expenses');
  const transactions = useTable('transactions');
  const payments = useTable('payments');
  const refunds = useTable('finance_refunds', isOwner);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''));
  }, []);

  const activeSession = useMemo(
    () => isTraining
      ? sessions.rows.find((session) => session.id === training.session_id && session.status === 'OPEN')
      : sessions.rows.find((session) => session.opened_by === userId && session.status === 'OPEN'),
    [isTraining, sessions.rows, training.session_id, userId],
  );

  const selectedSession = activeSession ?? (canCloseOthers
    ? sessions.rows.find((session) => session.id === selectedSessionId && session.status === 'OPEN')
      ?? sessions.rows.find((session) => session.status === 'OPEN')
    : undefined);

  useEffect(() => {
    if (!sessions.loading) {
      setSesiKasKonteks(selectedSession?.id ?? null);
    }
  }, [selectedSession?.id, sessions.loading]);

  async function refreshFinance() {
    await Promise.all([sessions.refresh(), deposits.refresh(), payments.refresh(), refunds.refresh(), banks.refresh(), employees.refresh(), handoffs.refresh(), expenses.refresh()]);
    if (selectedSession) {
      const { data } = await rpc(isTraining ? 'get_training_finance_session_summary' : 'get_finance_session_summary', {
        _session_id: selectedSession.id,
      });
      setSummary((data as Summary | null) ?? {});
    }
  }

  useEffect(() => {
    if (!selectedSession) {
      setSummary({});
      return;
    }
    void rpc(isTraining ? 'get_training_finance_session_summary' : 'get_finance_session_summary', { _session_id: selectedSession.id }).then(({ data }) => {
      setSummary((data as Summary | null) ?? {});
    });
  }, [isTraining, selectedSession?.id]);

  async function run(action: () => Promise<{ error?: { message: string } | null }>) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (result.error) setMessage(result.error.message);
      else await refreshFinance();
    } finally {
      setBusy(false);
    }
  }

  async function openSession() {
    await run(async () => {
      const { error } = await rpc('open_finance_cash_session', { _opening_cash: angka(openingCash) });
      return { error };
    });
  }

  const expectedCash = angkaRingkasan(summary.expected_cash)
    ?? angkaRingkasan(summary.snapshot?.expected_cash)
    ?? (() => {
      const openingCash = angkaRingkasan(summary.opening_cash);
      const cashReceived = angkaRingkasan(summary.cash);
      const expensesTotal = angkaRingkasan(summary.expenses);
      const refundsTotal = angkaRingkasan(summary.refunds);
      const sessionExpenseRows = expenses.rows.filter((expense) => expense.session_id === selectedSession?.id);
      const visibleExpenseTotal = sessionExpenseRows.reduce((total, expense) => total + Number(expense.amount), 0);
      const cashExpenseTotal = sessionExpenseRows
        .filter((expense) => expense.method.toUpperCase() === 'CASH')
        .reduce((total, expense) => total + Number(expense.amount), 0);
      const expensesAreComplete = expensesTotal !== null
        && Math.abs(visibleExpenseTotal - expensesTotal) < 0.005;
      if (openingCash === null || cashReceived === null || refundsTotal !== 0 || !expensesAreComplete) return null;
      return openingCash + cashReceived - cashExpenseTotal;
    })();
  const hasExpectedCash = expectedCash !== null;
  const cashDeficit = hasExpectedCash && expectedCash < 0;

  async function closeSession() {
    if (!selectedSession) return;
    if (!hasExpectedCash) {
      setMessage('Saldo kas belum tersedia. Muat ulang ringkasan sebelum closing.');
      return;
    }
    await run(async () => {
      const { error } = await rpc('close_finance_cash_session', {
        _session_id: selectedSession.id,
        _allocation: {
          setor_cash: cashDeficit ? 0 : angka(setorCash),
          setor_transfer: angka(setorTransfer),
          di_laci: cashDeficit ? 0 : angka(diLaci),
          dibawa: cashDeficit ? 0 : angka(dibawa),
          recipient_user_id: cashDeficit ? null : recipientUserId || null,
        },
        _reason: closingReason,
      });
      return { error };
    });
  }

  async function submitDeposit() {
    if (!selectedSession || !depositAmount) return;
    await run(async () => {
      const { error } = await rpc(isTraining ? 'create_training_finance_deposit' : 'create_finance_deposit', {
        _idempotency_key: crypto.randomUUID(),
        _session_id: selectedSession.id,
        _method: depositMethod,
        _amount: angka(depositAmount),
        _bank_account_id: depositMethod === 'Transfer' ? depositBankId || null : null,
        _proof_ref: depositProof,
      });
      return { error };
    });
  }

  async function refund() {
    if (!refundTransactionId || !refundAmount || !refundReason) return;
    await run(async () => {
      const { error } = await rpc('create_finance_refund', { _idempotency_key: crypto.randomUUID(), _transaction_id: refundTransactionId, _amount: angka(refundAmount), _refund_method: refundMethod, _source_type: refundSourceType, _source_session_id: refundSourceType === 'OWNER_FUNDS' ? null : refundSourceSessionId || null, _reason: refundReason });
      return { error };
    });
  }

  async function decideDeposit(id: string, status: 'DITERIMA' | 'DITOLAK' | 'BELUM_DITERIMA') {
    await run(async () => {
      const { error } = await rpc('decide_finance_deposit', { _deposit_id: id, _status: status, _reason: status === 'DITERIMA' ? '' : 'Perlu tindak lanjut Owner' });
      return { error };
    });
  }

  async function confirmHandoff(id: string) {
    if (!handoffActual) return;
    await run(async () => {
      const { error } = await rpc('confirm_finance_drawer_handover', {
        _handoff_id: id,
        _actual_amount: angka(handoffActual),
        _reason: handoffReason,
      });
      return { error };
    });
  }

  const sid = selectedSession?.id;
  const sessionPayments = payments.rows.filter((payment) => payment.cash_session_id === sid);
  const sessionDeposits = deposits.rows.filter((deposit) => deposit.session_id === sid);
  const sessionExpenses = expenses.rows.filter((expense) => expense.session_id === sid);
  const sessionRefunds = refunds.rows.filter((item) => item.source_session_id === sid);
  const byMethod = (method: string) => sessionPayments.filter((payment) => payment.method.toUpperCase() === method.toUpperCase());
  const total = (rows: { amount: number }[]) => rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const nama = (id?: string | null) => employees.rows.find((employee) => employee.user_id === id)?.name ?? 'Tidak diketahui';
  const nomorTrx = (id: string) => transactions.rows.find((transaction) => transaction.id === id)?.transaction_number ?? 'Transaksi';
  const tanggalPanjang = selectedSession
    ? new Date(`${selectedSession.operational_date}T00:00:00+07:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    : '';
  const totalCash = Number(summary['cash'] ?? 0);
  const totalQris = Number(summary['qris'] ?? 0);
  const totalTransfer = Number(summary['transfer'] ?? 0);
  const confirmedDeposits = sessionDeposits.filter((deposit) => deposit.status === 'DITERIMA');
  const waitingDeposits = sessionDeposits.filter((deposit) => deposit.status === 'MENUNGGU_KONFIRMASI_OWNER');

  type Aktivitas = { id: string; waktu: string; jenis: 'Penerimaan' | 'Setoran' | 'Pengeluaran' | 'Refund'; ket: string; metode: string; nominal: number; petugas: string };
  const aktivitas: Aktivitas[] = [
    ...sessionPayments.map((payment) => ({ id: `p-${payment.id}`, waktu: payment.created_at, jenis: 'Penerimaan' as const, ket: `Pembayaran ${nomorTrx(payment.transaction_id)}`, metode: payment.method, nominal: Number(payment.amount), petugas: nama(payment.recorded_by) })),
    ...sessionDeposits.map((deposit) => ({ id: `d-${deposit.id}`, waktu: deposit.created_at, jenis: 'Setoran' as const, ket: 'Setoran ke rekening owner', metode: deposit.method, nominal: Number(deposit.amount), petugas: nama(deposit.submitted_by) })),
    ...sessionExpenses.map((expense) => ({ id: `e-${expense.id}`, waktu: expense.created_at, jenis: 'Pengeluaran' as const, ket: [expense.expense_number, expense.category, expense.note].filter(Boolean).join(' · '), metode: expense.method, nominal: Number(expense.amount), petugas: nama((expense as { created_by?: string }).created_by) })),
    ...sessionRefunds.map((item) => ({ id: `r-${item.id}`, waktu: item.created_at, jenis: 'Refund' as const, ket: `Refund ${nomorTrx(item.transaction_id)} - ${item.reason}`, metode: item.refund_method, nominal: Number(item.amount), petugas: nama(item.created_by) })),
  ]
    .filter((row) => !filterJenis || row.jenis === filterJenis)
    .filter((row) => {
      const term = expenseSearch.trim().toLowerCase();
      return !term || [row.ket, row.metode, String(row.nominal), row.jenis].some((value) => value.toLowerCase().includes(term));
    })
    .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());

  const warnaJenis: Record<Aktivitas['jenis'], string> = {
    Penerimaan: 'bg-siap text-siap-foreground',
    Setoran: 'bg-gold/15 text-gold',
    Pengeluaran: 'bg-bahaya text-bahaya-foreground',
    Refund: 'bg-bahaya text-bahaya-foreground',
  };
  const input = 'h-11 min-w-0 w-full rounded-md border border-input bg-background/60 px-3 text-sm';
  const label = 'block min-w-0 text-xs text-muted-foreground';

  return (
    <Kerangka judul="Keuangan" keterangan="Penerimaan, sesi kas, closing, dan pengawasan Owner">
      {message && <p role="alert" className="mb-4 rounded-md bg-secondary px-3 py-2 text-sm">{message}</p>}
      {isOwner && featureFlags.receipt58mm && <div className="mb-6"><ReceiptTemplateEditor /></div>}
      {isTraining && (
        <p className="mb-4 rounded-md bg-perlu px-3 py-2 text-sm text-perlu-foreground">
          Training aktif sampai {training.ends_on ?? 'tanggal selesai'}; sesi kas milik Supervisor/Owner ditentukan otomatis. Peserta tidak dapat membuka atau menutup sesi.
        </p>
      )}
      {!activeSession && !isTraining && (
        <div className="mb-5"><Panel judul="Sesi Kas" sub="Buka sesi kas sebelum menerima pembayaran.">
          <div className="flex items-end gap-2"><label className={label}><span className="mb-1.5 block">Saldo Awal</span><RpInput value={openingCash} onChange={setOpeningCash} /></label><Button disabled={busy} onClick={() => void openSession()}>Buka Sesi</Button></div>
        </Panel></div>
      )}
      {selectedSession && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {([
            ['Penerimaan Sesi', summary['payments_total'], sessionPayments.length, ArrowDownLeft, 'bg-siap text-siap-foreground'],
            ['Cash', summary['cash'], byMethod('CASH').length, Banknote, 'bg-gold/15 text-gold'],
            ['QRIS', summary['qris'], byMethod('QRIS').length, QrCode, 'bg-gold/15 text-gold'],
            ['Transfer', summary['transfer'], byMethod('Transfer').length, Landmark, 'bg-gold/15 text-gold'],
            ['Komisi', summary['commission'], sessionPayments.filter((payment) => Number(payment.commission_amount ?? 0) > 0).length, Percent, 'bg-gold/15 text-gold'],
            ['Refund', summary['refunds'], sessionRefunds.length, RotateCcw, 'bg-bahaya text-bahaya-foreground'],
            ['Pengeluaran', summary['expenses'], sessionExpenses.length, ArrowUpRight, 'bg-bahaya text-bahaya-foreground'],
          ] as const).map(([judul, nilai, jumlah, Icon, warna]) => (
            <div key={judul} className="panel-mewah flex min-w-0 flex-col gap-2 p-3.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${warna}`}><Icon size={18} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm leading-snug text-foreground">{judul}</p>
                <p className="mt-1 whitespace-nowrap text-lg font-semibold leading-snug tabular-nums">{rupiah(Number(nilai ?? 0))}</p>
                <p className="text-xs text-muted-foreground">{jumlah} transaksi</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-5">
          {selectedSession && (
            <Panel judul="Sesi Kas" sub="Informasi sesi kas operasional hari ini." kanan={<span className="flex items-center gap-2 rounded-full border border-siap-foreground/30 bg-siap/40 px-4 py-1.5 text-sm font-semibold text-siap-foreground"><span className="h-2 w-2 rounded-full bg-siap-foreground" />{selectedSession.status}</span>}>
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-gold/15 bg-background/40 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-gold/15">
                {([
                  ['Tanggal Operasional', tanggalPanjang, CalendarDays, ''],
                  ['Saldo Awal', rupiah(Number(summary['opening_cash'] ?? selectedSession.opening_cash)), Wallet, ''],
                  ['Penerimaan Sesi', rupiah(Number(summary['payments_total'] ?? 0)), ArrowDownLeft, ''],
                  ['Saldo Cash Sesi', hasExpectedCash ? rupiah(expectedCash) : 'Memuat saldo...', Coins, cashDeficit ? 'text-bahaya-foreground' : ''],
                ] as const).map(([judul, nilai, Icon, warna]) => (
                  <div key={judul} className="flex min-w-0 items-center gap-3 lg:px-4 lg:first:pl-0">
                    <span className="ikon-bulat h-10 w-10 shrink-0 text-gold"><Icon size={19} aria-hidden="true" /></span>
                    <div className="min-w-0"><p className="text-xs text-muted-foreground">{judul}</p><p className={`mt-1 text-sm font-semibold tabular-nums ${judul === 'Tanggal Operasional' ? '' : 'text-base'} ${warna}`}>{nilai}</p></div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {selectedSession && (
            <Panel judul="Closing Sesi Kas" sub="Input hasil perhitungan kas di akhir sesi.">
              {canCloseOthers && !activeSession && <select value={selectedSession.id} onChange={(e) => setSelectedSessionId(e.target.value)} className={`${input} mb-4`}>{sessions.rows.filter((session) => session.status === 'OPEN').map((session) => <option key={session.id} value={session.id}>{session.operational_date} · {nama(session.opened_by)}</option>)}</select>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
                <label className={label}><span className="mb-1.5 block">Total Cash (Fisik)</span><RpInput value={String(totalCash)} readOnly /></label>
                <label className={label}><span className="mb-1.5 block">Total QRIS</span><RpInput value={String(totalQris)} readOnly /></label>
                <label className={label}><span className="mb-1.5 block">Total Transfer</span><RpInput value={String(totalTransfer)} readOnly /></label>
                <label className={label}><span className="mb-1.5 block">Selisih / Catatan</span><input value={closingReason} onChange={(e) => setClosingReason(e.target.value)} className={input} placeholder="Contoh: Sesuai, tidak ada selisih" /></label>
              </div>
              {cashDeficit && <p className="mt-3 text-xs text-bahaya-foreground">Saldo minus dicatat dalam closing sesi. Alokasi CASH otomatis nol; SETOR TRANSFER tetap wajib sesuai penerimaan transfer.</p>}
              <details className="mt-3 rounded-md border border-gold/10 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">Alokasi closing (Setor Cash, Setor Transfer, Di laci, Dibawa)</summary>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className={label}><span className="mb-1.5 block">Setor Cash</span><RpInput disabled={cashDeficit} value={setorCash} onChange={setSetorCash} /></label>
                  <label className={label}><span className="mb-1.5 block">Setor Transfer</span><RpInput value={setorTransfer} onChange={setSetorTransfer} /></label>
                  <label className={label}><span className="mb-1.5 block">Di laci</span><RpInput disabled={cashDeficit} value={diLaci} onChange={setDiLaci} /></label>
                  <label className={label}><span className="mb-1.5 block">Dibawa</span><RpInput disabled={cashDeficit} value={dibawa} onChange={setDibawa} /></label>
                </div>
                {angka(diLaci) > 0 && <select value={recipientUserId} onChange={(e) => setRecipientUserId(e.target.value)} className={`${input} mt-3`}><option value="">Pilih penerima DI LACI</option>{employees.rows.filter((employee) => employee.active).map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.name}</option>)}</select>}
              </details>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr] md:items-stretch">
                <div className="rounded-lg border border-gold/15 bg-background/40 p-4"><p className="text-sm text-muted-foreground">Total Penerimaan</p><p className="mt-1 text-2xl font-semibold tabular-nums">{rupiah(Number(summary['payments_total'] ?? 0))}</p></div>
                <div className="md:border-l md:border-gold/15 md:pl-4">
                  <p className="text-xs text-muted-foreground">Pastikan semua transaksi telah dicatat dengan benar sebelum memfinalkan closing.</p>
                  {!isTraining && <Button className="mt-3 w-full gap-2" disabled={busy || !hasExpectedCash} onClick={() => void closeSession()}><Check size={16} aria-hidden="true" />Finalkan Closing</Button>}
                </div>
              </div>
            </Panel>
          )}
          {selectedSession && (
            <Panel judul="Aktivitas Keuangan" sub="Riwayat transaksi keuangan terbaru." kanan={
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} className="h-10 w-64 max-w-full rounded-md border border-input bg-background/60 pl-9 pr-3 text-xs" placeholder="Cari transaksi, keterangan, atau nominal..." /></label>
                <Button variant="outline" className="h-10 gap-2" onClick={() => setFilterBuka((v) => !v)}><SlidersHorizontal size={15} aria-hidden="true" />Filter</Button>
              </div>
            }>
              {filterBuka && <div className="mb-3 flex flex-wrap gap-2">{(['', 'Penerimaan', 'Setoran', 'Pengeluaran', 'Refund'] as const).map((jenis) => <button key={jenis || 'semua'} type="button" onClick={() => setFilterJenis(jenis)} className={`rounded-full border px-3 py-1 text-xs ${filterJenis === jenis ? 'border-gold bg-gold/15 text-gold' : 'border-gold/15 text-muted-foreground'}`}>{jenis || 'Semua'}</button>)}</div>}
              <div className="max-h-96 overflow-auto rounded-md border border-gold/15">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-secondary text-[11px] uppercase tracking-wider text-gold"><tr><th className="px-3 py-3 font-semibold">Tanggal / Waktu</th><th className="px-3 py-3 font-semibold">Jenis</th><th className="px-3 py-3 font-semibold">Keterangan</th><th className="px-3 py-3 font-semibold">Metode</th><th className="px-3 py-3 font-semibold">Nominal</th><th className="px-3 py-3 font-semibold">Petugas</th></tr></thead>
                  <tbody>
                    {aktivitas.map((row) => (
                      <tr key={row.id} className="border-t border-gold/10">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs">{new Date(row.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-3 py-2.5"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${warnaJenis[row.jenis]}`}>{row.jenis}</span></td>
                        <td className="max-w-64 px-3 py-2.5 text-xs"><span className="line-clamp-2 break-words">{row.ket}</span></td>
                        <td className="px-3 py-2.5 text-xs">{row.metode}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold tabular-nums ${row.jenis === 'Penerimaan' ? 'text-siap-foreground' : row.jenis === 'Setoran' ? 'text-foreground' : 'text-bahaya-foreground'}`}>{rupiah(row.nominal)}</td>
                        <td className="px-3 py-2.5 text-xs">{row.petugas}</td>
                      </tr>
                    ))}
                    {aktivitas.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas keuangan pada sesi ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
        <div className="min-w-0 space-y-5">
          {selectedSession && (
            <Panel judul="Setoran" sub="Ajukan setoran uang ke rekening owner.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}><span className="mb-1.5 block">Nominal Setoran</span><RpInput value={depositAmount} onChange={setDepositAmount} /></label>
                <label className={label}><span className="mb-1.5 block">Metode Setoran</span><select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} className={input}><option value="Transfer">Transfer Bank</option><option value="CASH">Cash</option></select></label>
                {depositMethod === 'Transfer' && banks.rows.some((bank) => bank.active) && <label className={`${label} sm:col-span-2`}><span className="mb-1.5 block">Rekening Tujuan</span><select value={depositBankId} onChange={(e) => setDepositBankId(e.target.value)} className={input}><option value="">Rekening Owner</option>{banks.rows.filter((bank) => bank.active).map((bank) => <option key={bank.id} value={bank.id}>{bank.bank_name} · {bank.account_number}</option>)}</select></label>}
                <label className={`${label} sm:col-span-2`}><span className="mb-1.5 block">Referensi Transfer (Opsional)</span><input value={depositProof} onChange={(e) => setDepositProof(e.target.value)} className={input} placeholder="Contoh: TRF123456789" /></label>
              </div>
              <Button className="mt-4 w-full gap-2" disabled={busy} onClick={() => void submitDeposit()}><Send size={16} aria-hidden="true" />Ajukan Setoran</Button>
              {isOwner && deposits.rows.some((deposit) => deposit.status === 'MENUNGGU_KONFIRMASI_OWNER') && (
                <div className="mt-5 border-t border-gold/15 pt-4">
                  <p className="mb-3 text-xs text-muted-foreground">Setoran menunggu konfirmasi Owner</p>
                  <ul className="space-y-2">{deposits.rows.filter((deposit) => deposit.status === 'MENUNGGU_KONFIRMASI_OWNER').map((deposit) => <li key={deposit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2 text-sm"><span>{deposit.method} · {rupiah(Number(deposit.amount))}</span><span className="flex gap-2"><Button size="sm" onClick={() => void decideDeposit(deposit.id, 'DITERIMA')}>Terima</Button><Button size="sm" variant="outline" onClick={() => void decideDeposit(deposit.id, 'DITOLAK')}>Tolak</Button><Button size="sm" variant="ghost" onClick={() => void decideDeposit(deposit.id, 'BELUM_DITERIMA')}>Belum diterima</Button></span></li>)}</ul>
                </div>
              )}
            </Panel>
          )}
          {handoffs.rows.filter((handoff) => handoff.status === 'MENUNGGU_HITUNG').length > 0 && <Panel judul="Serah terima DI LACI"><ul className="space-y-3">{handoffs.rows.filter((handoff) => handoff.status === 'MENUNGGU_HITUNG').map((handoff) => <li key={handoff.id} className="rounded-md bg-secondary p-3 text-sm"><p>Ekspektasi: {rupiah(Number(handoff.expected_amount))}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={handoffActual} onChange={(e) => setHandoffActual(e.target.value)} type="number" min="0" className={input} placeholder="Hitungan aktual" /><input value={handoffReason} onChange={(e) => setHandoffReason(e.target.value)} className={input} placeholder="Alasan selisih bila ada" /><Button disabled={busy} onClick={() => void confirmHandoff(handoff.id)}>Konfirmasi</Button></div></li>)}</ul></Panel>}
          {isOwner && (
            <Panel judul="Refund Owner" sub="Catat pengembalian dana kepada tamu (atas persetujuan owner).">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}><span className="mb-1.5 block">Pilih Transaksi / Booking</span><select value={refundTransactionId} onChange={(e) => setRefundTransactionId(e.target.value)} className={input}><option value="">Pilih transaksi</option>{transactions.rows.filter((transaction) => transaction.status !== 'cancelled').map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.transaction_number}</option>)}</select></label>
                <label className={label}><span className="mb-1.5 block">Nominal Refund</span><RpInput value={refundAmount} onChange={setRefundAmount} /></label>
                <label className={label}><span className="mb-1.5 block">Sumber Dana</span><select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className={input}><option value="CASH">Cash</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option></select></label>
                <label className={label}><span className="mb-1.5 block">Alasan Refund</span><input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className={input} placeholder="Contoh: Pembatalan oleh tamu" /></label>
                <label className={label}><span className="mb-1.5 block">Asal Dana</span><select value={refundSourceType} onChange={(e) => setRefundSourceType(e.target.value)} className={input}><option value="OWNER_FUNDS">Dana Owner</option><option value="SHIFT_CASH">Kas sesi</option><option value="DRAWER">Laci</option></select></label>
                {refundSourceType !== 'OWNER_FUNDS' && <label className={label}><span className="mb-1.5 block">Sesi Sumber</span><select value={refundSourceSessionId} onChange={(e) => setRefundSourceSessionId(e.target.value)} className={input}><option value="">Pilih sesi sumber</option>{sessions.rows.filter((session) => session.status === 'OPEN' || session.status === 'FINAL').map((session) => <option key={session.id} value={session.id}>{session.operational_date} · {nama(session.opened_by)}</option>)}</select></label>}
              </div>
              <Button className="mt-4 w-full gap-2" disabled={!isOwner || busy} onClick={() => void refund()}><RotateCcw size={16} aria-hidden="true" />Catat Refund</Button>
            </Panel>
          )}
          {selectedSession && (
            <Panel judul="Ringkasan Hari Ini" kanan={<span className="text-sm text-muted-foreground">{tanggalPanjang}</span>}>
              <ul className="divide-y divide-gold/10 rounded-lg border border-gold/15 bg-background/40 text-sm">
                {([
                  ['Total Penerimaan', Number(summary['payments_total'] ?? 0), sessionPayments.length, ArrowDownLeft, 'text-siap-foreground', 'text-foreground'],
                  ['Pengeluaran', Number(summary['expenses'] ?? 0), sessionExpenses.length, ArrowUpRight, 'text-bahaya-foreground', 'text-foreground'],
                  ['Refund', Number(summary['refunds'] ?? 0), sessionRefunds.length, RotateCcw, 'text-bahaya-foreground', 'text-foreground'],
                  ['Setoran (Terkonfirmasi)', total(confirmedDeposits), confirmedDeposits.length, BadgeCheck, 'text-gold', 'text-foreground'],
                  ['Setoran (Menunggu)', total(waitingDeposits), waitingDeposits.length, Clock, 'text-gold', 'text-gold'],
                ] as const).map(([judul, nilai, jumlah, Icon, warnaIkon, warnaNilai]) => (
                  <li key={judul} className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 px-3 py-2.5">
                    <Icon size={16} className={warnaIkon} aria-hidden="true" />
                    <span>{judul}</span>
                    <span className={`font-semibold tabular-nums ${warnaNilai}`}>{rupiah(nilai)}</span>
                    <span className="w-20 text-right text-xs text-muted-foreground">{jumlah} transaksi</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </Kerangka>
  );
}

function RpInput({ value, onChange, readOnly, disabled }: { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean }) {
  return (
    <span className="flex h-11 min-w-0 overflow-hidden rounded-md border border-input bg-background/60 text-sm">
      <span className="flex items-center border-r border-input px-3 text-muted-foreground">Rp</span>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={readOnly} disabled={disabled} type="number" min="0" className="min-w-0 flex-1 bg-transparent px-3 text-foreground outline-none" />
    </span>
  );
}
