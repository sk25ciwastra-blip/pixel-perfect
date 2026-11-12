import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { buildPaymentConfirmation, type ConfirmationRefund } from './payment-confirmation';

async function required<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<NonNullable<T>> {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data == null) throw new Error(`${label}: data tidak tersedia atau akses ditolak.`);
  return result.data as NonNullable<T>;
}
export async function confirmationPages<T>(read: (from: number, to: number) => PromiseLike<{
  data: T[] | null; error: { message: string } | null;
}>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await required(read(offset, offset + 99), 'Histori pembayaran');
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
async function frontdesk(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Sesi login tidak tersedia.');
  const role = await required(client.from('user_roles').select('role').eq('user_id', data.user.id).single(), 'Izin');
  if (role.role === 'owner') return { owner: true, userId: data.user.id };
  const employee = await required(client.from('employees').select('active,position')
    .eq('user_id', data.user.id).single(), 'Izin karyawan');
  if (role.role !== 'employee' || !employee.active || !['supervisor', 'receptionist'].includes(employee.position)) {
    throw new Error('Akses Payment Confirmation ditolak.');
  }
  return { owner: false, userId: data.user.id };
}
function configText(config: Json, key: string) {
  if (!config || Array.isArray(config) || typeof config !== 'object') return '';
  const value = config[key];
  return typeof value === 'string' ? value : '';
}

async function completeRefunds(transactionId: string, actorId: string, client: SupabaseClient<Database>) {
  const payload = await required(client.rpc('read_payment_confirmation_refunds', { _transaction_id: transactionId }), 'Histori refund terotorisasi');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload['schema_version'] !== 1 ||
    payload['transaction_id'] !== transactionId || payload['actor_id'] !== actorId || payload['complete'] !== true ||
    !Number.isSafeInteger(payload['refund_count']) || !Array.isArray(payload['refunds']) ||
    payload['refund_count'] !== payload['refunds'].length || typeof payload['ledger_revision'] !== 'string' ||
    !Number.isSafeInteger(payload['payment_count']) || typeof payload['payment_count'] !== 'number' || payload['payment_count'] < 0 ||
    typeof payload['payment_digest'] !== 'string' || !/^[a-f0-9]{64}$/.test(payload['payment_digest']) ||
    !/^[a-f0-9]{32}$/.test(payload['ledger_revision'])) {
    throw new Error('Histori refund tidak lengkap atau kontrak akses tidak cocok.');
  }
  const refunds: ConfirmationRefund[] = payload['refunds'].map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || row['transaction_id'] !== transactionId ||
      typeof row['id'] !== 'string' || typeof row['amount'] !== 'number' || typeof row['created_at'] !== 'string' ||
      typeof row['refund_method'] !== 'string') throw new Error('Histori refund tidak lengkap atau transaksi tidak cocok.');
    return { id: row['id'], transaction_id: transactionId, amount: row['amount'], created_at: row['created_at'], refund_method: row['refund_method'] };
  });
  return { refunds, revision: payload['ledger_revision'], paymentCount: payload['payment_count'], paymentDigest: payload['payment_digest'] };
}

/** Read-only browser/RLS queries. No receipt RPC, public URL, storage or financial writes. */
export async function loadPaymentConfirmation(transactionId: string, client: SupabaseClient<Database>) {
  const access = await frontdesk(client);
  if (!transactionId) throw new Error('Pilih transaksi terlebih dahulu.');
  // Server verifies role, Training DENY and the exact transaction. Missing RPC fails closed.
  const initialRefunds = await completeRefunds(transactionId, access.userId, client);
  const t = await required(client.from('transactions').select('*').eq('id', transactionId).single(), 'Transaksi');
  const guest = await required(client.from('guests').select('id,full_name,phone').eq('id', t.guest_id).single(), 'Tamu');
  const room = await required(client.from('rooms').select('id,room_number,room_type_id').eq('id', t.room_id).single(), 'Kamar');
  if (!t.package_id) throw new Error('Paket transaksi belum tersedia.');
  const pkg = await required(client.from('packages').select('id,name,time_mode').eq('id', t.package_id).single(), 'Paket');
  const roomType = await required(client.from('room_types').select('id,name').eq('id', room.room_type_id).single(), 'Tipe kamar');
  const payments = await confirmationPages((from, to) => client.from('payments')
    .select('id,transaction_id,amount,created_at,kind,method').eq('transaction_id', transactionId)
    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to));
  const paymentCanonical = JSON.stringify(payments.map(p => [p.id, p.transaction_id,
    String(Math.round(p.amount * 100)), new Date(p.created_at).toISOString(), p.kind, p.method]));
  const paymentDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(paymentCanonical))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (payments.length !== initialRefunds.paymentCount || paymentDigest !== initialRefunds.paymentDigest) {
    throw new Error('Histori pembayaran tidak lengkap atau berubah; muat ulang Payment Confirmation.');
  }
  const refunds = initialRefunds.refunds;
  // ACTIVE is the official template contract; published_at may legitimately be NULL.
  // PDF uses only the shared identity, so every active BOOKING/WALK_IN header must agree.
  const templates = await confirmationPages((from, to) => client.from('receipt_template_versions').select('header_config')
    .eq('status', 'ACTIVE').eq('language', 'en').eq('paper_width_mm', 58)
    .in('template_kind', ['BOOKING', 'WALK_IN']).order('id', { ascending: true }).range(from, to));
  const identities = templates.map(template => ({
    name: configText(template.header_config, 'title').trim() || configText(template.header_config, 'name').trim(),
    address: configText(template.header_config, 'address').trim(), city: configText(template.header_config, 'city').trim(),
    whatsapp: configText(template.header_config, 'whatsapp').trim(),
  }));
  const business = identities[0];
  if (!business?.name || identities.some(identity => !identity.name || JSON.stringify(identity) !== JSON.stringify(business))) {
    throw new Error('Konfigurasi identitas resmi aktif tidak tersedia, tidak valid, atau tidak konsisten.');
  }
  // Recheck transaction/version and identity after paginated reads; reject a stale or revoked session.
  const latest = await required(client.from('transactions').select('updated_at').eq('id', transactionId).single(), 'Validasi transaksi');
  const finalAccess = await frontdesk(client);
  const finalRefunds = await completeRefunds(transactionId, finalAccess.userId, client);
  if (access.userId !== finalAccess.userId || latest.updated_at !== t.updated_at ||
    initialRefunds.revision !== finalRefunds.revision || initialRefunds.paymentDigest !== finalRefunds.paymentDigest ||
    initialRefunds.paymentCount !== finalRefunds.paymentCount || JSON.stringify(refunds) !== JSON.stringify(finalRefunds.refunds)) {
    throw new Error('Data atau akses berubah; muat ulang Payment Confirmation.');
  }
  return { ...buildPaymentConfirmation({ transaction: t, guest, room, roomType, package: pkg, payments, refunds,
    refundsComplete: true, canReadGuestPhone: true, generatedAt: new Date().toISOString(), business }),
    // Bracketed independent reads, NOT an atomic financial snapshot. Also binds the login.
    ledgerRevision: access.userId + ':' + initialRefunds.revision };
}

/** Successful RPC identity is retained independently of optional PDF availability. Never retries check-in. */
export async function loadCheckInSuccess(transactionId: string, transactionNumber: string, client: SupabaseClient<Database>) {
  await frontdesk(client);
  const t = await required(client.from('transactions').select('id,transaction_number,status,started_at,ends_at,scheduled_check_out')
    .eq('id', transactionId).single(), 'Check-in berhasil; data terbaru belum tersedia');
  if (t.id !== transactionId || t.transaction_number !== transactionNumber || t.status !== 'check_in' || !t.started_at || !t.ends_at) {
    throw new Error('Check-in berhasil; hasil refresh transaksi belum cocok. Jangan ulang Check-in.');
  }
  return t;
}
