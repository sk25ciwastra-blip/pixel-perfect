import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type Room = Database['public']['Tables']['rooms']['Row'];
export type Package = Database['public']['Tables']['packages']['Row'];
export type Guest = Database['public']['Tables']['guests']['Row'];
export type RoomType = Database['public']['Tables']['room_types']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type HousekeepingHistory = Database['public']['Tables']['housekeeping_history']['Row'];
export type HousekeepingChecklist = Database['public']['Tables']['housekeeping_checklists']['Row'];
export type HousekeepingMaintenance = Database['public']['Tables']['housekeeping_maintenance']['Row'];
type Tabel = Database['public']['Tables'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BarisLonggar = any;
type Baris<T extends string> = T extends keyof Tabel ? Tabel[T]['Row'] : BarisLonggar;

/** Pemanggil fungsi database untuk fungsi yang belum tercantum di definisi tipe. */
export const rpc = ((fn: string, args?: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase.rpc as any)(fn, args)) as (
  fn: string,
  args?: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<{ data: any; error: { message: string } | null }>;

export function useTable<T extends string>(
  table: T,
  enabled = true,
) {
  const [rows, setRows] = useState<
    Baris<T>[]
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setError('');
      setLoading(false);
      return;
    }

    const { data, error: failure } = await supabase
      .from(table as keyof Tabel)
      .select('*')
      .order('created_at', { ascending: true });

    setRows(
      (data ?? []) as unknown as Baris<T>[],
    );
    setError(failure?.message ?? '');
    setLoading(false);
  }, [table, enabled]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setError('');
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);
const channelId = useId();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`table-${String(table)}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: String(table),
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, refresh, channelId, enabled]);

  return { rows, error, loading, refresh };
}
