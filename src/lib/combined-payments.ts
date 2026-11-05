import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CombinedPaymentMethod = 'Cash' | 'QRIS' | 'Transfer';

export type CombinedPaymentComponent = {
  method: CombinedPaymentMethod;
  amount: number;
  idempotency_key: string;
};

export type CombinedPaymentResult = {
  transaction_id: string;
  transaction_number: string;
  payment_ids: string[];
};

type CombinedReservationArgs = {
  _mode: string;
  _room_id: string;
  _package_id: string;
  _name: string;
  _phone: string;
  _address: string;
  _payments: CombinedPaymentComponent[];
  _day_mode: string;
  _scheduled_check_in?: string | null;
  _request_idempotency_key?: string | null;
  _request_fingerprint?: string | null;
  _session_id?: string | null;
  _guest_count?: number;
};

type CombinedSettlementArgs = {
  _transaction_id: string;
  _payments: CombinedPaymentComponent[];
  _request_idempotency_key: string;
  _request_fingerprint: string;
  _session_id: string;
};

type CombinedFunctions = {
  create_reservation_combined: {
    Args: CombinedReservationArgs;
    Returns: CombinedPaymentResult;
  };
  record_transaction_payment_combined: {
    Args: CombinedSettlementArgs;
    Returns: CombinedPaymentResult;
  };
  create_training_reservation_combined: {
    Args: CombinedReservationArgs;
    Returns: CombinedPaymentResult;
  };
  record_training_transaction_payment_combined: {
    Args: CombinedSettlementArgs;
    Returns: CombinedPaymentResult;
  };
};

type LocalCombinedDatabase = Database & {
  public: Database['public'] & {
    Functions: Database['public']['Functions'] & CombinedFunctions;
  };
};

// Local contract until the Cloud schema/types can be regenerated after the
// Owner-approved migration. This cast is deliberately typed, not `any`.
const combinedSupabase = supabase as unknown as SupabaseClient<LocalCombinedDatabase>;

export function shouldUseCombinedPayment(methodCount: number, enabled: boolean) {
  return enabled && methodCount > 1;
}

export function minimumDpAmount(
  total: number,
  setting: { minimum_dp_mode: string; minimum_dp_value: number } | null | undefined,
) {
  if (!setting || !Number.isFinite(total) || total <= 0) return null;
  const value = Number(setting.minimum_dp_value);
  if (!Number.isFinite(value) || value < 0) return null;
  return setting.minimum_dp_mode === 'PERCENTAGE'
    ? Math.ceil((total * value) / 100)
    : value;
}

export function createReservationCombined(args: CombinedReservationArgs) {
  return combinedSupabase.rpc('create_reservation_combined', args as never);
}

export function createTrainingReservationCombined(args: CombinedReservationArgs) {
  return combinedSupabase.rpc('create_training_reservation_combined', args as never);
}

export function recordTransactionPaymentCombined(args: CombinedSettlementArgs) {
  return combinedSupabase.rpc('record_transaction_payment_combined', args);
}

export function recordTrainingTransactionPaymentCombined(args: CombinedSettlementArgs) {
  return combinedSupabase.rpc('record_training_transaction_payment_combined', args);
}
