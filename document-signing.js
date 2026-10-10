import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase-client.js';
import { bindPatientPicker, searchPattern, safeIdList } from './clinic-search.js';
import { loadPatientDirectory } from './clinic-directory.js';
import { anamnesisBody, createDocumentImage } from './document-builder.js';
import { documentSigningLink, documentWhatsappUrl, documentWhatsappNumber } from './document-whatsapp.js';

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

function documentContactFields(){
  return `<div class="real-document-contact" data-document-contact>
    <label>Nome que aparecerá para o paciente<input name="patientSignerName" maxlength="160"></label>
    <button type="submit" name="delivery" value="whatsapp" class="real-btn whatsapp" data-document-send-whatsapp>Enviar documento pelo WhatsApp</button>
    <small class="real-help" data-whatsapp-contact role="status"></small>
    <small class="real-help">O documento será salvo e o WhatsApp abrirá com a mensagem e o link prontos. Toque em enviar na conversa.</small>
  </div>`;
}

function bindDocumentContact(form,patients){
  const contact=$('[data-document-contact]',form),button=$('[data-document-send-whatsapp]',form),hint=$('[data-whatsapp-contact]',form);
  const update=(resetName=false)=>{
    const selected=patients.find(patient=>patient.id===form.elements.patient.value);
    contact.hidden=form.elements.signers.value==='professional';
    if(resetName||!form.elements.patientSignerName.value)form.elements.patientSignerName.value=selected?.full_name||'';
    button.disabled=form.dataset.saving==='true'||contact.hidden||!documentWhatsappNumber(selected?.phone);
    hint.textContent=!selected?'Selecione o paciente para enviar.':!documentWhatsappNumber(selected.phone)?'Cadastre um telefone válido com DDD na ficha deste paciente para enviar pelo WhatsApp.':`Destinatário: ${selected.social_name||selected.full_name} · ${selected.phone}`;
  };
  form.elements.patient.addEventListener('change',()=>update(true));
  form.addEventListener('input',event=>{if(event.target.type==='search')update(true);});
  form.querySelectorAll('[name="signers"]').forEach(input=>input.addEventListener('change',()=>update()));
  update();
  return update;
}

function reserveWhatsappWindow(){
  const target=window.open('about:blank','_blank');
  if(target){target.opener=null;target.document.title='Preparando documento';target.document.body.textContent='Salvando o documento para abrir o WhatsApp…';}
  return target;
}

function openPreparedWhatsapp(url,target){
  if(!url){target?.close();throw new Error('Não foi possível preparar o WhatsApp do paciente. Confira o telefone cadastrado.');}
  if(target&&!target.closed)target.location.replace(url);
  else window.location.assign(url);
}

function documentWhatsappAction(doc){
  const signer=doc.document_signers?.find(item=>item.signer_type==='patient');
  if(!signer?.signing_token)return '';
  const url=documentWhatsappUrl({token:signer.signing_token,phone:doc.patients?.phone,patientName:doc.patients?.social_name||doc.patients?.full_name||doc.patient_name,title:doc.title,signed:signer.status==='signed',pageUrl:location.href});
  return url?`<a class="real-btn whatsapp small" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Abrir a conversa de ${esc(doc.patients?.full_name)} · ${esc(doc.patients?.phone)}">Enviar pelo WhatsApp</a>`:'<button type="button" class="real-btn ghost small" disabled title="Cadastre um telefone válido com DDD na ficha do paciente">Enviar pelo WhatsApp · sem telefone válido</button>';
}

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
        ${documentContactFields()}
        <div class="real-actions"><button type="button" class="real-btn ghost" data-real-close>Cancelar</button><button type="submit" class="real-btn primary" id="real-upload-submit">Salvar documento</button></div>
      </form>`);
    const form=$('#real-upload-form',m),updateContact=bindDocumentContact(form,patients);
    bindPatientPicker(form.elements.patient,patients);
    form.addEventListener('submit',e=>uploadDocument(e,updateContact));
}

async function uploadDocument(e,updateContact){
  e.preventDefault();
  const form=e.currentTarget, btn=$('#real-upload-submit',form), fd=new FormData(form);
  if(form.dataset.saving==='true')return;
  const file=form.elements.file.files?.[0];
  if(!file) return;
  if(file.size>20*1024*1024){toast('Arquivo maior que 20 MB.',true);return;}
  if(form.elements.signers.value!=='professional'&&!(/\.(pdf|png|jpe?g)$/i.test(file.name))){toast('Para assinatura do paciente, envie PDF, PNG ou JPG. Converta o DOCX para PDF.',true);return;}
  const sendWhatsapp=e.submitter?.value==='whatsapp',contact=form.elements.patient.selectedOptions[0]?.dataset||{};
  if(sendWhatsapp&&(form.elements.signers.value==='professional'||!documentWhatsappNumber(contact.phone))){toast('Escolha a assinatura do paciente e confira o telefone cadastrado.',true);return;}
  const whatsappWindow=sendWhatsapp?reserveWhatsappWindow():null;
  form.dataset.saving='true';
  const submitButtons=form.querySelectorAll('button[type="submit"]');submitButtons.forEach(button=>button.disabled=true);
  btn.disabled=true; btn.textContent='Enviando...';
  try{
    const s=await session(); const p=await profile(); if(!s||!p?.clinic_id) throw new Error('Sessão da clínica não encontrada.');
    const patientId=String(fd.get('patient')); const patientName=contact.name||''; const title=String(fd.get('title')).trim(); const signersMode=String(fd.get('signers'));
    const {patientToken}=await storeDocument({s,p,patientId,patientName,title,file,signersMode,signerName:String(fd.get('patientSignerName')||patientName),email:contact.email,phone:contact.phone});
    closeModal();
    if(patientToken)showPatientLink(patientToken,title,patientName,contact.phone,contact.email); else toast('Documento preparado para assinatura profissional.');
    if(sendWhatsapp)openPreparedWhatsapp(documentWhatsappUrl({token:patientToken,phone:contact.phone,patientName:contact.name,title,pageUrl:location.href}),whatsappWindow);
    refreshDocuments(1).catch(console.error);refreshPatientDocuments().catch(console.error);
  }catch(err){
    whatsappWindow?.close();
    console.error(err);
    toast(err?.message||'Falha ao enviar documento.',true);
  }finally{delete form.dataset.saving;submitButtons.forEach(button=>button.disabled=false);btn.textContent='Salvar documento';updateContact();}
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
    ${documentContactFields()}
    <p class="privacy-hint">O documento será criado como imagem com a marca Alegrare e os dados cadastrados. Observações internas não são incluídas. Confira todos os dados antes de gerar.</p>
    <p role="status" data-create-feedback></p><div class="real-actions"><button type="button" class="real-btn ghost" data-real-close>Cancelar</button><button type="submit" class="real-btn primary">Criar para assinatura</button></div></form>`);
  const form=$('#real-create-form',m),preview=$('[data-patient-preview]',m);
  const showPatient=()=>{const selected=patients.find(x=>x.id===form.elements.patient.value);preview.innerHTML=selected?`<b>${esc(selected.full_name)}</b><p>CPF: ${esc(selected.cpf||'Não informado')} · Nascimento: ${esc(selected.birth_date||'Não informado')}</p><p>Telefone: ${esc(selected.phone||'Não informado')} · E-mail: ${esc(selected.email||'Não informado')}</p><p>Responsável cadastrado: ${esc(selected.source_payload?.PersonInCharge||'Não informado')}</p>`:'<p>Selecione um paciente para conferir os dados.</p>';form.elements.responsibleName.value=selected?.source_payload?.PersonInCharge||'';form.elements.responsibleDocument.value=selected?.source_payload?.PersonInChargeDocument||selected?.source_payload?.PersonInChargeOtherDocument||'';};
  form.elements.patient.onchange=showPatient;showPatient();
  const updateContact=bindDocumentContact(form,patients);
  if(!anamnesisId)bindPatientPicker(form.elements.patient,patients);
  else form.elements.patient.disabled=true;
  form.onsubmit=async e=>{e.preventDefault();if(form.dataset.saving==='true')return;const feedback=$('[data-create-feedback]',form),selected=patients.find(x=>x.id===(anamnesisId?patientId:form.elements.patient.value));
    const sendWhatsapp=e.submitter?.value==='whatsapp';
    if(sendWhatsapp&&(form.elements.signers.value==='professional'||!documentWhatsappNumber(selected?.phone))){feedback.textContent='Escolha a assinatura do paciente e confira o telefone cadastrado.';return;}
    const whatsappWindow=sendWhatsapp?reserveWhatsappWindow():null,submitButtons=form.querySelectorAll('button[type="submit"]');submitButtons.forEach(item=>item.disabled=true);feedback.textContent='Gerando e salvando o documento…';
    form.dataset.saving='true';
    try{
      if(!selected)throw new Error('Escolha um paciente cadastrado.');
      const responsibleName=form.elements.responsibleName.value.trim(),responsibleDocument=form.elements.responsibleDocument.value.trim();
      if(responsibleDocument&&!responsibleName)throw new Error('Informe o nome do responsável junto do documento.');
      const title=form.elements.title.value.trim(),signersMode=form.elements.signers.value,signerName=form.elements.patientSignerName.value||selected.full_name,accompanied=form.elements.accompanied.checked;
      const file=await createDocumentImage({title,body:form.elements.body.value.trim(),patient:selected,responsibleName,responsibleDocument,professional:professionalName,accompanied});
      const {patientToken}=await storeDocument({s,p,patientId:selected.id,patientName:selected.full_name,title,file,signersMode,signerName,email:selected.email,phone:selected.phone,accompanied,anamnesisId:anamnesisId||null});
      closeModal();
      if(patientToken)showPatientLink(patientToken,title,selected.full_name,selected.phone,selected.email);else toast('Documento preparado para assinatura profissional.');
      if(sendWhatsapp)openPreparedWhatsapp(documentWhatsappUrl({token:patientToken,phone:selected.phone,patientName:selected.social_name||selected.full_name,title,pageUrl:location.href}),whatsappWindow);
      refreshDocuments(1).catch(console.error);refreshPatientDocuments().catch(console.error);
    }catch(error){whatsappWindow?.close();feedback.textContent=error.message||'Não foi possível criar o documento.';}
    finally{delete form.dataset.saving;submitButtons.forEach(item=>item.disabled=false);updateContact();}
  };
}

function patientLink(token){ return documentSigningLink(token,location.href); }
function showPatientLink(token,title,patient,phone,email){
  const link=patientLink(token);
  const number=documentWhatsappNumber(phone),whatsappUrl=documentWhatsappUrl({token,phone,patientName:patient,title,pageUrl:location.href});
  const message=`Olá! A Alegrare disponibilizou um documento para sua leitura e assinatura. Acesse seu link individual: ${link}`;
  const encoded=encodeURIComponent(message);
  const m=modal(`
    <div class="real-modal-head"><div><small>LINK DO PACIENTE</small><h2>Documento pronto</h2><p>${esc(patient)} pode abrir e assinar sem acessar o painel.</p></div><button data-real-close>×</button></div>
    <div class="real-success"><b>${esc(title)}</b><label>Link de assinatura<div class="real-copy"><input readonly value="${esc(link)}"><button class="real-btn primary" id="real-copy-link">Copiar link</button></div></label><p>O arquivo permanece privado no Storage. O link libera acesso temporário somente após validar o token de assinatura.</p><p class="privacy-hint">Confira o destinatário antes de abrir o aplicativo de mensagens. Nenhuma mensagem é enviada automaticamente.</p><div class="consultation-actions">${whatsappUrl?`<a class="real-btn whatsapp" target="_blank" rel="noopener noreferrer" href="${esc(whatsappUrl)}">Enviar pelo WhatsApp</a><a class="real-btn ghost" href="sms:+${number}?body=${encoded}">Abrir SMS</a>`:'<p>Cadastre um telefone válido com DDD na ficha do paciente para enviar pelo WhatsApp.</p>'}${email?`<a class="real-btn ghost" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Documento Alegrare para assinatura')}&body=${encoded}">Abrir e-mail</a>`:''}</div></div>`);
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
  let query=supabase.from('documents').select('id,patient_id,title,patient_name,file_name,file_path,mime_type,status,created_at,patients(full_name,social_name,phone),document_signers(id,signer_type,signer_user_id,signer_name,signer_email,signer_phone,status,signing_token,signed_at,updated_at,metadata)',{count:'exact'}).eq('clinic_id',p.clinic_id);
  if(documentTerm.trim()){const pattern=searchPattern(documentTerm);const {data:patientMatches,error:patientError}=await supabase.from('patients').select('id').eq('clinic_id',p.clinic_id).or(`full_name.ilike.${pattern},social_name.ilike.${pattern},phone.ilike.${pattern}`).limit(500);if(patientError||patientMatches?.length===500){host.removeAttribute('aria-busy');if(feedback)feedback.textContent=patientError?'Não foi possível buscar os pacientes dos documentos.':'Há muitos pacientes correspondentes. Refine o nome ou telefone.';return;}const ids=safeIdList((patientMatches||[]).map(p=>p.id));query=query.or(`title.ilike.${pattern},patient_name.ilike.${pattern},file_name.ilike.${pattern}`+(ids.length?`,patient_id.in.(${ids.join(',')})`:''));}
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
    return `<article class="real-doc-row"><div class="real-doc-main"><span class="real-file-icon">${esc((doc.file_name||'Arquivo').split('.').pop().toUpperCase().slice(0,5))}</span><span><b>${esc(doc.title)}</b><small>${esc(doc.patient_name)} · ${esc(doc.file_name)}</small><em>${labels.join(' · ')}</em></span></div><div class="real-doc-actions">${documentWhatsappAction(doc)}<button class="real-btn ghost small" data-doc-open="${doc.id}">Original</button>${patient?.metadata?.signed_copy_path?`<button class="real-btn primary small" data-doc-signed="${doc.id}">Ver termo assinado</button>`:''}<button class="real-btn ghost small" data-doc-details="${doc.id}">Assinaturas</button>${professional?.status==='pending'&&professional.signer_user_id===p.id?`<button class="real-btn small" data-prof-sign="${professional.id}">Assinar</button>`:''}${patient?.status==='pending'?`<button class="real-btn ghost small" data-copy-token="${patient.signing_token}">Copiar link</button>`:''}<span class="real-status ${doc.status}">${doc.status==='signed'?'Assinado':'Pendente'}</span></div></article>`;
  }).join('')}${documentsPagination()}`;
  host.querySelectorAll('[data-doc-open]').forEach(b=>b.onclick=()=>openDocument(data.find(doc=>doc.id===b.dataset.docOpen)));
  host.querySelectorAll('[data-doc-signed]').forEach(b=>b.onclick=()=>openDocument(data.find(doc=>doc.id===b.dataset.docSigned),true));
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
    <div class="real-signature-status"><div><b>Paciente</b><span class="real-status ${signer?.status==='signed'?'signed':'pending'}">${signer?.status==='signed'?'Assinado':'Aguardando'}</span></div><div><b>Profissional</b><span class="real-status ${professional?.status==='signed'?'signed':'pending'}">${professional?.status==='signed'?'Assinado':professional?'Aguardando':'Não solicitada'}</span></div></div>
    <p><b>Assinatura do paciente:</b> ${signer?.signed_at?`${esc(signer.signer_name)} · ${esc(fmtDate(signer.signed_at))}`:'Pendente'}</p><p><b>Localidade declarada pelo paciente:</b> ${esc(meta.signer_location||'Não informada')}</p>
    <p><b>Assinatura profissional:</b> ${professional?.signed_at?esc(fmtDate(professional.signed_at)):(professional?'Pendente':'Não solicitada')}</p>
    <p class="privacy-hint">Envio e recebimento são confirmações manuais da equipe. A assinatura guarda aceite, data e dados técnicos de auditoria; localidade é declarada pelo paciente.</p>
    <div class="consultation-actions">${documentWhatsappAction(doc)}${meta.signed_copy_path?'<button class="real-btn primary" data-details-signed>Visualizar / baixar termo assinado</button>':''}<a class="real-btn ghost" href="${esc(email)}">Preparar e-mail para Danielle</a>${signer&&!meta.sent_at?'<button class="real-btn ghost" data-record-sent>Registrar envio do link</button>':''}${signer&&!meta.received_at?'<button class="real-btn ghost" data-record-received>Registrar recebimento informado</button>':''}</div><p role="status" data-delivery-feedback></p></div>`);
  m.querySelector('[data-details-signed]')?.addEventListener('click',()=>openDocument(doc,true));
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

async function openDocument(doc,signed=false){
 const m=modal(`<div class="real-modal-head"><h2>${esc(doc.title)}${signed?' · assinado':''}</h2><button data-real-close aria-label="Fechar">×</button></div><div id="real-file-preview"><p>Preparando acesso ao arquivo…</p></div>`);
 try{const signer=doc.document_signers?.find(x=>x.signer_type==='patient');const path=signed?signer?.metadata?.signed_copy_path:doc.file_path;if(!path)throw new Error('A cópia assinada ainda não está disponível.');const {data,error}=await supabase.storage.from('clinic-documents').createSignedUrl(path,300);if(error)throw error;if(!m.isConnected)return;const url=data.signedUrl,host=$('#real-file-preview',m);host.innerHTML=`<p>Paciente: ${esc(doc.patient_name)} · ${signed?'Cópia com assinatura':esc(doc.file_name)}</p><a class="real-btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir / baixar ${signed?'termo assinado':'arquivo original'}</a><p class="real-help">O acesso ao arquivo expira em cinco minutos.</p>${!signed&&(doc.mime_type||'').startsWith('image/')?`<img class="document-preview-image" src="${esc(url)}" alt="Documento">`:(signed||doc.mime_type==='application/pdf'||/\.pdf$/i.test(doc.file_name))?`<iframe class="document-preview-frame" src="${esc(url)}" title="Visualização do documento"></iframe>`:''}`;
 }catch(error){if(m.isConnected)$('#real-file-preview',m).textContent=error.message||'Não foi possível abrir o arquivo.';}
}

async function signProfessional(id){
  const s=await session(); if(!s){toast('Sua sessão expirou. Entre novamente.',true);return;}
  const p=await profile();const {data,error}=await supabase.from('document_signers').update({status:'signed',signed_at:new Date().toISOString(),signature_method:'authenticated_clinic_user'}).eq('clinic_id',p.clinic_id).eq('id',id).eq('signer_type','professional').eq('signer_user_id',s.user.id).eq('status','pending').select('id').maybeSingle();
  if(error||!data){toast(error?.message||'A assinatura mudou ou seu perfil não permite assinar. Atualize os documentos.',true);return;} toast('Assinatura profissional registrada.'); refreshDocuments();refreshPatientDocuments();
}

async function refreshPatientDocuments(){
  const host=$('#patient-documents');if(!host||host.dataset.loading==='true')return;
  const patientId=host.dataset.patientId;
  host.dataset.loading='true';host.textContent='Carregando documentos…';
  try{
    const p=await profile();if(!p?.clinic_id)throw new Error('Entre no painel para consultar documentos.');
    const {data,error}=await supabase.from('documents').select('id,patient_id,title,patient_name,file_name,file_path,mime_type,status,created_at,patients(full_name,social_name,phone),document_signers(id,signer_type,signer_user_id,signer_name,signer_email,status,signing_token,signed_at,updated_at,metadata)').eq('clinic_id',p.clinic_id).eq('patient_id',patientId).order('created_at',{ascending:false}).limit(30);
    if(error)throw error;if(!host.isConnected||host.dataset.patientId!==patientId)return;
    host.innerHTML=data?.length?data.map(doc=>{
      const patient=doc.document_signers?.find(s=>s.signer_type==='patient'),professional=doc.document_signers?.find(s=>s.signer_type==='professional');
      return `<article class="patient-document-row"><div><b>${esc(doc.title)}</b><small>${esc(fmtDate(doc.created_at))} · ${patient?`Paciente: ${patient.status==='signed'?'assinado':'aguardando'}`:'Sem assinatura do paciente'} · ${professional?`Profissional: ${professional.status==='signed'?'assinado':'aguardando'}`:'Profissional não solicitada'}</small></div><div class="consultation-actions">${documentWhatsappAction(doc)}<button type="button" class="real-btn ghost small" data-patient-document-details="${doc.id}">Assinaturas</button>${patient?.metadata?.signed_copy_path?`<button type="button" class="real-btn primary small" data-patient-document-signed="${doc.id}">Ver termo assinado</button>`:''}${patient?.status==='pending'?`<button type="button" class="real-btn ghost small" data-patient-document-link="${doc.id}">Copiar link</button>`:''}</div></article>`;
    }).join(''):'<p class="empty">Nenhum documento deste paciente.</p>';
    host.querySelectorAll('[data-patient-document-details]').forEach(button=>button.onclick=()=>openDocumentDetails(data.find(doc=>doc.id===button.dataset.patientDocumentDetails)));
    host.querySelectorAll('[data-patient-document-signed]').forEach(button=>button.onclick=()=>openDocument(data.find(doc=>doc.id===button.dataset.patientDocumentSigned),true));
    host.querySelectorAll('[data-patient-document-link]').forEach(button=>button.onclick=async()=>{const signer=data.find(doc=>doc.id===button.dataset.patientDocumentLink)?.document_signers?.find(s=>s.signer_type==='patient');if(!signer)return;try{await navigator.clipboard.writeText(patientLink(signer.signing_token));toast('Link individual copiado.');}catch{toast('Não foi possível copiar o link.',true);}});
  }catch(error){if(host.isConnected)host.textContent=error.message||'Não foi possível carregar documentos.';}
  finally{if(host.isConnected)host.dataset.loading='false';}
}

function injectPatientDocuments(){
  const host=$('#patient-documents');if(!host||host.dataset.bound==='true')return;
  host.dataset.bound='true';
  $('[data-patient-doc-refresh]')?.addEventListener('click',refreshPatientDocuments);
  $('[data-patient-create-document]')?.addEventListener('click',()=>openCreateDocument({patientId:host.dataset.patientId}));
  refreshPatientDocuments();
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
      card.innerHTML='<div class="real-section-head"><div><small>ASSINATURAS</small><h2>Documentos enviados</h2><p>Um lugar para acompanhar profissional e paciente.</p></div><button class="real-btn primary" data-create-document>Criar termo no painel</button></div><div class="record-search-tools"><label>Buscar documento<input id="real-document-search" type="search" autocomplete="off" placeholder="Nome, nome social, telefone ou título"></label><label>Situação<select id="real-document-status"><option value="">Todas</option><option value="signed">Assinados</option><option value="pending">Pendentes</option></select></label></div><p id="real-document-feedback" class="search-feedback" role="status"></p><div id="real-documents-list"><div class="real-loading">Carregando...</div></div>';
      content.appendChild(card);$('#real-document-search').value=documentTerm;$('#real-document-status').value=documentStatus;$('#real-document-search').oninput=e=>{documentTerm=e.target.value;documentPage=1;documentSequence++;clearTimeout(documentSearchTimer);documentSearchTimer=setTimeout(()=>refreshDocuments(1),250);};$('#real-document-status').onchange=e=>{documentStatus=e.target.value;documentPage=1;refreshDocuments(1);};refreshDocuments();
      $('[data-create-document]',card).onclick=()=>openCreateDocument();
    }
  }finally{injecting=false;}
}

function isPatientRoute(){ return /^#\/assinar\/[0-9a-f-]{36}$/i.test(location.hash); }
function tokenFromRoute(){ return location.hash.split('/')[2] || ''; }

function bindSignatureCanvas(form){
  const canvas=$('[data-signature-canvas]',form),ctx=canvas.getContext('2d');
  if(!ctx)return ()=>'';
  ctx.strokeStyle='#193746';ctx.lineWidth=3.5;ctx.lineCap='round';ctx.lineJoin='round';
  let drawing=false,hasInk=false;
  const point=e=>{const box=canvas.getBoundingClientRect();return {x:(e.clientX-box.left)*canvas.width/box.width,y:(e.clientY-box.top)*canvas.height/box.height};};
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();const p=point(e);drawing=true;hasInk=true;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
  for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drawing=false;});
  $('[data-clear-signature]',form).addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;});
  return ()=>hasInk?canvas.toDataURL('image/png'):'';
}

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
    host.innerHTML=`<div class="patient-sign-head"><small>DOCUMENTO PARA ASSINATURA</small><h1>${esc(data.document.title)}</h1><p>Paciente: <b>${esc(data.document.patientName)}</b></p>${data.signer.accompanied?'<p>Preenchimento da anamnese realizado com acompanhamento da profissional.</p>':''}<div class="real-signature-status"><div><b>Paciente</b><span class="real-status ${already?'signed':'pending'}">${already?'Assinado':'Aguardando'}</span></div>${data.professional?`<div><b>Profissional</b><span class="real-status ${data.professional.status==='signed'?'signed':'pending'}">${data.professional.status==='signed'?'Assinado':'Aguardando'}</span></div>`:''}</div></div>${viewer}${already?`<div class="patient-signed-ok">✓ Assinatura registrada em ${esc(fmtDate(data.signer.signedAt))}${data.signer.location?` · ${esc(data.signer.location)}`:''}</div>${data.document.signedCopy?`<a class="real-btn primary patient-download" target="_blank" rel="noopener noreferrer" href="${esc(data.document.url)}">Baixar documento assinado</a>`:''}`:`<form id="patient-sign-form" class="real-form patient-form"><label>Assinatura do paciente · nome completo<input name="name" value="${esc(data.signer.name)}" required minlength="3"></label><label>Localidade declarada (cidade/UF, opcional)<input name="location" maxlength="120" placeholder="Ex.: Rio de Janeiro/RJ"></label><div class="patient-signature-field"><b>Desenhe sua assinatura</b><canvas data-signature-canvas width="900" height="240" aria-label="Área para desenhar assinatura com o dedo, mouse ou caneta"></canvas><button type="button" class="real-btn ghost" data-clear-signature>Limpar assinatura</button></div><label class="patient-consent"><input type="checkbox" name="accepted" required><span>Li o documento apresentado e concordo com seu conteúdo.</span></label><button class="real-btn primary patient-submit">Assinar e devolver à Alegrare</button><p class="real-help">Sua assinatura aparecerá na cópia final em PDF, disponível para você e para a clínica. O aceite registra data, navegador e informações técnicas de auditoria; não representa certificado ICP-Brasil.</p></form>`}`;
    const getSignature=$('#patient-sign-form',host)?bindSignatureCanvas($('#patient-sign-form',host)):null;
    $('#patient-sign-form',host)?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget, signature=getSignature?.();if(!signature){toast('Desenhe sua assinatura antes de concluir.',true);return;}const btn=$('.patient-submit',form); btn.disabled=true;btn.textContent='Registrando...';
      try{
        const r=await fetch(SIGN_FUNCTION,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify({token:tokenFromRoute(),signerName:form.elements.name.value,location:form.elements.location.value,accepted:form.elements.accepted.checked,signature})}); const result=await r.json();
        if(!r.ok) throw new Error(result.error||'Falha ao assinar.');
        host.innerHTML=`<div class="patient-complete"><span>✓</span><h1>Documento assinado</h1><p>O termo com a sua assinatura foi devolvido à clínica em ${esc(fmtDate(result.signedAt))}.</p>${result.signedUrl?`<a class="real-btn primary patient-download" target="_blank" rel="noopener noreferrer" href="${esc(result.signedUrl)}">Visualizar / baixar termo assinado</a>`:''}<small>Você já pode fechar esta página.</small></div>`;
      }catch(err){toast(err.message,true);btn.disabled=false;btn.textContent='Assinar documento';}
    });
  }catch(err){host.innerHTML=`<div class="patient-complete error"><span>!</span><h1>Link indisponível</h1><p>${esc(err.message)}</p></div>`;}
  return true;
}

const observer=new MutationObserver(()=>{ if(isPatientRoute()) renderPatientSigning(); else {patientRenderToken=null;injectClinicUI();injectPatientDocuments();} });
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(()=>{ if(isPatientRoute()) renderPatientSigning(); else injectClinicUI(); },0));
window.addEventListener('alegrare:rendered',()=>{injectClinicUI();injectPatientDocuments();});
window.addEventListener('alegrare:upload-document',openUpload);
window.addEventListener('alegrare:create-anamnesis-document',e=>openCreateDocument(e.detail||{}));
supabase.auth.onAuthStateChange(()=>{cachedProfile=null;setTimeout(refreshDocuments,0);});
if(!(await renderPatientSigning())){injectClinicUI();injectPatientDocuments();}

