import {supabase} from './supabase-client.js';
export async function loadPatientDirectory(clinicId){
 const records=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await supabase.from('patients').select('*').eq('clinic_id',clinicId).order('full_name').order('id').range(offset,offset+499);
  if(error)return {data:null,error};
  records.push(...(data||[]));
  if((data||[]).length<500)return {data:records,error:null};
 }
 return {data:null,error:new Error('O cadastro excede 10 mil pacientes. É necessário habilitar a busca paginada no servidor para carregar o diretório completo.')};
}
