import { supabase } from './supabase-client.js';
import { validateAppointment, friendlyAgendaError } from './agenda-rules.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = value => { const d=new Date(value); return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const statuses = {scheduled:'Agendada / aguardando confirmação',confirmed:'Confirmada',checked_in:'Presença registrada',completed:'Compareceu / concluída',no_show:'Não veio / falta',cancelled:'Cancelada'};

export function openAppointmentCare(appointment, patient, clinicId, onSaved, context={}){
  document.querySelector('#appointment-care')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='appointment-care';
  dialog.className='consultation-dialog';
  dialog.innerHTML=`<form class="data-form">
    <div class="modal-head"><div><h2>Consulta</h2><p>${escape(patient?.full_name||'Paciente não vinculado')}</p></div><button type="button" data-close aria-label="Fechar">×</button></div>
    ${appointment.approval_status==='pending'?`<div class="approval-notice"><b>Aguardando confirmação da responsável</b><p>O horário está reservado até a confirmação ou o cancelamento.</p>${context.availability?.owner?'<label><input type="checkbox" name="approve"> Confirmar este agendamento</label>':''}</div>`:''}
    <label>Procedimento<input name="procedure" required value="${escape(appointment.procedure_name||'Consulta')}"></label>
    <label>Situação<select name="status">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${appointment.status===value?'selected':''}>${label}</option>`).join('')}</select></label>
    <div class="form-grid"><label>Início<input name="start" type="datetime-local" required value="${localDate(appointment.starts_at)}"></label><label>Término<input name="end" type="datetime-local" required value="${localDate(appointment.ends_at)}"></label></div>
    <p class="consultation-help">Para remarcar, altere o horário e salve. Confirmação de um horário anterior volta para “Agendada”.</p>
    <label>Observações<textarea name="notes" rows="3">${escape(appointment.notes||'')}</textarea></label>
    <label>Justificativa da falta, remarcação ou cancelamento<input name="reason" placeholder="Obrigatória ao registrar falta, remarcar ou cancelar"></label>
    <section class="clinical-occurrence"><h3>Atendimento clínico não realizado</h3><p>Registre o que ocorreu e a conduta adotada. Pressão arterial é opcional; não há avaliação automática do resultado.</p><div class="form-grid"><label>Pressão sistólica (mmHg)<input name="bp_systolic" type="number" min="1" max="350" inputmode="numeric"></label><label>Pressão diastólica (mmHg)<input name="bp_diastolic" type="number" min="1" max="250" inputmode="numeric"></label></div><label>Ocorrência / motivo clínico<textarea name="occurrence" rows="3" placeholder="Ex.: aferição e decisão profissional de adiar o atendimento"></textarea></label></section>
    <section class="consultation-reminders"><h3>Retorno</h3><p>Defina uma data de referência. O aviso fica no painel; o horário do retorno só é reservado depois de confirmar a disponibilidade na agenda.</p><div class="form-grid"><label>Data desejada<input name="return_date" type="date"></label><label>Hora sugerida<input name="return_time" type="time" value="09:00"></label></div><button type="button" class="secondary" data-return>Marcar retorno nesta data</button></section>
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
  dialog.querySelector('[data-return]').onclick=()=>{
    const date=form.elements.return_date.value,time=form.elements.return_time.value||'09:00';
    if(!date){feedback.textContent='Escolha a data do retorno.';return;}
    const start=new Date(`${date}T${time}`);
    if(start<=new Date()){feedback.textContent='Escolha uma data futura para o retorno.';return;}
    close();context.onReturn?.(appointment.patient_id,start,new Date(+start+60*60*1000));
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    const start=new Date(form.elements.start.value),end=new Date(form.elements.end.value);
    if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start){feedback.textContent='Confira as datas: o término deve ser depois do início.';return;}
    const moved=+start!==+new Date(appointment.starts_at)||+end!==+new Date(appointment.ends_at);
    const reason=form.elements.reason.value.trim(),status=form.elements.status.value;
    if((moved||(['cancelled','no_show'].includes(status)&&appointment.status!==status))&&!reason){feedback.textContent='Informe a justificativa da falta, remarcação ou cancelamento.';form.elements.reason.focus();return;}
    if(['checked_in','completed','no_show'].includes(status)&&start>new Date()){feedback.textContent='Presença ou falta só podem ser registradas após o início da consulta.';return;}
    const occurrence=form.elements.occurrence.value.trim();const systolic=form.elements.bp_systolic.value,diastolic=form.elements.bp_diastolic.value;
    if((systolic||diastolic)&&(!systolic||!diastolic)){feedback.textContent='Preencha os dois valores da pressão ou deixe ambos vazios.';return;}
    if((systolic||diastolic)&&!occurrence){feedback.textContent='Descreva a ocorrência clínica associada à aferição.';return;}
    if(occurrence&&!['cancelled','no_show'].includes(status)){feedback.textContent='Para registrar um atendimento não realizado, marque Cancelada ou Não veio / falta.';return;}
    if(occurrence&&!reason){feedback.textContent='Informe também a justificativa do não atendimento.';return;}
    let notes=form.elements.notes.value.trim();
    if(reason)notes+=`${notes?'\n\n':''}[${new Date().toISOString()}] ${moved?'Remarcação de '+appointment.starts_at+' para '+start.toISOString():'Alteração para '+statuses[status]}: ${reason}`;
    if(occurrence)notes+=`${notes?'\n\n':''}[Ocorrência clínica] ${new Date().toISOString()} · ${occurrence}${systolic?` · Pressão aferida: ${systolic}/${diastolic} mmHg`:''}`;
    const payload={starts_at:start.toISOString(),ends_at:end.toISOString(),status:moved&&status==='confirmed'?'scheduled':status,procedure_name:form.elements.procedure.value.trim(),notes:notes||null};
    const buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);feedback.textContent='Salvando…';
    try {
      if(status!=='cancelled'){await validateAppointment(clinicId,start,end,appointment.id);await context.availability?.check(start,end);}
      if(form.elements.approve?.checked)payload.approval_status='approved';
      let query=supabase.from('appointments').update(payload).eq('id',appointment.id).eq('clinic_id',clinicId);
      if(appointment.updated_at)query=query.eq('updated_at',appointment.updated_at);
      else query=query.eq('starts_at',appointment.starts_at).eq('ends_at',appointment.ends_at).eq('status',appointment.status);
      const {data,error}=await query.select('*').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('A consulta foi alterada por outra pessoa ou seu perfil não permite editar. Atualize a agenda e tente novamente.');
      close();await onSaved(data);
    } catch(error){feedback.textContent=friendlyAgendaError(error);}
    finally {buttons.forEach(b=>b.disabled=false);}
  };
}
