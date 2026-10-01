import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const createEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{name:string;employeeId:string;email:string;password:string;position:'receptionist'|'housekeeping'})=>data).handler(async ({data,context})=>{
 const {data:owner,error:roleError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'owner'});
 if(roleError||!owner)throw new Error('Akses ditolak');
 if(!data.name.trim()||!data.employeeId.trim()||!/^\S+@\S+\.\S+$/.test(data.email)||data.password.length<8)throw new Error('Periksa data karyawan.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:created,error}=await supabaseAdmin.auth.admin.createUser({email:data.email,password:data.password,email_confirm:true});
 if(error||!created.user)throw new Error(error?.message??'Gagal membuat akun');
 const id=created.user.id;
 const {error:roleInsert}=await supabaseAdmin.from('user_roles').insert({user_id:id,role:'employee'});
 const {error:employeeInsert}=roleInsert?{error:roleInsert}:await supabaseAdmin.from('employees').insert({user_id:id,name:data.name.trim(),employee_id:data.employeeId.trim(),position:data.position});
 if(employeeInsert){await supabaseAdmin.auth.admin.deleteUser(id);throw new Error(employeeInsert.message)}
 return {ok:true};
});
export const manageEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{id:string;name:string;position:'receptionist'|'housekeeping';active:boolean;password?:string})=>data).handler(async ({data,context})=>{
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
