import { rpc } from "@/lib/data-live";
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kerangka, Panel, Angka } from '@/components/kerangka';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import { rupiah } from '@/lib/data-contoh';
import { meta } from '@/lib/meta';
import { setSesiKasKonteks } from '@/lib/sesi-kas';

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
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMethod, setExpenseMethod] = useState('CASH');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('CASH');
  const [depositBankId, setDepositBankId] = useState('');
  const [depositProof, setDepositProof] = useState('');
  const [minimumDpMode, setMinimumDpMode] = useState('AMOUNT');
  const [minimumDpValue, setMinimumDpValue] = useState('0');
  const [commissionMode, setCommissionMode] = useState('PERCENTAGE');
  const [commissionRate, setCommissionRate] = useState('8');
  const [perRoomAmount, setPerRoomAmount] = useState('0');
  const [refundTransactionId, setRefundTransactionId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [refundSourceType, setRefundSourceType] = useState('OWNER_FUNDS');
  const [refundSourceSessionId, setRefundSourceSessionId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [handoffActual, setHandoffActual] = useState('');
  const [handoffReason, setHandoffReason] = useState('');

  const sessions = useTable('finance_cash_sessions');
  const deposits = useTable('finance_deposits');
  const commissionConfigs = useTable('finance_commission_configs', isOwner);
  const financeSettings = useTable('finance_settings', isOwner);
  const banks = useTable('finance_bank_accounts');
  const employees = useTable('employees');
  const handoffs = useTable('finance_drawer_handoffs');
  const expenses = useTable('finance_expenses');
  const transactions = useTable('transactions');

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''));
  }, []);

  useEffect(() => {
    const setting = financeSettings.rows[0];
    const config = [...commissionConfigs.rows].sort(
      (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
    )[0];
    if (setting) {
      setMinimumDpMode(setting.minimum_dp_mode);
      setMinimumDpValue(String(setting.minimum_dp_value));
    }
    if (config) {
      setCommissionMode(config.mode);
      setCommissionRate(String(config.rate));
      setPerRoomAmount(String(config.per_room_amount));
    }
  }, [commissionConfigs.rows, financeSettings.rows]);

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
    await Promise.all([sessions.refresh(), deposits.refresh(), commissionConfigs.refresh(), banks.refresh(), employees.refresh(), handoffs.refresh(), expenses.refresh()]);
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

  const visibleExpenses = useMemo(() => {
    const term = expenseSearch.trim().toLowerCase();

    return expenses.rows
      .filter((expense) => expense.session_id === selectedSession?.id)
      .filter((expense) => {
        if (!term) return true;

        return [
          expense.expense_number,
          expense.category,
          expense.note,
          expense.idempotency_key,
          expense.created_at,
        ].some((value) => value?.toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [expenseSearch, expenses.rows, selectedSession?.id]);

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

  async function recordExpense() {
    if (!selectedSession || !expenseAmount || !expenseCategory) return;
    await run(async () => {
      const { error } = await rpc(isTraining ? 'record_training_finance_expense' : 'record_finance_expense', {
        _idempotency_key: crypto.randomUUID(),
        _session_id: selectedSession.id,
        _amount: angka(expenseAmount),
        _method: expenseMethod,
        _category: expenseCategory,
        _note: expenseNote,
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

  async function saveSettings() {
    await run(async () => {
      const first = await rpc('set_finance_settings', { _minimum_dp_mode: minimumDpMode, _minimum_dp_value: angka(minimumDpValue) });
      if (first.error) return { error: first.error };
      const second = await rpc('set_finance_commission_config', { _mode: commissionMode, _rate: angka(commissionRate), _per_room_amount: angka(perRoomAmount) });
      return { error: second.error };
    });
  }

  async function saveBank() {
    await run(async () => {
      const { error } = await rpc('upsert_finance_bank_account', { _id: null, _bank_name: bankName, _account_name: accountName, _account_number: accountNumber, _logo_key: '', _active: true });
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

  return (
    <Kerangka judul="Keuangan" keterangan="Penerimaan, sesi kas, closing, dan pengawasan Owner">
      {message && <p role="alert" className="mb-4 rounded-xl bg-secondary px-3 py-2 text-sm">{message}</p>}
      {isTraining && (
        <p className="mb-4 rounded-xl bg-perlu px-3 py-2 text-sm text-perlu-foreground">
          Training aktif sampai {training.ends_on ?? 'tanggal selesai'}; sesi kas milik Supervisor/Owner ditentukan otomatis. Peserta tidak dapat membuka atau menutup sesi.
        </p>
      )}
      {!activeSession && !isTraining && (
        <Panel judul="Sesi kas">
          <p className="text-sm text-muted-foreground">Buka sesi kas sebelum menerima pembayaran.</p>
          <div className="mt-3 flex gap-2"><input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} type="number" min="0" className="h-10 w-full rounded-xl border border-input px-3" placeholder="Saldo awal" /><Button disabled={busy} onClick={() => void openSession()}>Buka Sesi</Button></div>
        </Panel>
      )}
      {selectedSession && (
        <section className="panel-mewah mb-6 overflow-hidden p-0">
          <div className="grid lg:grid-cols-[1.1fr_2fr]">
            <div className="relative border-b border-gold/15 bg-gradient-to-br from-gold/[0.12] to-transparent p-6 lg:border-b-0 lg:border-r">
              <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-gold">SESI KAS {selectedSession.status}</p>
              <p className="mt-1 text-sm text-muted-foreground">Tanggal operasional {selectedSession.operational_date}</p>
              <p className="mt-5 text-xs text-muted-foreground">Penerimaan sesi</p>
              <p className="font-serif text-4xl text-siap-foreground">{rupiah(Number(summary['payments_total'] ?? 0))}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Saldo awal</p><p className="font-semibold">{rupiah(Number(summary['opening_cash'] ?? selectedSession.opening_cash))}</p></div>
                <div><p className="text-xs text-muted-foreground">Pengeluaran</p><p className="font-semibold text-bahaya-foreground">{rupiah(Number(summary['expenses'] ?? 0))}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-gold/10 sm:grid-cols-3">
              {([
                ['Cash', summary['cash']], ['QRIS', summary['qris']], ['Transfer', summary['transfer']],
                ['Komisi', summary['commission']], ['Refund', summary['refunds']], ['Pengeluaran', summary['expenses']],
              ] as const).map(([label, nilai]) => (
                <div key={label} className="bg-card p-5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold">{label}</p>
                  <p className={`mt-2 font-serif text-xl ${label === 'Pengeluaran' || label === 'Refund' ? 'text-bahaya-foreground' : 'text-foreground'}`}>{rupiah(Number(nilai ?? 0))}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
      {selectedSession && (
        <Panel judul="Closing sesi kas">
          {canCloseOthers && !activeSession && <select value={selectedSession.id} onChange={(e) => setSelectedSessionId(e.target.value)} className="mb-4 h-10 w-full rounded-xl border border-input px-3">{sessions.rows.filter((session) => session.status === 'OPEN').map((session) => <option key={session.id} value={session.id}>{session.operational_date} · {session.opened_by}</option>)}</select>}
          <p className="mb-3 text-xs text-muted-foreground">Alokasi closing sesi</p>
          <p className={`mb-3 text-sm font-semibold ${cashDeficit ? 'text-bahaya-foreground' : 'text-foreground'}`}>
            Saldo CASH sesi: {hasExpectedCash ? rupiah(expectedCash) : 'Memuat saldo...'}
          </p>
          {cashDeficit && <p className="mb-3 text-xs text-bahaya-foreground">Saldo minus dicatat dalam closing sesi. Alokasi CASH otomatis nol; SETOR TRANSFER tetap wajib sesuai penerimaan transfer.</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-4"><input disabled={cashDeficit} value={setorCash} onChange={(e) => setSetorCash(e.target.value)} type="number" min="0" className="h-10 rounded-xl border border-input px-3" placeholder="SETOR CASH" /><input value={setorTransfer} onChange={(e) => setSetorTransfer(e.target.value)} type="number" min="0" className="h-10 rounded-xl border border-input px-3" placeholder="SETOR TRANSFER" /><input disabled={cashDeficit} value={diLaci} onChange={(e) => setDiLaci(e.target.value)} type="number" min="0" className="h-10 rounded-xl border border-input px-3" placeholder="DI LACI" /><input disabled={cashDeficit} value={dibawa} onChange={(e) => setDibawa(e.target.value)} type="number" min="0" className="h-10 rounded-xl border border-input px-3" placeholder="DIBAWA" /></div>
          {angka(diLaci) > 0 && <select value={recipientUserId} onChange={(e) => setRecipientUserId(e.target.value)} className="mt-3 h-10 w-full rounded-xl border border-input px-3"><option value="">Pilih penerima DI LACI</option>{employees.rows.filter((employee) => employee.active).map((employee) => <option key={employee.user_id} value={employee.user_id}>{employee.name}</option>)}</select>}
          <input value={closingReason} onChange={(e) => setClosingReason(e.target.value)} className="mt-3 h-10 w-full rounded-xl border border-input px-3" placeholder="Alasan closing khusus bila diperlukan" />
          {!isTraining && <Button className="mt-3" disabled={busy || !hasExpectedCash} onClick={() => void closeSession()}>Finalkan Closing</Button>}
        </Panel>
      )}
      {selectedSession && (
        <Panel judul="Pengeluaran sesi">
          <div className="grid gap-2 sm:grid-cols-2"><input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} type="number" min="1" className="h-10 rounded-xl border border-input px-3" placeholder="Nominal" /><select value={expenseMethod} onChange={(e) => setExpenseMethod(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="CASH">Cash</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option></select><input value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Kategori" /><input value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Catatan" /></div>
          <Button className="mt-3" disabled={busy} onClick={() => void recordExpense()}>Catat Pengeluaran</Button>
          <div className="mt-5 border-t border-border pt-4">
            <input value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} className="h-10 w-full rounded-xl border border-input px-3" placeholder="Cari nomor pengeluaran, kategori, atau catatan" />
            <ul className="mt-3 space-y-2 text-sm">
              {visibleExpenses.map((expense) => (
                <li key={expense.id} className="rounded-xl bg-secondary px-3 py-2">
                  <p className="font-mono font-semibold">{expense.expense_number ?? 'Pengeluaran lama tanpa nomor baru'}</p>
                  <p>{expense.category} · {rupiah(Number(expense.amount))} · {expense.method} · {new Date(expense.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
                  {expense.note && <p className="text-muted-foreground">{expense.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}
        </div>
        <div className="space-y-6">
      {selectedSession && (
        <Panel judul="Setoran">
          <div className="grid gap-2 sm:grid-cols-2"><input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} type="number" min="1" className="h-10 rounded-xl border border-input px-3" placeholder="Nominal" /><select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="CASH">Cash</option><option value="Transfer">Transfer</option></select>{depositMethod === 'Transfer' && <select value={depositBankId} onChange={(e) => setDepositBankId(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="">Rekening Owner</option>{banks.rows.filter((bank) => bank.active).map((bank) => <option key={bank.id} value={bank.id}>{bank.bank_name} · {bank.account_number}</option>)}</select>}<input value={depositProof} onChange={(e) => setDepositProof(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Referensi bukti transfer" /></div>
          <Button className="mt-3" disabled={busy} onClick={() => void submitDeposit()}>Ajukan Setoran</Button>
        </Panel>
      )}
      {isOwner && <Panel judul="Setoran menunggu konfirmasi Owner"><ul className="space-y-2">{deposits.rows.filter((deposit) => deposit.status === 'MENUNGGU_KONFIRMASI_OWNER').map((deposit) => <li key={deposit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm"><span>{deposit.method} · {rupiah(Number(deposit.amount))}</span><span className="flex gap-2"><Button size="sm" onClick={() => void decideDeposit(deposit.id, 'DITERIMA')}>Terima</Button><Button size="sm" variant="outline" onClick={() => void decideDeposit(deposit.id, 'DITOLAK')}>Tolak</Button><Button size="sm" variant="ghost" onClick={() => void decideDeposit(deposit.id, 'BELUM_DITERIMA')}>Belum diterima</Button></span></li>)}</ul></Panel>}
      {handoffs.rows.filter((handoff) => handoff.status === 'MENUNGGU_HITUNG').length > 0 && <Panel judul="Serah terima DI LACI"><ul className="space-y-3">{handoffs.rows.filter((handoff) => handoff.status === 'MENUNGGU_HITUNG').map((handoff) => <li key={handoff.id} className="rounded-xl bg-secondary p-3 text-sm"><p>Ekspektasi: {rupiah(Number(handoff.expected_amount))}</p><div className="mt-2 flex gap-2"><input value={handoffActual} onChange={(e) => setHandoffActual(e.target.value)} type="number" min="0" className="h-10 flex-1 rounded-xl border border-input px-3" placeholder="Hitungan aktual" /><input value={handoffReason} onChange={(e) => setHandoffReason(e.target.value)} className="h-10 flex-1 rounded-xl border border-input px-3" placeholder="Alasan selisih bila ada" /><Button disabled={busy} onClick={() => void confirmHandoff(handoff.id)}>Konfirmasi</Button></div></li>)}</ul></Panel>}

        {isOwner && (
<Panel judul="Refund Owner"><div className="grid gap-2"><select value={refundTransactionId} onChange={(e) => setRefundTransactionId(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="">Pilih transaksi</option>{transactions.rows.filter((transaction) => transaction.status !== 'cancelled').map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.transaction_number}</option>)}</select><input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} type="number" min="1" className="h-10 rounded-xl border border-input px-3" placeholder="Nominal refund" /><select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="CASH">Cash</option><option value="QRIS">QRIS</option><option value="Transfer">Transfer</option></select><select value={refundSourceType} onChange={(e) => setRefundSourceType(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="OWNER_FUNDS">Dana Owner</option><option value="SHIFT_CASH">Kas sesi</option><option value="DRAWER">Laci</option></select>{refundSourceType !== 'OWNER_FUNDS' && <select value={refundSourceSessionId} onChange={(e) => setRefundSourceSessionId(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="">Pilih sesi sumber</option>{sessions.rows.filter((session) => session.status === 'OPEN' || session.status === 'FINAL').map((session) => <option key={session.id} value={session.id}>{session.operational_date} · {session.opened_by}</option>)}</select>}<input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Alasan wajib" /></div><Button className="mt-3" disabled={!isOwner || busy} onClick={() => void refund()}>Catat Refund</Button></Panel>
        )}

        </div>
      </div>
      {isOwner && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <p className="col-span-full text-xs font-semibold uppercase tracking-[0.22em] text-gold">Pengaturan Owner</p>
          <Panel judul="Pengaturan minimum DP dan komisi">
            <div className="grid gap-2 sm:grid-cols-2"><select value={minimumDpMode} onChange={(e) => setMinimumDpMode(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="AMOUNT">Minimum nominal</option><option value="PERCENTAGE">Minimum persentase</option></select><input value={minimumDpValue} onChange={(e) => setMinimumDpValue(e.target.value)} type="number" min="0" step="0.01" className="h-10 rounded-xl border border-input px-3" placeholder="Nilai minimum DP" /><select value={commissionMode} onChange={(e) => setCommissionMode(e.target.value)} className="h-10 rounded-xl border border-input px-3"><option value="OFF">Komisi OFF</option><option value="PERCENTAGE">Percentage</option><option value="PER_ROOM">Per room</option></select><input value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} type="number" min="0" step="0.01" className="h-10 rounded-xl border border-input px-3" placeholder="Rate %, mis. 15.5" /><input value={perRoomAmount} onChange={(e) => setPerRoomAmount(e.target.value)} type="number" min="0" className="h-10 rounded-xl border border-input px-3" placeholder="Nominal per-room" /></div>
            <Button className="mt-3" disabled={busy} onClick={() => void saveSettings()}>Simpan Konfigurasi</Button>
          </Panel>
          <Panel judul="Rekening Owner untuk Transfer">
            <div className="grid gap-2 sm:grid-cols-3"><input value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Bank" /><input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Nama pemilik" /><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-10 rounded-xl border border-input px-3" placeholder="Nomor rekening" /></div>
            <Button className="mt-3" disabled={busy} onClick={() => void saveBank()}>Tambah Rekening</Button>
            <ul className="mt-3 space-y-2 text-sm">{banks.rows.filter((bank) => bank.active).map((bank) => <li key={bank.id} className="rounded-xl bg-secondary px-3 py-2">{bank.bank_name} · {bank.account_name} · {bank.account_number}</li>)}</ul>
          </Panel>
        </div>
      )}
    </Kerangka>
  );
}
