import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const createEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{name:string;employeeId:string;email:string;password:string;position:'receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor'})=>data).handler(async ({data,context})=>{
 // DRAFT cutover: the old form cannot bypass automatic ID / credential policy.
 // Keep its typed contract until UI cutover, but perform no Auth/DB creation.
 throw new Error('Pendaftaran manual dinonaktifkan; secure provisioning menunggu persetujuan dan cutover.');
});
export const manageEmployee = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((data:{id:string;name:string;position:'receptionist'|'housekeeping'|'supervisor'|'inspector'|'investor';active:boolean;password?:string})=>data).handler(async ({data,context})=>{
 const {requirePrivateEmployeeOwner}=await import('./employee-services.server');
 await requirePrivateEmployeeOwner(context.supabase);
 if(data.password)throw new Error('Password hanya dapat diubah oleh pemilik akun melalui Pengaturan.');
 const {data:employee,error:readError}=await context.supabase.from('employees').select('user_id, active').eq('id',data.id).single();
 if(readError||!employee)throw new Error('Karyawan tidak ditemukan');
 if(data.active!==employee.active)throw new Error('Perubahan status wajib melalui lifecycle teraudit.');
 if(!data.name.trim() || !['receptionist','housekeeping','supervisor','inspector','investor'].includes(data.position))throw new Error('Periksa data karyawan.');
 const {error}=await context.supabase.from('employees').update({name:data.name.trim(),position:data.position}).eq('id',data.id);
 if(error)throw new Error(error.message);
 return {ok:true};
});
