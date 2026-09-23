import { supabase } from './supabase-client.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = value => { const d=new Date(value); return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const statuses = {scheduled:'Agendada',confirmed:'Confirmada',completed:'Compareceu / concluída',no_show:'Faltou',cancelled:'Cancelada'};

export function openAppointmentCare(appointment, patient, clinicId, onSaved){
  document.querySelector('#appointment-care')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='appointment-care';
  dialog.className='consultation-dialog';
  dialog.innerHTML=`<form class="data-form">
    <div class="modal-head"><div><h2>Consulta</h2><p>${escape(patient?.full_name||'Paciente não vinculado')}</p></div><button type="button" data-close aria-label="Fechar">×</button></div>
    <label>Procedimento<input name="procedure" required value="${escape(appointment.procedure_name||'Consulta')}"></label>
    <label>Situação<select name="status">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${appointment.status===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <div class="form-grid"><label>Início<input name="start" type="datetime-local" required value="${localDate(appointment.starts_at)}"></label><label>Término<input name="end" type="datetime-local" required value="${localDate(appointment.ends_at)}"></label></div>
    <p class="consultation-help">Para remarcar, altere o horário e salve. Confirmação de um horário anterior volta para “Agendada”.</p>
    <label>Observações<textarea name="notes" rows="3">${escape(appointment.notes||'')}</textarea></label>
    <label>Motivo da remarcação ou cancelamento<input name="reason" placeholder="Preencha quando alterar o horário ou cancelar"></label>
    <section class="consultation-reminders"><h3>Lembretes da consulta</h3><p>Envio automático e histórico de entrega ainda não estão conectados. As opções abaixo usam o horário salvo.</p><div class="consultation-actions"><button type="button" class="secondary" data-calendar>Adicionar ao calendário</button><button type="button" class="secondary" data-copy>Copiar lembrete do paciente</button></div></section>
    <p role="status" class="consultation-feedback"></p>
    <div class="modal-actions"><button class="secondary" type="button" data-close>Fechar</button><button class="primary" type="submit">Salvar consulta</button></div>
  </form>`;
  document.body.append(dialog);
  dialog.showModal();
  const form=dialog.querySelector('form'), feedback=dialog.querySelector('[role="status"]');
  const close=()=>{dialog.close();dialog.remove();};
  dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.querySelector('[data-copy]').onclick=async()=>{
    const date=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(appointment.starts_at));
    try {await navigator.clipboard.writeText(`Olá! Aqui é da Alegrare. Sua consulta está agendada para ${date} (horário de Brasília). Pode confirmar sua presença?`);feedback.textContent='Lembrete copiado. Nenhuma mensagem foi enviada pelo sistema.';}
    catch {feedback.textContent='O navegador não permitiu copiar a mensagem.';}
  };
  dialog.querySelector('[data-calendar]').onclick=()=>{
    const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Alegrare//Consulta//PT-BR','BEGIN:VEVENT',`UID:${appointment.id}@alegrare`,`DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(appointment.starts_at)}`,`DTEND:${stamp(appointment.ends_at)}`,'SUMMARY:Consulta Alegrare','BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY','DESCRIPTION:Consulta Alegrare em uma hora','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='consulta-alegrare.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    feedback.textContent='Arquivo baixado. Importe no calendário e confira o alerta de 1 hora. Se remarcar, atualize também seu calendário.';
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    const start=new Date(form.elements.start.value),end=new Date(form.elements.end.value);
    if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start){feedback.textContent='Confira as datas: o término deve ser depois do início.';return;}
    const moved=+start!==+new Date(appointment.starts_at)||+end!==+new Date(appointment.ends_at);
    const reason=form.elements.reason.value.trim(),status=form.elements.status.value;
    if((moved||(status==='cancelled'&&appointment.status!=='cancelled'))&&!reason){feedback.textContent='Informe o motivo da remarcação ou do cancelamento.';form.elements.reason.focus();return;}
    if(['completed','no_show'].includes(status)&&start>new Date()){feedback.textContent='Comparecimento ou falta só podem ser registrados após o início da consulta.';return;}
    let notes=form.elements.notes.value.trim();
    if(reason)notes+=`${notes?'\n\n':''}[${new Date().toISOString()}] ${moved?'Remarcação de '+appointment.starts_at+' para '+start.toISOString():'Alteração para '+statuses[status]}: ${reason}`;
    const payload={starts_at:start.toISOString(),ends_at:end.toISOString(),status:moved&&status==='confirmed'?'scheduled':status,procedure_name:form.elements.procedure.value.trim(),notes:notes||null};
    const buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);feedback.textContent='Salvando…';
    try {
      let query=supabase.from('appointments').update(payload).eq('id',appointment.id).eq('clinic_id',clinicId);
      if(appointment.updated_at)query=query.eq('updated_at',appointment.updated_at);
      else query=query.eq('starts_at',appointment.starts_at).eq('ends_at',appointment.ends_at).eq('status',appointment.status);
      const {data,error}=await query.select('*').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('A consulta foi alterada por outra pessoa ou seu perfil não permite editar. Atualize a agenda e tente novamente.');
      close();await onSaved(data);
    } catch(error){feedback.textContent=error.message||'Não foi possível salvar. Tente novamente.';}
    finally {buttons.forEach(b=>b.disabled=false);}
  };
}
