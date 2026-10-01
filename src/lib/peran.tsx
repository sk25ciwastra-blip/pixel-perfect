import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Peran = 'owner' | 'karyawan';
type Access = { peran: Peran; nama: string; posisi: string; siap: boolean; masuk: boolean; keluar: () => Promise<void> };
const PeranContext = createContext<Access>({ peran: 'karyawan', nama: '', posisi: '', siap: false, masuk: false, keluar: async () => {} });
export function PeranProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Access, 'keluar'>>({ peran: 'karyawan', nama: '', posisi: '', siap: false, masuk: false });
  useEffect(() => {
    let alive = true;
    async function refresh() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { setState({ peran: 'karyawan', nama: '', posisi: '', siap: true, masuk: false }); return; }
      const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (!alive) return;
      if (role?.role === 'owner') { setState({ peran: 'owner', nama: 'Pemilik', posisi: 'Owner', siap: true, masuk: true }); return; }
      const { data: employee } = await supabase.from('employees').select('name, position, active').eq('user_id', user.id).maybeSingle();
      if (!alive) return;
      if (role?.role === 'employee' && employee && !employee.active) {
        await supabase.auth.signOut();
        setState({ peran: 'karyawan', nama: '', posisi: '', siap: true, masuk: false });
        return;
      }
      setState({ peran: 'karyawan', nama: employee?.name ?? '', posisi: employee?.position === 'receptionist' ? 'Resepsionis' : 'Petugas Kebersihan', siap: true, masuk: role?.role === 'employee' && !!employee?.active });
    }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void refresh();
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const keluar = async () => { await supabase.auth.signOut(); setState({ peran: 'karyawan', nama: '', posisi: '', siap: true, masuk: false }); };
  return <PeranContext.Provider value={{ ...state, keluar }}>{children}</PeranContext.Provider>;
}
export function usePeran() { return useContext(PeranContext); }
