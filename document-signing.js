import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase-client.js';

const SIGN_FUNCTION = `${SUPABASE_URL}/functions/v1/patient-document-sign`;

const $ = (s, root = document) => root.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeFile = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-');
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(iso)) : '';

let cachedProfile = null;
let injecting = false;
const DOCUMENT_PAGE_SIZE = 12;
let documentPage = 1;
let documentTotal = 0;

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
    const result=await supabase.from('patients').select('id,full_name').eq('clinic_id',currentProfile.clinic_id).order('full_name');
    if(result.error){toast('Não foi possível carregar os pacientes.',true);return;}
    const patients=result.data||[];
    if(!patients.length){toast('Cadastre um paciente antes de enviar um documento.',true);return;}
    const m=modal(`
      <div class="real-modal-head"><div><small>DOCUMENTO</small><h2>Enviar para assinatura</h2><p>Um fluxo só: escolha o arquivo, o paciente e quem precisa assinar.</p></div><button data-real-close>×</button></div>
      <form id="real-upload-form" class="real-form">
        <label>Paciente<select name="patient" required><option value="">Selecione</option>${patients.map(p=>`<option value="${p.id}" data-name="${esc(p.full_name)}">${esc(p.full_name)}</option>`).join('')}</select></label>
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
    form.addEventListener('submit',uploadDocument);
}

async function uploadDocument(e){
  e.preventDefault();
  const form=e.currentTarget, btn=$('#real-upload-submit',form), fd=new FormData(form);
  const file=form.elements.file.files?.[0];
  if(!file) return;
  if(file.size>20*1024*1024){toast('Arquivo maior que 20 MB.',true);return;}
  btn.disabled=true; btn.textContent='Enviando...';
  let path=null, docId=crypto.randomUUID();
  try{
    const s=await session(); const p=await profile(); if(!s||!p?.clinic_id) throw new Error('Sessão da clínica não encontrada.');
    const patientId=String(fd.get('patient')); const patientName=form.elements.patient.selectedOptions[0]?.dataset.name||''; const title=String(fd.get('title')).trim(); const signersMode=String(fd.get('signers'));
    path=`${p.clinic_id}/${docId}/${safeFile(file.name)}`;
    const uploaded=await supabase.storage.from('clinic-documents').upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(uploaded.error) throw uploaded.error;
    const inserted=await supabase.from('documents').insert({id:docId,clinic_id:p.clinic_id,patient_id:patientId,patient_name:patientName,title,file_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size,uploaded_by:s.user.id}).select('id').single();
    if(inserted.error) throw inserted.error;
    const signers=[]; let patientToken=null;
    if(signersMode==='professional'||signersMode==='both') signers.push({clinic_id:p.clinic_id,document_id:docId,signer_type:'professional',signer_user_id:s.user.id,signer_name:p.full_name||'Dra. Danielle'});
    if(signersMode==='patient'||signersMode==='both'){
      patientToken=crypto.randomUUID();
      signers.push({clinic_id:p.clinic_id,document_id:docId,signer_type:'patient',signer_name:String(fd.get('patientSignerName')||patientName).trim()||patientName,signing_token:patientToken});
    }
    const sIns=await supabase.from('document_signers').insert(signers); if(sIns.error) throw sIns.error;
    closeModal(); await refreshDocuments(1);
    if(patientToken) showPatientLink(patientToken,title,patientName); else toast('Documento enviado para assinatura profissional.');
  }catch(err){
    console.error(err);
    if(path) await supabase.storage.from('clinic-documents').remove([path]).catch(()=>{});
    await supabase.from('documents').delete().eq('id',docId).catch(()=>{});
    toast(err?.message||'Falha ao enviar documento.',true);
  }finally{btn.disabled=false;btn.textContent='Enviar documento';}
}

function patientLink(token){ return `${location.origin}${location.pathname}#/assinar/${token}`; }
function showPatientLink(token,title,patient){
  const link=patientLink(token);
  const m=modal(`
    <div class="real-modal-head"><div><small>LINK DO PACIENTE</small><h2>Documento pronto</h2><p>${esc(patient)} pode abrir e assinar sem acessar o painel.</p></div><button data-real-close>×</button></div>
    <div class="real-success"><b>${esc(title)}</b><label>Link de assinatura<div class="real-copy"><input readonly value="${esc(link)}"><button class="real-btn primary" id="real-copy-link">Copiar link</button></div></label><p>O arquivo permanece privado no Storage. O link libera acesso temporário somente após validar o token de assinatura.</p></div>`);
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
  const s=await session();
  if(!s){host.innerHTML='<div class="real-empty"><p>Entre no painel para ver os documentos.</p></div>';return;}
  const p=await profile();
  const from=(page-1)*DOCUMENT_PAGE_SIZE,to=from+DOCUMENT_PAGE_SIZE-1;
  const {data,error,count}=await supabase.from('documents').select('id,title,patient_name,file_name,status,created_at,document_signers(id,signer_type,signer_name,status,signing_token,signed_at)',{count:'exact'}).eq('clinic_id',p.clinic_id).order('created_at',{ascending:false}).range(from,to);
  if(error){host.innerHTML='<div class="real-empty"><p>Não foi possível carregar os documentos.</p></div>';return;}
  documentTotal=count||0;
  const pages=Math.max(1,Math.ceil(documentTotal/DOCUMENT_PAGE_SIZE));
  documentPage=Math.min(Math.max(1,page),pages);
  if(!data?.length){host.innerHTML='<div class="real-empty"><b>Nenhum documento enviado</b><p>Use “Enviar documento” para começar.</p></div>';return;}
  host.innerHTML=`${data.map(doc=>{
    const patient=doc.document_signers?.find(x=>x.signer_type==='patient');
    const professional=doc.document_signers?.find(x=>x.signer_type==='professional');
    const labels=[]; if(professional) labels.push(`Profissional: ${professional.status==='signed'?'assinado':'pendente'}`); if(patient) labels.push(`Paciente: ${patient.status==='signed'?'assinado':'pendente'}`);
    return `<article class="real-doc-row"><div class="real-doc-main"><span class="real-file-icon">PDF</span><span><b>${esc(doc.title)}</b><small>${esc(doc.patient_name)} · ${esc(doc.file_name)}</small><em>${labels.join(' · ')}</em></span></div><div class="real-doc-actions">${professional?.status==='pending'?`<button class="real-btn small" data-prof-sign="${professional.id}">Assinar</button>`:''}${patient?.status==='pending'?`<button class="real-btn ghost small" data-copy-token="${patient.signing_token}">Copiar link</button>`:''}<span class="real-status ${doc.status}">${doc.status==='signed'?'Assinado':'Pendente'}</span></div></article>`;
  }).join('')}${documentsPagination()}`;
  host.querySelectorAll('[data-prof-sign]').forEach(b=>b.addEventListener('click',()=>signProfessional(b.dataset.profSign)));
  host.querySelectorAll('[data-copy-token]').forEach(b=>b.addEventListener('click',async()=>{await navigator.clipboard.writeText(patientLink(b.dataset.copyToken));toast('Link do paciente copiado.');}));
  host.querySelectorAll('[data-doc-page]').forEach(b=>b.addEventListener('click',()=>refreshDocuments(Number(b.dataset.docPage))));
}

async function signProfessional(id){
  const s=await session(); if(!s){toast('Sua sessão expirou. Entre novamente.',true);return;}
  const {error}=await supabase.from('document_signers').update({status:'signed',signed_at:new Date().toISOString(),signature_method:'authenticated_clinic_user'}).eq('id',id).eq('status','pending');
  if(error){toast(error.message,true);return;} toast('Assinatura profissional registrada.'); refreshDocuments();
}

async function injectClinicUI(){
  if(injecting || isPatientRoute()) return;
  const content=$('.content'); if(!content) return;
  const isDocs=location.hash.includes('prescriptions') || /Prescriç|Documentos/i.test(content.textContent||'');
  if(!isDocs) return;
  injecting=true;
  try{
    if(!$('#real-documents-card')){
      const card=document.createElement('section'); card.id='real-documents-card'; card.className='card real-documents-card';
      card.innerHTML='<div class="real-section-head"><div><small>ASSINATURAS</small><h2>Documentos enviados</h2><p>Um lugar para acompanhar profissional e paciente.</p></div></div><div id="real-documents-list"><div class="real-loading">Carregando...</div></div>';
      content.appendChild(card); refreshDocuments();
    }
  }finally{injecting=false;}
}

function isPatientRoute(){ return /^#\/assinar\/[0-9a-f-]{36}$/i.test(location.hash); }
function tokenFromRoute(){ return location.hash.split('/')[2] || ''; }

async function renderPatientSigning(){
  if(!isPatientRoute()) return false;
  const app=$('#app'); if(!app) return true;
  app.innerHTML=`<main class="patient-sign-page"><section class="patient-sign-shell"><div class="sign-brand"><span>A</span><div><b>Alegrare</b><small>ODONTOLOGIA ESPECIAL</small></div></div><div id="patient-sign-content" class="patient-sign-card"><p>Carregando documento...</p></div></section></main>`;
  const host=$('#patient-sign-content');
  try{
    const res=await fetch(`${SIGN_FUNCTION}?token=${encodeURIComponent(tokenFromRoute())}`,{headers:{apikey:SUPABASE_KEY}}); const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Link inválido.');
    const already=data.signer.status==='signed';
    const viewer=(data.document.mimeType||'').startsWith('image/')?`<img class="patient-document-image" src="${esc(data.document.url)}" alt="Documento">`:`<iframe class="patient-document-view" src="${esc(data.document.url)}" title="Documento"></iframe>`;
    host.innerHTML=`<div class="patient-sign-head"><small>DOCUMENTO PARA ASSINATURA</small><h1>${esc(data.document.title)}</h1><p>Paciente: <b>${esc(data.document.patientName)}</b></p></div>${viewer}${already?`<div class="patient-signed-ok">✓ Assinatura registrada em ${esc(fmtDate(data.signer.signedAt))}</div>`:`<form id="patient-sign-form" class="real-form patient-form"><label>Nome completo<input name="name" value="${esc(data.signer.name)}" required minlength="3"></label><label class="patient-consent"><input type="checkbox" name="accepted" required><span>Li o documento apresentado e concordo com seu conteúdo.</span></label><button class="real-btn primary patient-submit">Assinar documento</button><p class="real-help">Este fluxo registra aceite eletrônico, data, navegador e informações técnicas de auditoria. Não representa certificado ICP-Brasil.</p></form>`}`;
    $('#patient-sign-form',host)?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=e.currentTarget, btn=$('.patient-submit',form); btn.disabled=true;btn.textContent='Registrando...';
      try{
        const r=await fetch(SIGN_FUNCTION,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify({token:tokenFromRoute(),signerName:form.elements.name.value,accepted:form.elements.accepted.checked})}); const result=await r.json();
        if(!r.ok) throw new Error(result.error||'Falha ao assinar.');
        host.innerHTML=`<div class="patient-complete"><span>✓</span><h1>Documento assinado</h1><p>O aceite foi registrado em ${esc(fmtDate(result.signedAt))}.</p><small>Você já pode fechar esta página.</small></div>`;
      }catch(err){toast(err.message,true);btn.disabled=false;btn.textContent='Assinar documento';}
    });
  }catch(err){host.innerHTML=`<div class="patient-complete error"><span>!</span><h1>Link indisponível</h1><p>${esc(err.message)}</p></div>`;}
  return true;
}

const observer=new MutationObserver(()=>{ if(isPatientRoute()) renderPatientSigning(); else injectClinicUI(); });
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(()=>{ if(isPatientRoute()) renderPatientSigning(); else injectClinicUI(); },0));
window.addEventListener('alegrare:rendered',injectClinicUI);
window.addEventListener('alegrare:upload-document',openUpload);
supabase.auth.onAuthStateChange(()=>{cachedProfile=null;setTimeout(refreshDocuments,0);});
if(!(await renderPatientSigning())) injectClinicUI();
