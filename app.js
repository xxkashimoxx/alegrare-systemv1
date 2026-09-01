// Painel Alegrare — versão enxuta
const STORE = 'alegrare:simple-v2';

const medications = [
  { id: 'MED-0001', name: 'Amoxicilina', active: 'amoxicilina' },
  { id: 'MED-0002', name: 'Azitromicina', active: 'azitromicina' },
  { id: 'MED-0003', name: 'Ibuprofeno', active: 'ibuprofeno' },
  { id: 'MED-0004', name: 'Paracetamol', active: 'paracetamol' },
  { id: 'MED-0005', name: 'Dipirona', active: 'dipirona monoidratada' },
  { id: 'MED-0006', name: 'Clorexidina', active: 'digluconato de clorexidina' },
  { id: 'MED-0007', name: 'Metronidazol', active: 'metronidazol' },
  { id: 'MED-0008', name: 'Dexametasona', active: 'dexametasona' }
];

const seed = {
  patients: [
    { id:'p1', name:'Camila Nogueira', phone:'(21) 99854-3012', last:'76 dias', treatment:'Clareamento', status:'Sem retorno', potential:1850 },
    { id:'p2', name:'Roberto Silva', phone:'(21) 99104-7820', last:'43 dias', treatment:'Implante', status:'Faltou e não reagendou', potential:2400 },
    { id:'p3', name:'Luana Costa', phone:'(21) 99771-5421', last:'21 dias', treatment:'Facetas em resina', status:'Orçamento pendente', potential:3200 },
    { id:'p4', name:'Marcos Vinicius', phone:'(21) 99202-1056', last:'97 dias', treatment:'Reabilitação oral', status:'Tratamento interrompido', potential:5800 },
    { id:'p5', name:'Ana Paula Rocha', phone:'(21) 99612-0041', last:'188 dias', treatment:'Limpeza preventiva', status:'Retorno vencido', potential:450 }
  ],
  opportunities: [
    { id:'o1', patientId:'p4', reason:'Tratamento interrompido', value:5800, priority:'Alta', status:'Aberta' },
    { id:'o2', patientId:'p3', reason:'Orçamento pendente', value:3200, priority:'Alta', status:'Aberta' },
    { id:'o3', patientId:'p2', reason:'Falta sem reagendamento', value:2400, priority:'Alta', status:'Aberta' },
    { id:'o4', patientId:'p1', reason:'Sem retorno há mais de 60 dias', value:1850, priority:'Média', status:'Aberta' },
    { id:'o5', patientId:'p5', reason:'Retorno preventivo vencido', value:450, priority:'Média', status:'Aberta' }
  ],
  prescriptions: [
    { id:'r1', patientId:'p2', title:'Orientações pós-implante', meds:['Amoxicilina'], status:'Assinada', signer:'Dra. Danielle' },
    { id:'r2', patientId:'p1', title:'Orientações de clareamento', meds:[], status:'Aguardando assinatura', signer:null }
  ],
  documents: [
    { id:'d1', patientId:'p2', name:'termo-implante.pdf', signerScope:'Paciente', status:'Aguardando paciente' }
  ],
  timeline: {
    p1:[['28/08/2026','Mensagem de retorno preparada'],['16/06/2026','Sessão de clareamento realizada'],['02/06/2026','Avaliação inicial']],
    p2:[['19/08/2026','Paciente não compareceu'],['19/07/2026','Procedimento de implante realizado'],['19/07/2026','Orientações assinadas']],
    p3:[['22/08/2026','Orçamento enviado'],['10/08/2026','Avaliação estética']],
    p4:[['26/05/2026','Tratamento interrompido'],['12/05/2026','Planejamento aprovado']],
    p5:[['24/02/2026','Limpeza concluída'],['24/02/2026','Retorno recomendado em 6 meses']]
  }
};

let state = load();
let route = location.hash.replace('#/','') || 'home';
let modal = null;
let selectedMeds = [];

function load(){
  try { return Object.assign(structuredClone(seed), JSON.parse(localStorage.getItem(STORE) || '{}')); }
  catch { return structuredClone(seed); }
}
function save(){ localStorage.setItem(STORE, JSON.stringify(state)); }
function patient(id){ return state.patients.find(p=>p.id===id); }
function money(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function openOpp(){ return state.opportunities.filter(o=>o.status!=='Recuperada'); }
function potential(){ return openOpp().reduce((s,o)=>s+o.value,0); }

const nav = [
  ['home','Início'],
  ['patients','Pacientes'],
  ['prescriptions','Prescrições e documentos'],
  ['opportunities','Oportunidades'],
  ['recovery','Recuperação']
];

function shell(body){
  return `<div class="shell">
    <aside class="sidebar">
      <button class="brand" data-route="home"><span>A</span><div><strong>Alegrare</strong><small>ODONTOLOGIA ESPECIAL</small></div></button>
      <nav>${nav.map(([r,l])=>`<button class="nav ${route===r?'active':''}" data-route="${r}">${l}${r==='opportunities'?`<i>${openOpp().length}</i>`:''}</button>`).join('')}</nav>
      <div class="side-note"><b>Versão simplificada</b><small>Menos telas. Ações mais claras.</small></div>
    </aside>
    <main>
      <header class="top"><div><span>Alegrare</span><b>${nav.find(n=>n[0]===route)?.[1] || 'Início'}</b></div><button class="avatar">DD</button></header>
      <div class="content">${body}</div>
    </main>
  </div>${modal ? renderModal() : ''}<div id="toast"></div>`;
}

function pageHead(title, sub, action=''){
  return `<section class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${action}</section>`;
}

function home(){
  const attention = [...openOpp()].sort((a,b)=>b.value-a.value).slice(0,3);
  return `${pageHead('Bom dia, Danielle.','Hoje o painel mostra só o que precisa de atenção.','<button class="primary" data-action="new-rx">Nova prescrição</button>')}
  <section class="metrics">
    <button data-route="opportunities"><small>Oportunidades abertas</small><strong>${openOpp().length}</strong><span>Ver pacientes que precisam de ação</span></button>
    <button data-route="opportunities"><small>Valor potencial</small><strong>${money(potential())}</strong><span>Associado aos retornos em aberto</span></button>
    <button data-route="prescriptions"><small>Assinaturas pendentes</small><strong>${state.prescriptions.filter(r=>r.status!=='Assinada').length + state.documents.filter(d=>d.status!=='Assinado').length}</strong><span>Profissional ou paciente</span></button>
  </section>
  <section class="card">
    <div class="card-title"><div><h2>Precisa da sua atenção</h2><p>Três ações prioritárias. Sem excesso de informação.</p></div><button class="link" data-route="opportunities">Ver todas</button></div>
    <div class="attention-list">${attention.map(o=>{const p=patient(o.patientId);return `<div class="attention-row"><span class="avatar soft">${initials(p.name)}</span><div><b>${esc(p.name)}</b><small>${esc(o.reason)}</small></div><strong>${money(o.value)}</strong><button class="secondary" data-action="recover" data-id="${o.id}">Recuperar paciente</button></div>`}).join('')}</div>
  </section>`;
}

function patients(){
  return `${pageHead('Pacientes','Abra um paciente para ver apenas o histórico que importa.')}
  <section class="card patient-list">${state.patients.map(p=>`<button class="patient-row" data-action="open-patient" data-id="${p.id}"><span class="avatar soft">${initials(p.name)}</span><div><b>${esc(p.name)}</b><small>${esc(p.treatment)} · última visita: ${p.last}</small></div><span class="status">${esc(p.status)}</span><i>›</i></button>`).join('')}</section>`;
}

function prescriptions(){
  return `${pageHead('Prescrições e documentos','Crie uma prescrição ou envie um arquivo para assinatura.','<div class="head-actions"><button class="secondary" data-action="upload-doc">Enviar documento</button><button class="primary" data-action="new-rx">Nova prescrição</button></div>')}
  <div class="grid2">
    <section class="card"><div class="card-title"><div><h2>Prescrições</h2><p>Medicamentos identificados enquanto você digita.</p></div></div>
      <div class="simple-list">${state.prescriptions.map(r=>{const p=patient(r.patientId);return `<div class="simple-row"><div><b>${esc(r.title)}</b><small>${esc(p.name)}${r.meds?.length?' · '+r.meds.map(esc).join(', '):''}</small></div><span class="status">${esc(r.status)}</span>${r.status!=='Assinada'?`<button class="secondary" data-action="sign-rx" data-id="${r.id}">Assinar</button>`:''}</div>`}).join('')}</div>
    </section>
    <section class="card"><div class="card-title"><div><h2>Documentos enviados</h2><p>O signatário pode ser a profissional, o paciente ou ambos.</p></div></div>
      <div class="simple-list">${state.documents.length?state.documents.map(d=>{const p=patient(d.patientId);return `<div class="simple-row"><div><b>${esc(d.name)}</b><small>${esc(p.name)} · assinatura: ${esc(d.signerScope)}</small></div><span class="status">${esc(d.status)}</span>${d.status!=='Assinado'?`<button class="secondary" data-action="advance-doc" data-id="${d.id}">Registrar assinatura</button>`:''}</div>`}).join(''):'<p class="empty">Nenhum documento enviado.</p>'}</div>
    </section>
  </div>`;
}

function opportunities(){
  return `${pageHead('Oportunidades','Uma lista simples: paciente, motivo, valor e ação.')}
  <section class="card"><div class="opp-list">${openOpp().sort((a,b)=>b.value-a.value).map(o=>{const p=patient(o.patientId);return `<div class="opp-row"><div class="opp-main"><span class="avatar soft">${initials(p.name)}</span><div><b>${esc(p.name)}</b><small>${esc(o.reason)}</small></div></div><strong>${money(o.value)}</strong><span class="priority ${o.priority==='Alta'?'high':''}">${o.priority}</span><button class="primary" data-action="recover" data-id="${o.id}">Recuperar paciente</button></div>`}).join('')}</div></section>`;
}

function recovery(){
  const rows = openOpp().filter(o=>o.status==='Em contato' || o.status==='Aberta');
  return `${pageHead('Recuperação','Acompanhe somente quem precisa voltar para a agenda.')}
  <section class="card"><div class="recovery-list">${rows.map(o=>{const p=patient(o.patientId);return `<div class="opp-row"><div class="opp-main"><span class="avatar soft">${initials(p.name)}</span><div><b>${esc(p.name)}</b><small>${esc(o.reason)}</small></div></div><span class="status">${esc(o.status)}</span><button class="secondary" data-action="mark-contact" data-id="${o.id}">Registrar contato</button><button class="primary" data-action="mark-recovered" data-id="${o.id}">Marcar como recuperado</button></div>`}).join('')}</div></section>`;
}

function patientModal(id){
  const p=patient(id); const history=state.timeline[id]||[];
  return `<div class="modal-card wide"><div class="modal-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.treatment)} · ${esc(p.phone)}</p></div><button data-action="close">×</button></div>
    <div class="patient-summary"><div><small>Status</small><b>${esc(p.status)}</b></div><div><small>Última visita</small><b>${p.last}</b></div><div><small>Valor relacionado</small><b>${money(p.potential)}</b></div></div>
    <h3>Histórico do paciente</h3><div class="timeline">${history.map(h=>`<div><i></i><span><small>${h[0]}</small><b>${esc(h[1])}</b></span></div>`).join('')}</div>
    <div class="modal-actions"><button class="secondary" data-action="close">Fechar</button><button class="primary" data-action="new-rx-for" data-id="${p.id}">Criar prescrição</button></div>
  </div>`;
}

function rxModal(patientId=''){
  const opts=state.patients.map(p=>`<option value="${p.id}" ${p.id===patientId?'selected':''}>${esc(p.name)}</option>`).join('');
  return `<div class="modal-card"><div class="modal-head"><div><h2>Nova prescrição</h2><p>Digite o medicamento. O sistema identifica as opções a partir das primeiras letras.</p></div><button data-action="close">×</button></div>
    <label>Paciente<select id="rx-patient"><option value="">Selecione</option>${opts}</select></label>
    <label>Título<input id="rx-title" placeholder="Ex.: Orientações pós-procedimento"></label>
    <div class="med-field"><label>Medicamento<input id="med-search" autocomplete="off" placeholder="Digite ao menos 2 letras"></label><div id="med-suggestions" class="suggestions"></div></div>
    <div id="selected-meds" class="selected-meds">${renderSelectedMeds()}</div>
    <label>Orientações<textarea id="rx-notes" rows="4" placeholder="Escreva as orientações da prescrição"></textarea></label>
    <div class="modal-actions"><button class="secondary" data-action="close">Cancelar</button><button class="primary" data-action="save-rx">Salvar prescrição</button></div>
  </div>`;
}

function uploadModal(){
  return `<div class="modal-card"><div class="modal-head"><div><h2>Enviar documento</h2><p>Escolha o arquivo e quem precisa assinar.</p></div><button data-action="close">×</button></div>
    <label>Paciente<select id="doc-patient"><option value="">Selecione</option>${state.patients.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
    <label>Arquivo<input id="doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"></label>
    <label>Quem precisa assinar?<select id="doc-signer"><option value="Profissional">Profissional</option><option value="Paciente">Paciente</option><option value="Profissional e paciente">Profissional e paciente</option></select></label>
    <div class="info-box">O arquivo ficará vinculado ao paciente e com status de assinatura visível nesta tela.</div>
    <div class="modal-actions"><button class="secondary" data-action="close">Cancelar</button><button class="primary" data-action="save-doc">Enviar documento</button></div>
  </div>`;
}

function renderSelectedMeds(){
  if(!selectedMeds.length) return '<small>Nenhum medicamento adicionado.</small>';
  return selectedMeds.map(m=>`<span><b>${esc(m.name)}</b><small>${m.id}</small><button data-action="remove-med" data-id="${m.id}">×</button></span>`).join('');
}

function renderModal(){
  let body='';
  if(modal?.type==='patient') body=patientModal(modal.id);
  if(modal?.type==='rx') body=rxModal(modal.patientId||'');
  if(modal?.type==='upload') body=uploadModal();
  return `<div class="modal-backdrop"><div>${body}</div></div>`;
}

function render(){
  const pages={home,patients,prescriptions,opportunities,recovery};
  document.querySelector('#app').innerHTML = shell((pages[route]||home)());
  bindDynamic();
}

function toast(msg){ const t=document.querySelector('#toast'); if(!t)return; t.textContent=msg; t.className='show'; setTimeout(()=>t.className='',2200); }

function bindDynamic(){
  document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>{location.hash='#/'+el.dataset.route;});
  document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>handle(el.dataset.action,el.dataset.id));
  const search=document.querySelector('#med-search');
  if(search) search.oninput=()=>showMedSuggestions(search.value);
}

function showMedSuggestions(term){
  const box=document.querySelector('#med-suggestions'); if(!box)return;
  const q=term.trim().toLowerCase();
  if(q.length<2){ box.innerHTML=''; box.classList.remove('open'); return; }
  const found=medications.filter(m=>m.name.toLowerCase().startsWith(q)||m.active.toLowerCase().startsWith(q)).slice(0,6);
  box.innerHTML=found.length?found.map(m=>`<button data-med-id="${m.id}"><b>${esc(m.name)}</b><small>${m.id} · ${esc(m.active)}</small></button>`).join(''):'<div class="no-result">Nenhum medicamento encontrado.</div>';
  box.classList.add('open');
  box.querySelectorAll('[data-med-id]').forEach(btn=>btn.onclick=()=>{
    const med=medications.find(m=>m.id===btn.dataset.medId);
    if(!selectedMeds.some(m=>m.id===med.id)) selectedMeds.push(med);
    document.querySelector('#selected-meds').innerHTML=renderSelectedMeds();
    document.querySelector('#med-search').value=''; box.innerHTML=''; box.classList.remove('open');
    bindDynamic();
  });
}

function handle(action,id){
  if(action==='close'){ modal=null; selectedMeds=[]; render(); return; }
  if(action==='open-patient'){ modal={type:'patient',id}; render(); return; }
  if(action==='new-rx'){ selectedMeds=[]; modal={type:'rx'}; render(); return; }
  if(action==='new-rx-for'){ selectedMeds=[]; modal={type:'rx',patientId:id}; render(); return; }
  if(action==='upload-doc'){ modal={type:'upload'}; render(); return; }
  if(action==='remove-med'){ selectedMeds=selectedMeds.filter(m=>m.id!==id); document.querySelector('#selected-meds').innerHTML=renderSelectedMeds(); bindDynamic(); return; }
  if(action==='save-rx'){
    const patientId=document.querySelector('#rx-patient').value;
    const title=document.querySelector('#rx-title').value.trim();
    if(!patientId||!title){ toast('Selecione o paciente e informe um título.'); return; }
    state.prescriptions.unshift({id:'r'+Date.now(),patientId,title,meds:selectedMeds.map(m=>m.name),status:'Aguardando assinatura',signer:null});
    state.timeline[patientId]=state.timeline[patientId]||[];
    state.timeline[patientId].unshift(['Hoje','Prescrição criada']);
    save(); modal=null; selectedMeds=[]; route='prescriptions'; location.hash='#/prescriptions'; render(); toast('Prescrição criada.'); return;
  }
  if(action==='save-doc'){
    const patientId=document.querySelector('#doc-patient').value;
    const file=document.querySelector('#doc-file').files[0];
    const signerScope=document.querySelector('#doc-signer').value;
    if(!patientId||!file){ toast('Selecione o paciente e o arquivo.'); return; }
    let status=signerScope==='Paciente'?'Aguardando paciente':signerScope==='Profissional'?'Aguardando profissional':'Aguardando ambos';
    state.documents.unshift({id:'d'+Date.now(),patientId,name:file.name,signerScope,status});
    state.timeline[patientId]=state.timeline[patientId]||[];
    state.timeline[patientId].unshift(['Hoje',`Documento enviado: ${file.name}`]);
    save(); modal=null; render(); toast('Documento vinculado ao paciente.'); return;
  }
  if(action==='sign-rx'){
    const r=state.prescriptions.find(x=>x.id===id); if(r){r.status='Assinada';r.signer='Dra. Danielle';save();render();toast('Assinatura registrada.');} return;
  }
  if(action==='advance-doc'){
    const d=state.documents.find(x=>x.id===id); if(d){d.status='Assinado';save();render();toast('Assinatura registrada no documento.');} return;
  }
  if(action==='recover'){
    const o=state.opportunities.find(x=>x.id===id); if(o){o.status='Em contato';save();route='recovery';location.hash='#/recovery';render();toast('Paciente adicionado à recuperação.');} return;
  }
  if(action==='mark-contact'){
    const o=state.opportunities.find(x=>x.id===id); if(o){o.status='Em contato';save();render();toast('Contato registrado.');} return;
  }
  if(action==='mark-recovered'){
    const o=state.opportunities.find(x=>x.id===id); if(o){o.status='Recuperada';const p=patient(o.patientId);if(p)p.status='Reagendado';save();render();toast('Paciente marcado como recuperado.');} return;
  }
}

window.addEventListener('hashchange',()=>{route=location.hash.replace('#/','')||'home';modal=null;selectedMeds=[];render();});
render();
