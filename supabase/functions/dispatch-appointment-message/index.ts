import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const respond = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
const digits = (value: string) => value.replace(/\D/g,'');
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const dateFormat = new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'});
const hourFormat = new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'});
const label: Record<string,string> = {received:'recebemos sua solicitação de agendamento; ela aguarda confirmação da clínica',confirmed:'sua consulta foi agendada',rescheduled:'sua consulta foi remarcada'};

Deno.serve(async request => {
  if(request.method==='OPTIONS') return new Response('ok',{headers});
  if(request.method!=='POST') return respond({error:'Método não permitido'},405);
  const jwt=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  const url=Deno.env.get('SUPABASE_URL')||'';
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!serviceKey)return respond({error:'Servidor não configurado'},503);
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(jwt);
  if(authError||!user)return respond({error:'Sessão inválida'},401);
  const {data:profile}=await db.from('profiles').select('clinic_id').eq('id',user.id).maybeSingle();
  if(!profile?.clinic_id)return respond({error:'Perfil não autorizado'},403);
  let appointmentId='',inspect=false;
  try{const body=await request.json();appointmentId=String(body?.appointmentId||'');inspect=body?.inspect===true;}catch{return respond({error:'Requisição inválida'},400);}
  if(!/^[0-9a-f-]{36}$/i.test(appointmentId))return respond({error:'Consulta inválida'},400);
  const {data:appointment}=await db.from('appointments').select('id,clinic_id,patient_id,starts_at,status,approval_status,source_payload').eq('clinic_id',profile.clinic_id).eq('id',appointmentId).maybeSingle();
  if(!appointment)return respond({error:'Consulta não encontrada'},404);
  if(inspect){
    const {data}=await db.from('appointment_messages').select('channel,event_type,status,sent_at,error_message,created_at').eq('clinic_id',profile.clinic_id).eq('appointment_id',appointment.id).order('created_at',{ascending:false}).limit(8);
    return respond({messages:data||[]});
  }
  const {data:settings}=await db.from('patient_message_settings').select('sender_phone,sender_email,enabled').eq('clinic_id',profile.clinic_id).maybeSingle();
  if(!settings?.enabled)return respond({ok:true,delivery:'awaiting_configuration'});
  const {data:patient}=await db.from('patients').select('full_name,social_name,phone,email').eq('clinic_id',profile.clinic_id).eq('id',appointment.patient_id).maybeSingle();
  if(!patient)return respond({error:'Paciente não encontrado'},404);
  const {data:jobs,error:claimError}=await db.rpc('claim_patient_messages',{p_clinic_id:profile.clinic_id,p_appointment_id:appointment.id,p_limit:10});
  if(claimError)return respond({error:'Não foi possível iniciar os envios'},500);
  const results: Record<string,string> = {};
  for(const job of jobs||[]){
    const name=(patient.social_name||patient.full_name||'Paciente').trim().split(/\s+/)[0];
    const day=dateFormat.format(new Date(appointment.starts_at));
    const time=hourFormat.format(new Date(appointment.starts_at));
    const description=label[job.event_type]||label.confirmed;
    const phone=digits(patient.phone||'');
    const toPhone=phone.startsWith('55')?phone:`55${phone}`;
    const recipient=job.channel==='email'?String(patient.email||'').trim():toPhone;
    let status='sent',providerId: string|null=null,errorMessage: string|null=null;
    try{
      if(appointment.status==='cancelled'||appointment.source_payload?.patient_message_opt_in!==true ||
        (job.event_type==='received' && appointment.approval_status!=='pending') ||
        (job.event_type==='confirmed' && appointment.approval_status!=='approved'))
        throw new Error('Consulta cancelada ou envio não autorizado');
      if(job.channel==='email'){
        const key=Deno.env.get('RESEND_API_KEY');
        if(!key)throw new Error('Provedor de e-mail não configurado');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new Error('Paciente sem e-mail válido');
        const body=`Olá, ${name}! A Alegrare informa que ${description}. Data: ${day}, às ${time} (horário de Brasília). Se precisar falar com a clínica, responda a este e-mail.`;
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`alegrare/${job.id}`},body:JSON.stringify({from:`Alegrare <${settings.sender_email}>`,to:[recipient],reply_to:settings.sender_email,subject:'Alegrare · Sua consulta',html:`<p>${escape(body)}</p>`,text:body})});
        const data=await response.json();if(!response.ok)throw new Error(`Resend ${response.status}: ${String(data?.message||'falha no envio').slice(0,120)}`);
        providerId=String(data.id||'');
      }else{
        const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN');
        const numberId=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
        const template=Deno.env.get('WHATSAPP_TEMPLATE_NAME');
        const sender=Deno.env.get('WHATSAPP_SENDER_E164');
        const graphVersion=Deno.env.get('WHATSAPP_GRAPH_VERSION');
        if(!token||!numberId||!template||!/^v\d+\.\d+$/.test(graphVersion||'')||sender!==settings.sender_phone)throw new Error('WhatsApp da clínica não configurado');
        if(!/^55\d{10,11}$/.test(toPhone))throw new Error('Paciente sem WhatsApp válido');
        const variables=[name,day,time,description].map(text=>({type:'text',text}));
        const response=await fetch(`https://graph.facebook.com/${graphVersion}/${numberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:toPhone,type:'template',template:{name:template,language:{code:'pt_BR'},components:[{type:'body',parameters:variables}]}})});
        const data=await response.json();if(!response.ok)throw new Error(`WhatsApp ${response.status}: ${String(data?.error?.message||'falha no envio').slice(0,120)}`);
        providerId=String(data.messages?.[0]?.id||'');
      }
    }catch(error){errorMessage=String(error instanceof Error?error.message:error).slice(0,200);status=/não autorizado|cancelada|sem e-mail|sem WhatsApp/.test(errorMessage)?'skipped':'failed';}
    const {error:updateError}=await db.from('appointment_messages').update({status,recipient:recipient||null,provider_id:providerId,error_message:errorMessage,sent_at:status==='sent'?new Date().toISOString():null,locked_at:null,next_attempt_at:new Date(Date.now()+Math.min(60,2**job.attempts)*60000).toISOString()}).eq('id',job.id).eq('status','sending');
    results[job.channel]=updateError?'tracking_error':status;
  }
  return respond({ok:true,delivery:results});
});
