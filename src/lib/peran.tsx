import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Peran = 'owner' | 'karyawan';
export type PosisiKaryawan =
  | 'receptionist'
  | 'housekeeping'
  | 'supervisor'
  | 'inspector'
  | 'investor';

export type PosisiAkses = 'owner' | PosisiKaryawan | null;

const labelPosisi: Record<Exclude<PosisiAkses, null>, string> = {
  owner: 'Owner',
  receptionist: 'Resepsionis',
  housekeeping: 'Petugas Kebersihan',
  supervisor: 'Supervisor',
  inspector: 'Inspector',
  investor: 'Investor',
};

type Access = {
  peran: Peran;
  nama: string;
  posisi: string;
  posisiKode: PosisiAkses;
  siap: boolean;
  masuk: boolean;
  keluar: () => Promise<void>;
};

const PeranContext = createContext<Access>({
  peran: 'karyawan',
  nama: '',
  posisi: '',
  posisiKode: null,
  siap: false,
  masuk: false,
  keluar: async () => {},
});

export function PeranProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Access, 'keluar'>>({
    peran: 'karyawan',
    nama: '',
    posisi: '',
    posisiKode: null,
    siap: false,
    masuk: false,
  });

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;

      if (!user) {
        setState({
          peran: 'karyawan',
          nama: '',
          posisi: '',
          posisiKode: null,
          siap: true,
          masuk: false,
        });
        return;
      }

      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!alive) return;

      if (role?.role === 'owner') {
        setState({
          peran: 'owner',
          nama: 'Pemilik',
          posisi: 'Owner',
          posisiKode: 'owner',
          siap: true,
          masuk: true,
        });
        return;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('name, position, active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!alive) return;

      const posisiKode = (employee?.position ?? null) as PosisiKaryawan | null;

      setState({
        peran: 'karyawan',
        nama: employee?.name ?? '',
        posisi: posisiKode ? labelPosisi[posisiKode] : '',
        posisiKode,
        siap: true,
        masuk: role?.role === 'employee' && !!employee?.active,
      });
    }

    void refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void refresh();
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const keluar = async () => {
    await supabase.auth.signOut();
    setState({
      peran: 'karyawan',
      nama: '',
      posisi: '',
      posisiKode: null,
      siap: true,
      masuk: false,
    });
  };

  return (
    <PeranContext.Provider value={{ ...state, keluar }}>
      {children}
    </PeranContext.Provider>
  );
}

export function usePeran() {
  return useContext(PeranContext);
}
