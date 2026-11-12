import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { buildPaymentConfirmation } from './payment-confirmation';

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

/** Read-only browser/RLS queries. No receipt RPC, public URL, storage or financial writes. */
export async function loadPaymentConfirmation(transactionId: string, client: SupabaseClient<Database>) {
  const access = await frontdesk(client);
  // finance_refunds_read is owner OR created_by=self. An empty staff read is not proof
  // of no refunds. Fail closed until an approved complete-refund read exists; never bypass RLS.
  if (!access.owner) throw new Error('PDF belum tersedia untuk akses ini: histori refund lengkap hanya dapat diverifikasi Owner.');
  if (!transactionId) throw new Error('Pilih transaksi terlebih dahulu.');
  const t = await required(client.from('transactions').select('*').eq('id', transactionId).single(), 'Transaksi');
  const guest = await required(client.from('guests').select('id,full_name,phone').eq('id', t.guest_id).single(), 'Tamu');
  const room = await required(client.from('rooms').select('id,room_number,room_type_id').eq('id', t.room_id).single(), 'Kamar');
  if (!t.package_id) throw new Error('Paket transaksi belum tersedia.');
  const pkg = await required(client.from('packages').select('id,name,time_mode').eq('id', t.package_id).single(), 'Paket');
  const roomType = await required(client.from('room_types').select('id,name').eq('id', room.room_type_id).single(), 'Tipe kamar');
  const payments = await confirmationPages((from, to) => client.from('payments')
    .select('id,transaction_id,amount,created_at,kind,method').eq('transaction_id', transactionId)
    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to));
  const refunds = await confirmationPages((from, to) => client.from('finance_refunds')
    .select('id,transaction_id,amount,created_at,refund_method').eq('transaction_id', transactionId)
    .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to));
  const template = await required(client.from('receipt_template_versions').select('header_config')
    .not('published_at', 'is', null).eq('language', 'en').eq('paper_width_mm', 58)
    .order('published_at', { ascending: false }).order('id', { ascending: true }).limit(1).single(), 'Konfigurasi identitas resmi');
  // Recheck transaction/version and identity after paginated reads; reject a stale or revoked session.
  const latest = await required(client.from('transactions').select('updated_at').eq('id', transactionId).single(), 'Validasi transaksi');
  const finalAccess = await frontdesk(client);
  if (!finalAccess.owner || access.userId !== finalAccess.userId || latest.updated_at !== t.updated_at) {
    throw new Error('Data atau akses berubah; muat ulang Payment Confirmation.');
  }
  return buildPaymentConfirmation({ transaction: t, guest, room, roomType, package: pkg, payments, refunds,
    refundsComplete: true, canReadGuestPhone: true, generatedAt: new Date().toISOString(), business: {
      name: configText(template.header_config, 'title') || configText(template.header_config, 'name'),
      address: configText(template.header_config, 'address'), city: configText(template.header_config, 'city'),
      whatsapp: configText(template.header_config, 'whatsapp'),
    } });
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
