import { supabase } from './supabase-client.js';

export const overlap = (start, end, otherStart, otherEnd) => +new Date(start) < +new Date(otherEnd) && +new Date(end) > +new Date(otherStart);
export async function validateAppointment(clinicId, start, end, exceptId = null) {
  if (!Number.isFinite(+new Date(start)) || !Number.isFinite(+new Date(end)) || +new Date(end) <= +new Date(start)) throw new Error('O término precisa ser depois do início.');
  let query = supabase.from('appointments').select('id,starts_at,ends_at,status').eq('clinic_id', clinicId).neq('status','cancelled').lt('starts_at',new Date(end).toISOString()).gt('ends_at',new Date(start).toISOString());
  if (exceptId) query = query.neq('id',exceptId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  if (data?.length) throw new Error('Este horário já está reservado. Escolha outro período para evitar duas consultas ao mesmo tempo.');
}
export function friendlyAgendaError(error) {
  return error?.code === '23P01' ? 'Este horário acabou de ser reservado por outra pessoa. Atualize a agenda e escolha outro horário.' : error?.message || 'Não foi possível salvar. Tente novamente.';
}
