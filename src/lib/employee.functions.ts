import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const createEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{name:string;email:string;password:string;active?:boolean;position:'receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor'})=>data).handler(async ({data,context})=>{
 const {data:owner,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'owner'});
 if(roleError||!owner)throw new Error('Akses ditolak');
 if(!data.name.trim()||!/^\S+@\S+\.\S+$/.test(data.email)||data.password.length<8)throw new Error('Periksa data karyawan.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:created,error}=await supabaseAdmin.auth.admin.createUser({email:data.email,password:data.password,email_confirm:true});
 if(error||!created.user)throw new Error(error?.message??'Gagal membuat akun');
 const id=created.user.id;
 // Server-only allocator: PostgreSQL sequence never reuses an issued number,
 // even when a DEMO employee is deleted or concurrent registrations occur.
 // Its installation is a separate guarded LIVE migration, not a client fallback.
 const sequenceClient = supabaseAdmin as unknown as {
   rpc: (name: 'allocate_b25_employee_id') => Promise<{
     data: string | null; error: { message: string } | null;
   }>;
 };
 const {data:employeeId,error:idError}=await sequenceClient.rpc('allocate_b25_employee_id');
 if(idError || !employeeId || !/^B25EMP-\\d{3,}$/.test(employeeId)){
   await supabaseAdmin.auth.admin.deleteUser(id);
   throw new Error('Penomoran ID karyawan belum siap. Akun tidak disimpan.');
 }
 const {error:roleInsert}=await supabaseAdmin.from('user_roles').insert({user_id:id,role:'employee'});
 const {data:inserted,error:employeeInsert}=roleInsert?{data:null,error:roleInsert}:await supabaseAdmin.from('employees').insert({user_id:id,name:data.name.trim(),employee_id:employeeId,position:data.position,active:data.active??true}).select('id').single();
 if(employeeInsert||!inserted){await supabaseAdmin.auth.admin.deleteUser(id);throw new Error(employeeInsert?.message??'Gagal menyimpan karyawan')}
 return {ok:true,id:inserted.id,employeeId};
});
export const manageEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{id:string;name:string;position:'receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor';active:boolean;password?:string})=>data).handler(async ({data,context})=>{
 const {data:owner}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'owner'});
 if(!owner)throw new Error('Akses ditolak');
 const {data:employee,error:readError}=await context.supabase.from('employees').select('user_id').eq('id',data.id).single();
 if(readError||!employee)throw new Error('Karyawan tidak ditemukan');
 if(!data.name.trim() || (data.password && data.password.length<8))throw new Error('Periksa data karyawan.');
 const {error}=await context.supabase.from('employees').update({name:data.name.trim(),position:data.position,active:data.active}).eq('id',data.id);
 if(error)throw new Error(error.message);
 if(data.password){const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {error:resetError}=await supabaseAdmin.auth.admin.updateUserById(employee.user_id,{password:data.password});if(resetError)throw new Error(resetError.message)}
 return {ok:true};
});
