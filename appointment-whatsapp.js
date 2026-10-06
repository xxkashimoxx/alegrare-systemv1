export function patientWhatsappNumber(phone) {
  const digits=String(phone||'').replace(/\D/g,'');
  if(/^\d{10,11}$/.test(digits))return `55${digits}`;
  return /^55\d{10,11}$/.test(digits)?digits:'';
}

export function appointmentConfirmationUrl(appointment,patient) {
  const target=patientWhatsappNumber(patient?.phone);
  const start=new Date(appointment?.starts_at);
  if(!target||!Number.isFinite(+start))return '';
  const date=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(start);
  const time=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(start);
  const name=String(patient?.social_name||patient?.full_name||'').trim();
  const procedure=String(appointment.procedure_name||'consulta').trim()||'consulta';
  const message=`Olá${name?`, ${name}`:''}! Sua consulta na Alegrare foi agendada para o dia ${date}, às ${time} (horário de Brasília).\nProcedimento: ${procedure}.\nSe precisar alterar o horário, entre em contato conosco.`;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}
