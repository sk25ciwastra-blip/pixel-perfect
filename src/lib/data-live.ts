import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type Room = Database['public']['Tables']['rooms']['Row'];
export type Package = Database['public']['Tables']['packages']['Row'];
export type Guest = Database['public']['Tables']['guests']['Row'];
export type RoomType = Database['public']['Tables']['room_types']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export function useTable<T extends keyof Database['public']['Tables']>(table: T) {
  const [rows, setRows] = useState<Database['public']['Tables'][T]['Row'][]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { data, error: failure } = await supabase.from(table).select('*').order('created_at', { ascending: true });
    setRows((data ?? []) as unknown as Database['public']['Tables'][T]['Row'][]);
    setError(failure?.message ?? ''); setLoading(false);
  }, [table]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { rows, error, loading, refresh };
}
