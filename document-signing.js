import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase-client.js';
import { bindPatientPicker, searchPattern, safeIdList } from './clinic-search.js';
import { loadPatientDirectory } from './clinic-directory.js';
import { anamnesisBody, createDocumentImage } from './document-builder.js';

const SIGN_FUNCTION = `${SUPABASE_URL}/functions/v1/patient-document-sign`;

const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeFile = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-');
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)) : '';

let cachedProfile = null;
let injecting = false;
const DOCUMENT_PAGE_SIZE = 12;
let documentPage = 1;
let documentTotal = 0, documentTerm='', documentStatus='', documentSequence=0, documentSearchTimer=null, patientRenderToken=null;

function toast(message, error = false){
  let el = $('#real-toast');
  if(!el){ el = document.createElement('div'); el.id='real-toast'; document.body.appendChild(el); }
  el.textContent = message;
  el.className = error ? 'show error' : 'show';
  setTimeout(()=>el.className='',2600);
}

async function session(){ return (await supabase.auth.getSession()).data.session; }
async function profile(){
  const s = await session();
  if(!s) return null;
  if(cachedProfile?.id === s.user.id) return cachedProfile;
  const {data,error} = await supabase.from('profiles').select('id,clinic_id,full_name,role').eq('id',s.user.id).single();
  if(error) throw error;
  cachedProfile = data;
  return data;
}

function modal(html){
  closeModal();
  const wrap = document.createElement('div');
  wrap.id='real-modal';
  wrap.innerHTML = `<button class="real-modal-backdrop" data-real-close aria-label="Fechar"></button><section class="real-modal-card">${html}</section>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-real-close]').forEach(b=>b.addEventListener('click',closeModal));
  return wrap;
}
function closeModal(){ $('#real-modal')?.remove(); }

async function openUpload(){
    const currentSession=await session();
    if(!currentSession){toast('Entre no painel para enviar documentos.',true);return;}
    const currentProfile=await profile();
    const result=await loadPatientDirectory(currentProfile.clinic_id);
    if(result.error){toast('Não foi possível carregar os pacientes.',true);return;}
    const patients=result.data||[];
    if(!patients.length){toast('Cadastre um paciente antes de enviar um documento.',true);return;}
    const m=modal(`
      <div class="real-modal-head"><div><small>DOCUMENTO</small><h2>Enviar para assinatura</h2><p>Um fluxo só: escolha o arquivo, o paciente e quem precisa assinar.</p></div><button data-real-close>×</button></div>
      <form id="real-upload-form" class="real-form">
        <label>Paciente<select name="patient" required><option value="">Selecione</option>${patients.map(p=>`<option value="${p.id}" data-name="${esc(p.full_name)}" data-phone="${esc(p.phone||'')}" data-email="${esc(p.email||'')}">${esc(p.full_name)}</option>`).join('')}</select></label>
        <label>Título do documento<input name="title" placeholder="Ex.: Termo de consentimento" required></label>
        <label>Arquivo<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" required><small>PDF, imagem ou DOCX · até 20 MB</small></label>
        <fieldset><legend>Quem assina?</legend>
          <label class="real-radio"><input type="radio" name="signers" value="professional" checked><span>Profissional</span></label>
          <label class="real-radio"><input type="radio" name="signers" value="patient"><span>Paciente</span></label>
          <label class="real-radio"><input type="radio" name="signers" value="both"><span>Profissional e paciente</span></label>
        </fieldset>
        <div id="real-patient-contact" hidden>
          <label>Nome que aparecerá para o paciente<input name="patientSignerName"></label>
        </div>
        <div class="real-actions"><button type="button" class="real-btn ghost" data-real-close>Cancelar</button><button class="real-btn primary" id="real-upload-submit">Enviar documento</button></div>
      </form>`);
    const form=$('#real-upload-form',m), patientContact=$('#real-patient-contact',m);
    const selectedPatientName=()=>form.elements.patient.selectedOptions[0]?.dataset.name||'';
    form.elements.signers.forEach(r=>r.addEventListener('change',()=>{patientContact.hidden=r.value==='professional'; if(!patientContact.hidden && !form.elements.patientSignerName.value) form.elements.patientSignerName.value=selectedPatientName();}));
    form.elements.patient.addEventListener('change',()=>{if(!patientContact.hidden) form.elements.patientSignerName.value=selectedPatientName();});
    bindPatientPicker(form.elements.patient,patients);
    form.addEventListener('submit',uploadDocument);
}

async function uploadDocument(e){
  e.preventDefault();
  const form=e.currentTarget, btn=$('#real-upload-submit',form), fd=new FormData(form);
  const file=form.elements.file.files?.[0];
  if(!file) return;
  if(file.size>20*1024*1024){toast('Arquivo maior que 20 MB.',true);return;}
  btn.disabled=true; btn.textContent='Enviando...';
  try{
    const s=await session(); const p=await profile(); if(!s||!p?.clinic_id) throw new Error('Sessão da clínica não encontrada.');
    const patientId=String(fd.get('patient')); const patientName=form.elements.patient.selectedOptions[0]?.dataset.name||''; const title=String(fd.get('title')).trim(); const signersMode=String(fd.get('signers'));
    const contact=form.elements.patient.selectedOptions[0]?.dataset||{};
    const {patientToken}=await storeDocument({s,p,patientId,patientName,title,file,signersMode,signerName:String(fd.get('patientSignerName')||patientName),email:contact.email,phone:contact.phone});
    closeModal(); await refreshDocuments(1);
    if(patientToken)showPatientLink(patientToken,title,patientName,contact.phone,contact.email); else toast('Documento preparado para assinatura profissional.');
  }catch(err){
    console.error(err);
    toast(err?.message||'Falha ao enviar documento.',true);
  }finally{btn.disabled=false;btn.textContent='Enviar documento';}
}

async function storeDocument({s,p,patientId,patientName,title,file,signersMode,signerName,email,phone,accompanied=false,anamnesisId=null}){
  const docId=crypto.randomUUID(),path=`${p.clinic_id}/${docId}/${safeFile(file.name)}`;
  let professional=null;
  if(signersMode==='professional'||signersMode==='both'){
    const {data:settings,error:settingsError}=await supabase.from('agenda_settings').select('owner_id').eq('clinic_id',p.clinic_id).maybeSingle();
    if(settingsError)throw settingsError;
    if(!settings?.owner_id)throw new Error('Defina a profissional responsável da clínica antes de solicitar a assinatura profissional.');
    professional={id:settings.owner_id,full_name:settings.owner_id===p.id?p.full_name:'Profissional responsável'};
  }
  let uploaded=false,inserted=false;
  try{
    const result=await supabase.storage.from('clinic-documents').upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(result.error)throw result.error;uploaded=true;
    const record=await supabase.from('documents').insert({id:docId,clinic_id:p.clinic_id,patient_id:patientId,patient_name:patientName,title,file_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size,uploaded_by:s.user.id}).select('id').single();
    if(record.error)throw record.error;inserted=true;
    const signers=[];let patientToken=null;
    if(professional)signers.push({clinic_id:p.clinic_id,document_id:docId,signer_type:'professional',signer_user_id:professional.id,signer_name:professional.full_name||'Profissional',metadata:anamnesisId?{source_anamnesis_id:anamnesisId}:{}});
    if(signersMode==='patient'||signersMode==='both'){
      patientToken=crypto.randomUUID();
      signers.push({clinic_id:p.clinic_id,document_id:docId,signer_type:'patient',signer_name:signerName.trim()||patientName,signer_email:email||null,signer_phone:phone||null,signing_token:patientToken,metadata:{accompanied_by_professional:accompanied,delivery_status:'not_sent',...(anamnesisId?{source_anamnesis_id:anamnesisId}:{})}});
    }
    const signed=await supabase.from('document_signers').insert(signers);if(signed.error)throw signed.error;
    return {docId,patientToken};
  }catch(error){
    if(inserted)await supabase.from('documents').delete().eq('id',docId);
    if(uploaded)await supabase.storage.from('clinic-documents').remove([path]);
    throw error;
  }
}

async function openCreateDocument({patientId='',anamnesisId=''}={}){
  const s=await session(),p=await profile();if(!s||!p?.clinic_id){toast('Entre no painel antes de criar documentos.',true);return;}
  const {data:settings,error:settingsError}=await supabase.from('agenda_settings').select('owner_id').eq('clinic_id',p.clinic_id).maybeSingle();
  if(settingsError){toast('Não foi possível consultar a responsável pela clínica.',true);return;}
  const professionalName=settings?.owner_id===p.id?p.full_name:'Profissional responsável';
  const directory=await loadPatientDirectory(p.clinic_id);if(directory.error){toast(directory.error.message,true);return;}
  const patients=directory.data||[];
  let body='';
  if(anamnesisId){
    const {data,error}=await supabase.from('patient_anamneses').select('patient_id,answers,anamnesis_date').eq('clinic_id',p.clinic_id).eq('id',anamnesisId).single();
    if(error||!data||data.patient_id!==patientId){toast('A anamnese não está disponível para este paciente.',true);return;}
    body=anamnesisBody(data.answers);
    if(!body){toast('A anamnese não contém perguntas respondidas para assinar.',true);return;}
  }
  const m=modal(`<div class="real-modal-head"><div><small>DOCUMENTO DA CLÍNICA</small><h2>${anamnesisId?'Anamnese para assinatura':'Criar termo / documento'}</h2><p>Dados do paciente preenchidos do cadastro. Revise o conteúdo antes de gerar a cópia privada.</p></div><button data-real-close>×</button></div>
    <form class="real-form" id="real-create-form"><label>Paciente<select name="patient" required><option value="">Selecione</option>${patients.map(x=>`<option value="${x.id}" ${x.id===patientId?'selected':''}>${esc(x.full_name)}</option>`).join('')}</select></label>
    <div class="real-patient-preview" data-patient-preview></div>
    <label>Título<input name="title" maxlength="120" required value="${anamnesisId?'Anamnese geral para assinatura':''}" placeholder="Ex.: Termo de consentimento"></label>
    <label>Texto completo do documento<textarea name="body" rows="9" minlength="15" required placeholder="Escreva o conteúdo que o paciente deve ler e assinar">${esc(body)}</textarea></label>
    <div class="form-grid"><label>Nome do responsável (se houver)<input name="responsibleName" maxlength="160"></label><label>Documento do responsável<input name="responsibleDocument" maxlength="50"></label></div>
    <label class="availability-toggle"><input type="checkbox" name="accompanied"> O preenchimento da anamnese foi acompanhado pela profissional</label>
    <label>Quem assina?<select name="signers"><option value="patient">Paciente</option><option value="both">Paciente e profissional</option><option value="professional">Profissional</option></select></label>
    <p class="privacy-hint">O documento será criado como imagem com a marca Alegrare e os dados cadastrados. Observações internas não são incluídas. Confira todos os dados antes de gerar.</p>
    <p role="status" data-create-feedback></p><div class="real-actions"><button type="button" class="real-btn ghost" data-real-close>Cancelar</button><button class="real-btn primary">Criar para assinatura</button></div></form>`);
  const form=$('#real-create-form',m),preview=$('[data-patient-preview]',m);
  const showPatient=()=>{const selected=patients.find(x=>x.id===form.elements.patient.value);preview.innerHTML=selected?`<b>${esc(selected.full_name)}</b><p>CPF: ${esc(selected.cpf||'Não informado')} · Nascimento: ${esc(selected.birth_date||'Não informado')}</p><p>Telefone: ${esc(selected.phone||'Não informado')} · E-mail: ${esc(selected.email||'Não informado')}</p><p>Responsável cadastrado: ${esc(selected.source_payload?.PersonInCharge||'Não informado')}</p>`:'<p>Selecione um paciente para conferir os dados.</p>';form.elements.responsibleName.value=selected?.source_payload?.PersonInCharge||'';form.elements.responsibleDocument.value=selected?.source_payload?.PersonInChargeDocument||selected?.source_payload?.PersonInChargeOtherDocument||'';};
  form.elements.patient.onchange=showPatient;showPatient();
  if(!anamnesisId)bindPatientPicker(form.elements.patient,patients);
  else form.elements.patient.disabled=true;
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('.primary'),feedback=$('[data-create-feedback]',form);button.disabled=true;feedback.textContent='Gerando e salvando o documento…';
    try{
      const selected=patients.find(x=>x.id===(anamnesisId?patientId:form.elements.patient.value));if(!selected)throw new Error('Escolha um paciente cadastrado.');
      const responsibleName=form.elements.responsibleName.value.trim(),responsibleDocument=form.elements.responsibleDocument.value.trim();
      if(responsibleDocument&&!responsibleName)throw new Error('Informe o nome do responsável junto do documento.');
      const title=form.elements.title.value.trim(),file=await createDocumentImage({title,body:form.elements.body.value.trim(),patient:selected,responsibleName,responsibleDocument,professional:professionalName,accompanied:form.elements.accompanied.checked});
      const {patientToken}=await storeDocument({s,p,patientId:selected.id,patientName:selected.full_name,title,file,signersMode:form.elements.signers.value,signerName:selected.full_name,email:selected.email,phone:selected.phone,accompanied:form.elements.accompanied.checked,anamnesisId:anamnesisId||null});
      closeModal();await refreshDocuments(1);
      if(patientToken)showPatientLink(patientToken,title,selected.full_name,selected.phone,selected.email);else toast('Documento preparado para assinatura profissional.');
    }catch(error){feedback.textContent=error.message||'Não foi possível criar o documento.';button.disabled=false;}
  };
}

function patientLink(token){ return `${location.origin}${location.pathname}#/assinar/${token}`; }
function showPatientLink(token,title,patient,phone,email){
  const link=patientLink(token);
  const digits=String(phone||'').replace(/\D/g,'');const number=digits.length===10||digits.length===11?`55${digits}`:digits;
  const message=`Olá! A Alegrare disponibilizou um documento para sua leitura e assinatura. Acesse seu link individual: ${link}`;
  const encoded=encodeURIComponent(message);
  const m=modal(`
    <div class="real-modal-head"><div><small>LINK DO PACIENTE</small><h2>Documento pronto</h2><p>${esc(patient)} pode abrir e assinar sem acessar o painel.</p></div><button data-real-close>×</button></div>
    <div class="real-success"><b>${esc(title)}</b><label>Link de assinatura<div class="real-copy"><input readonly value="${esc(link)}"><button class="real-btn primary" id="real-copy-link">Copiar link</button></div></label><p>O arquivo permanece privado no Storage. O link libera acesso temporário somente após validar o token de assinatura.</p><p class="privacy-hint">Confira o destinatário antes de abrir o aplicativo de mensagens. Nenhuma mensagem é enviada automaticamente.</p><div class="consultation-actions">${/^55\d{10,11}$/.test(number)?`<a class="real-btn ghost" target="_blank" rel="noopener noreferrer" href="https://wa.me/${number}?text=${encoded}">Abrir WhatsApp</a><a class="real-btn ghost" href="sms:+${number}?body=${encoded}">Abrir SMS</a>`:''}${email?`<a class="real-btn ghost" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Documento Alegrare para assinatura')}&body=${encoded}">Abrir e-mail</a>`:''}</div></div>`);
  $('#real-copy-link',m).addEventListener('click',async()=>{await navigator.clipboard.writeText(link);toast('Link copiado.');});
}

function documentsPagination(){
  const pages=Math.ceil(documentTotal/DOCUMENT_PAGE_SIZE);
  if(!documentTotal)return '';
  if(pages===1)return `<div class="real-pagination-note">${documentTotal} documento${documentTotal===1?'':'s'} em ordem cronológica.</div>`;
  const visible=[];
  for(let n=Math.max(1,documentPage-2);n<=Math.min(pages,documentPage+2);n++)visible.push(n);
  if(!visible.includes(1))visible.unshift(1);
  if(!visible.includes(pages))visible.push(pages);
  const numbers=visible.map((n,index)=>`${index&&n>visible[index-1]+1?'<span>…</span>':''}<button class="real-page-number ${n===documentPage?'active':''}" data-doc-page="${n}" ${n===documentPage?'aria-current="page"':''}>${n}</button>`).join('');
  return `<nav class="real-pagination" aria-label="Páginas de documentos"><button data-doc-page="${documentPage-1}" ${documentPage===1?'disabled':''}>Anterior</button><div>${numbers}</div><button data-doc-page="${documentPage+1}" ${documentPage===pages?'disabled':''}>Próxima</button><small>Página ${documentPage} de ${pages} · ${documentTotal} documentos</small></nav>`;
}

async function refreshDocuments(page=documentPage){
  const host=$('#real-documents-list'); if(!host) return;
  const seq=++documentSequence;host.setAttribute('aria-busy','true');const feedback=$('#real-document-feedback');if(feedback)feedback.textContent='Buscando documentos em todo o histórico…';
  const s=await session();
  if(!s){host.innerHTML='<div class="real-empty"><p>Entre no painel para ver os documentos.</p></div>';return;}
  const p=await profile();
  const from=(page-1)*DOCUMENT_PAGE_SIZE,to=from+DOCUMENT_PAGE_SIZE-1;
  let query=supabase.from('documents').select('id,title,patient_name,file_name,file_path,mime_type,status,created_at,document_signers(id,signer_type,signer_user_id,signer_name,signer_email,signer_phone,status,signing_token,signed_at,updated_at,metadata)',{count:'exact'}).eq('clinic_id',p.clinic_id);
  if(documentTerm.trim()){const pattern=searchPattern(documentTerm);const {data:patientMatches,error:patientError}=await supabase.from('patients').select('id').eq('clinic_id',p.clinic_id).or(`full_name.ilike.${pattern},phone.ilike.${pattern}`).limit(500);if(patientError||patientMatches?.length===500){host.removeAttribute('aria-busy');if(feedback)feedback.textContent=patientError?'Não foi possível buscar os pacientes dos documentos.':'Há muitos pacientes correspondentes. Refine o nome ou telefone.';return;}const ids=safeIdList((patientMatches||[]).map(p=>p.id));query=query.or(`title.ilike.${pattern},patient_name.ilike.${pattern},file_name.ilike.${pattern}`+(ids.length?`,patient_id.in.(${ids.join(',')})`:''));}
  if(documentStatus)query=query.eq('status',documentStatus);
  const {data,error,count}=await query.order('created_at',{ascending:false}).order('id').range(from,to);
  if(seq!==documentSequence||!host.isConnected)return;host.removeAttribute('aria-busy');
  if(error){if(feedback)feedback.textContent='Não foi possível consultar os documentos.';host.innerHTML='<div class="real-empty"><p>Falha na consulta. Tente novamente.</p><button class="real-btn ghost" data-doc-retry>Tentar novamente</button></div>';host.querySelector('[data-doc-retry]').onclick=()=>refreshDocuments(page);return;}
  documentTotal=count||0;if(feedback)feedback.textContent=`${documentTotal} documento(s) encontrado(s) em todo o histórico.`;
  const pages=Math.max(1,Math.ceil(documentTotal/DOCUMENT_PAGE_SIZE));
  documentPage=Math.min(Math.max(1,page),pages);
  if(page>pages){return refreshDocuments(documentPage);}
  if(!data?.length){host.innerHTML='<div class="real-empty"><b>Nenhum documento encontrado</b><p>Ajuste a busca ou envie um documento.</p></div>';return;}
  host.innerHTML=`${data.map(doc=>{
    const patient=doc.document_signers?.find(x=>x.signer_type==='patient');
    const professional=doc.document_signers?.find(x=>x.signer_type==='professional');
    const labels=[]; if(professional) labels.push(`Profissional: ${professional.status==='signed'?'assinado':'pendente'}`); if(patient) labels.push(`Paciente: ${patient.status==='signed'?'assinado':'pendente'}`);
    return `<article class="real-doc-row"><div class="real-doc-main"><span class="real-file-icon">${esc((doc.file_name||'Arquivo').split('.').pop().toUpperCase().slice(0,5))}</span><span><b>${esc(doc.title)}</b><small>${esc(doc.patient_name)} · ${esc(doc.file_name)}</small><em>${labels.join(' · ')}</em></span></div><div class="real-doc-actions"><button class="real-btn ghost small" data-doc-open="${doc.id}">Abrir arquivo</button><button class="real-btn ghost small" data-doc-details="${doc.id}">Detalhes</button>${professional?.status==='pending'&&professional.signer_user_id===p.id?`<button class="real-btn small" data-prof-sign="${professional.id}">Assinar</button>`:''}${patient?.status==='pending'?`<button class="real-btn ghost small" data-copy-token="${patient.signing_token}">Copiar link</button>`:''}<span class="real-status ${doc.status}">${doc.status==='signed'?'Assinado':'Pendente'}</span></div></article>`;
  }).join('')}${documentsPagination()}`;
  host.querySelectorAll('[data-doc-open]').forEach(b=>b.onclick=()=>openDocument(data.find(doc=>doc.id===b.dataset.docOpen)));
  host.querySelectorAll('[data-doc-details]').forEach(b=>b.onclick=()=>openDocumentDetails(data.find(doc=>doc.id===b.dataset.docDetails)));
  host.querySelectorAll('[data-prof-sign]').forEach(b=>b.addEventListener('click',()=>signProfessional(b.dataset.profSign)));
  host.querySelectorAll('[data-copy-token]').forEach(b=>b.addEventListener('click',async()=>{await navigator.clipboard.writeText(patientLink(b.dataset.copyToken));toast('Link do paciente copiado.');}));
  host.querySelectorAll('[data-doc-page]').forEach(b=>b.addEventListener('click',()=>refreshDocuments(Number(b.dataset.docPage))));
}

function openDocumentDetails(doc){
  const signer=doc.document_signers?.find(x=>x.signer_type==='patient');
  const professional=doc.document_signers?.find(x=>x.signer_type==='professional');
  const meta=signer?.metadata||{};
  const subject=`Alegrare · ${doc.status==='signed'?'assinatura concluída':'documento para acompanhamento'}`;
  const body=`Documento: ${doc.title}\nPaciente: ${doc.patient_name}\nSituação: ${doc.status==='signed'?'assinado':'pendente'}\nData de criação: ${fmtDate(doc.created_at)}\nConferir no painel: ${location.origin}${location.pathname}#/documents\n\nConfira o registro no painel antes de qualquer ação.`;
  const email=`mailto:daniellecoelho@alegrare.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const m=modal(`<div class="real-modal-head"><div><small>ACOMPANHAMENTO</small><h2>${esc(doc.title)}</h2><p>${esc(doc.patient_name)}</p></div><button data-real-close>×</button></div><div class="real-document-details">
    <p><b>Solicitação criada em:</b> ${esc(fmtDate(doc.created_at))}</p><p><b>Destinatário:</b> ${esc(signer?.signer_name||'Sem assinatura do paciente')} ${signer?.signer_email?`· ${esc(signer.signer_email)}`:''}</p>
    <p><b>Envio do link:</b> ${meta.sent_at?`Registrado manualmente em ${esc(fmtDate(meta.sent_at))} · ${esc(meta.sent_channel||'canal não informado')}`:'Não registrado'}</p>
    <p><b>Recebimento informado:</b> ${meta.received_at?esc(fmtDate(meta.received_at)):'Não registrado'}</p><p><b>Preenchimento acompanhado pela profissional:</b> ${meta.accompanied_by_professional?'Sim':'Não informado'}</p>
    <p><b>Assinatura do paciente:</b> ${signer?.signed_at?`${esc(signer.signer_name)} · ${esc(fmtDate(signer.signed_at))}`:'Pendente'}</p><p><b>Localidade declarada pelo paciente:</b> ${esc(meta.signer_location||'Não informada')}</p>
    <p><b>Assinatura profissional:</b> ${professional?.signed_at?esc(fmtDate(professional.signed_at)):(professional?'Pendente':'Não solicitada')}</p>
    <p class="privacy-hint">Envio e recebimento são confirmações manuais da equipe. A assinatura guarda aceite, data e dados técnicos de auditoria; localidade é declarada pelo paciente.</p>
    <div class="consultation-actions"><a class="real-btn ghost" href="${esc(email)}">Preparar e-mail para Danielle</a>${signer&&!meta.sent_at?'<button class="real-btn ghost" data-record-sent>Registrar envio do link</button>':''}${signer&&!meta.received_at?'<button class="real-btn ghost" data-record-received>Registrar recebimento informado</button>':''}</div><p role="status" data-delivery-feedback></p></div>`);
  for(const [selector,key] of [['[data-record-sent]','sent'],['[data-record-received]','received']]){
    m.querySelector(selector)?.addEventListener('click',async e=>{
      const button=e.currentTarget,feedback=m.querySelector('[data-delivery-feedback]');button.disabled=true;
      const channel=key==='sent'?window.prompt('Canal usado para enviar o link (WhatsApp, SMS ou e-mail):','WhatsApp')?.trim():null;
      if(key==='sent'&&!['WhatsApp','SMS','e-mail'].includes(channel)){button.disabled=false;feedback.textContent='Escolha WhatsApp, SMS ou e-mail após enviar o link.';return;}
      const next={...meta,[key==='sent'?'sent_at':'received_at']:new Date().toISOString()};if(channel)next.sent_channel=channel;
      const p=await profile();const {data,error}=await supabase.from('document_signers').update({metadata:next,updated_at:new Date().toISOString()}).eq('clinic_id',p.clinic_id).eq('id',signer.id).eq('updated_at',signer.updated_at).select('id').maybeSingle();
      if(error||!data){button.disabled=false;feedback.textContent=error?.message||'Não foi possível registrar. Atualize a tela.';return;}
      closeModal();await refreshDocuments();toast(key==='sent'?'Envio do link registrado.':'Recebimento informado registrado.');
    });
  }
}

async function openDocument(doc){
 const m=modal(`<div class="real-modal-head"><h2>${esc(doc.title)}</h2><button data-real-close aria-label="Fechar">×</button></div><div id="real-file-preview"><p>Preparando acesso ao arquivo…</p></div>`);
 try{if(!doc.file_path)throw new Error('O arquivo não possui caminho de armazenamento.');const {data,error}=await supabase.storage.from('clinic-documents').createSignedUrl(doc.file_path,300);if(error)throw error;if(!m.isConnected)return;const url=data.signedUrl,host=$('#real-file-preview',m);host.innerHTML=`<p>Paciente: ${esc(doc.patient_name)} · ${esc(doc.file_name)}</p><a class="real-btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir / baixar arquivo</a><p class="real-help">O acesso ao arquivo expira em cinco minutos.</p>${(doc.mime_type||'').startsWith('image/')?`<img class="document-preview-image" src="${esc(url)}" alt="Documento">`:(doc.mime_type==='application/pdf'||/\.pdf$/i.test(doc.file_name))?`<iframe class="document-preview-frame" src="${esc(url)}" title="Visualização do documento"></iframe>`:''}`;
 }catch(error){if(m.isConnected)$('#real-file-preview',m).textContent=error.message||'Não foi possível abrir o arquivo.';}
}

async function signProfessional(id){
  const s=await session(); if(!s){toast('Sua sessão expirou. Entre novamente.',true);return;}
  const p=await profile();const {data,error}=await supabase.from('document_signers').update({status:'signed',signed_at:new Date().toISOString(),signature_method:'authenticated_clinic_user'}).eq('clinic_id',p.clinic_id).eq('id',id).eq('signer_type','professional').eq('signer_user_id',s.user.id).eq('status','pending').select('id').maybeSingle();
  if(error||!data){toast(error?.message||'A assinatura mudou ou seu perfil não permite assinar. Atualize os documentos.',true);return;} toast('Assinatura profissional registrada.'); refreshDocuments();
}

async function injectClinicUI(){
  if(injecting || isPatientRoute()) return;
  const content=$('.content'); if(!content) return;
  const isDocs=location.hash==='#/documents';
  if(!isDocs) return;
  injecting=true;
  try{
    if(!$('#real-documents-card')){
      const card=document.createElement('section'); card.id='real-documents-card'; card.className='card real-documents-card';
      card.innerHTML='<div class="real-section-head"><div><small>ASSINATURAS</small><h2>Documentos enviados</h2><p>Um lugar para acompanhar profissional e paciente.</p></div><button class="real-btn primary" data-create-document>Criar termo no painel</button></div><div class="record-search-tools"><label>Buscar documento<input id="real-document-search" type="search" autocomplete="off" placeholder="Paciente, telefone, título ou arquivo"></label><label>Situação<select id="real-document-status"><option value="">Todas</option><option value="signed">Assinados</option><option value="pending">Pendentes</option></select></label></div><p id="real-document-feedback" class="search-feedback" role="status"></p><div id="real-documents-list"><div class="real-loading">Carregando...</div></div>';
      content.appendChild(card);$('#real-document-search').value=documentTerm;$('#real-document-status').value=documentStatus;$('#real-document-search').oninput=e=>{documentTerm=e.target.value;documentPage=1;documentSequence++;clearTimeout(documentSearchTimer);documentSearchTimer=setTimeout(()=>refreshDocuments(1),250);};$('#real-document-status').onchange=e=>{documentStatus=e.target.value;documentPage=1;refreshDocuments(1);};refreshDocuments();
      $('[data-create-document]',card).onclick=()=>openCreateDocument();
    }
  }finally{injecting=false;}
}

function isPatientRoute(){ return /^#\/assinar\/[0-9a-f-]{36}$/i.test(location.hash); }
function tokenFromRoute(){ return location.hash.split('/')[2] || ''; }

async function renderPatientSigning(){
  if(!isPatientRoute()) return false;
  const token=tokenFromRoute();if(patientRenderToken===token)return true;patientRenderToken=token;
  const app=$('#app'); if(!app) return true;
  app.innerHTML=`<main class="patient-sign-page"><section class="patient-sign-shell"><div class="sign-brand"><span>A</span><div><b>Alegrare</b><small>ODONTOLOGIA ESPECIAL</small></div></div><div id="patient-sign-content" class="patient-sign-card"><p>Carregando documento...</p></div><p class="privacy-hint" role="note">Dados pessoais e de saúde: este link é individual. Abra somente se você for o destinatário e não encaminhe a terceiros.</p></section></main>`;
  const host=$('#patient-sign-content');
  try{
    const res=await fetch(`${SIGN_FUNCTION}?token=${encodeURIComponent(tokenFromRoute())}`,{headers:{apikey:SUPABASE_KEY}}); const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Link inválido.');
    const already=data.signer.status==='signed';
    const viewer=(data.document.mimeType||'').startsWith('image/')?`<img class="patient-document-image" src="${esc(data.document.url)}" alt="Documento">`:`<iframe class="patient-document-view" src="${esc(data.document.url)}" title="Documento"></iframe>`;
    host.innerHTML=`<div class="patient-sign-head"><small>DOCUMENTO PARA ASSINATURA</small><h1>${esc(data.document.title)}</h1><p>Paciente: <b>${esc(data.document.patientName)}</b></p>${data.signer.accompanied?'<p>Preenchimento da anamnese realizado com acompanhamento da profissional.</p>':''}</div>${viewer}${already?`<div class="patient-signed-ok">✓ Assinatura registrada em ${esc(fmtDate(data.signer.signedAt))}${data.signer.location?` · ${esc(data.signer.location)}`:''}</div>`:`<form id="patient-sign-form" class="real-form patient-form"><label>Assinatura do paciente · nome completo<input name="name" value="${esc(data.signer.name)}" required minlength="3"></label><label>Localidade declarada (cidade/UF, opcional)<input name="location" maxlength="120" placeholder="Ex.: São Paulo/SP"></label><label class="patient-consent"><input type="checkbox" name="accepted" required><span>Li o documento apresentado e concordo com seu conteúdo.</span></label><button class="real-btn primary patient-submit">Assinar documento</button><p class="real-help">Este fluxo registra aceite eletrônico, data, navegador e informações técnicas de auditoria. Não representa certificado ICP-Brasil.</p></form>`}`;
    $('#patient-sign-form',host)?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget, btn=$('.patient-submit',form); btn.disabled=true;btn.textContent='Registrando...';
      try{
        const r=await fetch(SIGN_FUNCTION,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify({token:tokenFromRoute(),signerName:form.elements.name.value,location:form.elements.location.value,accepted:form.elements.accepted.checked})}); const result=await r.json();
        if(!r.ok) throw new Error(result.error||'Falha ao assinar.');
        host.innerHTML=`<div class="patient-complete"><span>✓</span><h1>Documento assinado</h1><p>O aceite foi registrado em ${esc(fmtDate(result.signedAt))}.</p><small>Você já pode fechar esta página.</small></div>`;
      }catch(err){toast(err.message,true);btn.disabled=false;btn.textContent='Assinar documento';}
    });
  }catch(err){host.innerHTML=`<div class="patient-complete error"><span>!</span><h1>Link indisponível</h1><p>${esc(err.message)}</p></div>`;}
  return true;
}

const observer=new MutationObserver(()=>{ if(isPatientRoute()) renderPatientSigning(); else {patientRenderToken=null;injectClinicUI();} });
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(()=>{ if(isPatientRoute()) renderPatientSigning(); else injectClinicUI(); },0));
window.addEventListener('alegrare:rendered',injectClinicUI);
window.addEventListener('alegrare:upload-document',openUpload);
window.addEventListener('alegrare:create-anamnesis-document',e=>openCreateDocument(e.detail||{}));
supabase.auth.onAuthStateChange(()=>{cachedProfile=null;setTimeout(refreshDocuments,0);});
if(!(await renderPatientSigning())) injectClinicUI();
