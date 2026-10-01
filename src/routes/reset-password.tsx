import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { meta } from '@/lib/meta';
export const Route = createFileRoute('/reset-password')({ head: () => meta('Atur Ulang Kata Sandi', 'Perbarui kata sandi akun Baturaden 25 Homestay.'), component: Reset });
function Reset() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!window.location.hash.includes('type=recovery')) { setMessage('Tautan pengaturan ulang tidak berlaku.'); return; } const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage('Tidak dapat mengganti kata sandi. Minta tautan baru.'); else await navigate({ to: '/auth' }); }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4"><h1 className="text-2xl font-bold">Atur ulang kata sandi</h1><label className="block text-sm">Kata sandi baru<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4" /></label>{message && <p role="status">{message}</p>}<Button className="w-full">Simpan kata sandi</Button></form></main>;
}
