import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = 'https://efythbvsdbxrsibvkhmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_w1r0-1gnUHKZ2_55YGMWPQ_V7ARypeB';
const STORE = 'alegrare:simple-v2';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

window.alegrareSupabase = supabase;

let profile = null;
let currentUser = null;
let serverState = null;
let syncing = false;
let pendingDocument = null;
let pendingPrescriptionNotes = '';
const originalSetItem = Storage.prototype.setItem;

const statusMaps = {
  opportunity: {
    open: 'Aberta', contacting: 'Em contato', scheduled: 'Agendada', recovered: 'Recuperada', lost: 'Perdida', archived: 'Arquivada'
  },
  opportunityBack: {
    'Aberta': 'open', 'Em contato': 'contacting', 'Agendada': 'scheduled', 'Recuperada': 'recovered', 'Perdida': 'lost', 'Arquivada': 'archived'
  },
  priority: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  prescription: { draft: 'Rascunho', pending_signature: 'Aguardando assinatura', signed: 'Assinada', cancelled: 'Cancelada' },
  prescriptionBack: { 'Rascunho': 'draft', 'Aguardando assinatura': 'pending_signature', 'Assinada': 'signed', 'Cancelada': 'cancelled' },
  document: {
    uploaded: 'Enviado', waiting_professional: 'Aguardando profissional', waiting_patient: 'Aguardando paciente',
    waiting_both: 'Aguardando ambos', signed: 'Assinado', cancelled: 'Cancelado'
  },
  documentBack: {
    'Enviado': 'uploaded', 'Aguardando profissional': 'waiting_professional', 'Aguardando paciente': 'waiting_patient',
    'Aguardando ambos': 'waiting_both', 'Assinado': 'signed', 'Cancelado': 'cancelled'
  },
  signerScope: { professional: 'Profissional', patient: 'Paciente', both: 'Profissional e paciente' },
  signerScopeBack: { 'Profissional': 'professional', 'Paciente': 'patient', 'Profissional e paciente': 'both' }
};

const categoryReason = {
  no_return: 'Sem retorno há mais de 60 dias', no_show: 'Falta sem reagendamento', cancelled: 'Consulta cancelada',
  treatment_interrupted: 'Tratamento interrompido', budget_pending: 'Orçamento pendente', cleaning_due: 'Retorno preventivo vencido', other: 'Acompanhamento necessário'
};

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function lastVisitLabel(value) {
  if (!value) return 'sem registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem registro';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return days === 0 ? 'hoje' : `${days} dias`;
}

function dateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

function patientStatus(value) {
  const map = { active: 'Ativo', inactive: 'Inativo', archived: 'Arquivado', lead: 'Lead' };
  return map[value] || value || 'Ativo';
}

async function getProfile() {
  const { data, error } = await supabase.from('profiles').select('clinic_id, full_name, role').eq('id', currentUser.id).single();
  if (error) throw error;
  profile = data;
  return data;
}

async function loadRealState() {
  const [patientsR, oppR, rxR, rxItemsR, docsR, timelineR] = await Promise.all([
    supabase.from('patients').select('id,full_name,phone,last_visit_at,current_treatment,status,potential_value').order('full_name').limit(5000),
    supabase.from('opportunities').select('id,patient_id,category,priority,potential_value,status,recommended_action').order('potential_value', { ascending: false }).limit(5000),
    supabase.from('prescriptions').select('id,patient_id,title,status').order('created_at', { ascending: false }).limit(5000),
    supabase.from('prescription_items').select('prescription_id,medication_name,position').order('position').limit(10000),
    supabase.from('patient_documents').select('id,patient_id,file_name,signer_scope,status').order('created_at', { ascending: false }).limit(5000),
    supabase.from('patient_timeline').select('patient_id,title,description,occurred_at').order('occurred_at', { ascending: false }).limit(15000)
  ]);

  const failures = [patientsR, oppR, rxR, rxItemsR, docsR, timelineR].filter(r => r.error);
  if (failures.length) throw failures[0].error;

  const medsByRx = new Map();
  for (const item of rxItemsR.data || []) {
    const list = medsByRx.get(item.prescription_id) || [];
    list.push(item.medication_name);
    medsByRx.set(item.prescription_id, list);
  }

  const timeline = {};
  for (const item of timelineR.data || []) {
    timeline[item.patient_id] ||= [];
    timeline[item.patient_id].push([dateLabel(item.occurred_at), item.description || item.title]);
  }

  return {
    patients: (patientsR.data || []).map(p => ({
      id: p.id,
      name: p.full_name,
      phone: p.phone || '',
      last: lastVisitLabel(p.last_visit_at),
      treatment: p.current_treatment || 'Sem tratamento ativo',
      status: patientStatus(p.status),
      potential: Number(p.potential_value || 0)
    })),
    opportunities: (oppR.data || []).map(o => ({
      id: o.id,
      patientId: o.patient_id,
      reason: o.recommended_action || categoryReason[o.category] || categoryReason.other,
      value: Number(o.potential_value || 0),
      priority: statusMaps.priority[o.priority] || 'Média',
      status: statusMaps.opportunity[o.status] || 'Aberta'
    })),
    prescriptions: (rxR.data || []).map(r => ({
      id: r.id,
      patientId: r.patient_id,
      title: r.title,
      meds: medsByRx.get(r.id) || [],
      status: statusMaps.prescription[r.status] || 'Rascunho',
      signer: r.status === 'signed' ? (profile?.full_name || 'Profissional') : null
    })),
    documents: (docsR.data || []).map(d => ({
      id: d.id,
      patientId: d.patient_id,
      name: d.file_name,
      signerScope: statusMaps.signerScope[d.signer_scope] || 'Paciente',
      status: statusMaps.document[d.status] || 'Enviado'
    })),
    timeline
  };
}

async function refreshLocalState() {
  const state = await loadRealState();
  serverState = structuredClone(state);
  originalSetItem.call(localStorage, STORE, JSON.stringify(state));
  return state;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

async function syncOpportunityChanges(next) {
  const previous = new Map((serverState?.opportunities || []).map(o => [o.id, o]));
  for (const item of next.opportunities || []) {
    if (!isUuid(item.id)) continue;
    const old = previous.get(item.id);
    if (!old || old.status === item.status) continue;
    const dbStatus = statusMaps.opportunityBack[item.status];
    if (!dbStatus) continue;
    const { error } = await supabase.from('opportunities').update({ status: dbStatus, last_action_at: new Date().toISOString() }).eq('id', item.id);
    if (error) throw error;
    await supabase.from('patient_timeline').insert({
      clinic_id: profile.clinic_id,
      patient_id: item.patientId,
      event_type: 'recovery',
      title: item.status === 'Recuperada' ? 'Paciente recuperado' : 'Contato de recuperação',
      description: item.reason,
      created_by: currentUser.id
    });
  }
}

async function syncNewPrescriptions(next) {
  const pending = (next.prescriptions || []).filter(r => !isUuid(r.id));
  for (const rx of pending) {
    const { data, error } = await supabase.from('prescriptions').insert({
      clinic_id: profile.clinic_id,
      patient_id: rx.patientId,
      title: rx.title,
      body: pendingPrescriptionNotes || '',
      status: statusMaps.prescriptionBack[rx.status] || 'pending_signature',
      author_id: currentUser.id
    }).select('id').single();
    if (error) throw error;
    if (rx.meds?.length) {
      const rows = rx.meds.map((name, position) => ({
        clinic_id: profile.clinic_id,
        prescription_id: data.id,
        medication_name: name,
        position
      }));
      const itemsResult = await supabase.from('prescription_items').insert(rows);
      if (itemsResult.error) throw itemsResult.error;
    }
    await supabase.from('patient_timeline').insert({
      clinic_id: profile.clinic_id,
      patient_id: rx.patientId,
      event_type: 'prescription',
      title: 'Prescrição criada',
      description: rx.title,
      created_by: currentUser.id
    });
  }
  pendingPrescriptionNotes = '';
}

async function syncPrescriptionStatus(next) {
  const previous = new Map((serverState?.prescriptions || []).map(r => [r.id, r]));
  for (const rx of next.prescriptions || []) {
    if (!isUuid(rx.id)) continue;
    const old = previous.get(rx.id);
    if (!old || old.status === rx.status) continue;
    const dbStatus = statusMaps.prescriptionBack[rx.status];
    if (!dbStatus) continue;
    const { error } = await supabase.from('prescriptions').update({ status: dbStatus }).eq('id', rx.id);
    if (error) throw error;
  }
}

function safeFileName(name) {
  return String(name || 'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

async function syncNewDocuments(next) {
  const pending = (next.documents || []).filter(d => !isUuid(d.id));
  for (const doc of pending) {
    if (!pendingDocument || pendingDocument.patientId !== doc.patientId || pendingDocument.file.name !== doc.name) continue;
    const filePath = `${profile.clinic_id}/${doc.patientId}/${crypto.randomUUID()}-${safeFileName(doc.name)}`;
    const upload = await supabase.storage.from('clinic-documents').upload(filePath, pendingDocument.file, { upsert: false, contentType: pendingDocument.file.type || undefined });
    if (upload.error) throw upload.error;
    const inserted = await supabase.from('patient_documents').insert({
      clinic_id: profile.clinic_id,
      patient_id: doc.patientId,
      file_name: doc.name,
      storage_path: filePath,
      mime_type: pendingDocument.file.type || null,
      document_type: 'uploaded_document',
      signer_scope: statusMaps.signerScopeBack[doc.signerScope] || 'patient',
      status: statusMaps.documentBack[doc.status] || 'uploaded',
      created_by: currentUser.id
    });
    if (inserted.error) throw inserted.error;
    await supabase.from('patient_timeline').insert({
      clinic_id: profile.clinic_id,
      patient_id: doc.patientId,
      event_type: 'document',
      title: 'Documento enviado',
      description: doc.name,
      created_by: currentUser.id
    });
  }
  pendingDocument = null;
}

async function syncState(next) {
  if (syncing || !profile || !currentUser || !serverState) return;
  syncing = true;
  try {
    await syncOpportunityChanges(next);
    await syncNewPrescriptions(next);
    await syncPrescriptionStatus(next);
    await syncNewDocuments(next);
    serverState = await loadRealState();
  } catch (error) {
    console.error('[Alegrare/Supabase] Falha ao sincronizar:', error);
  } finally {
    syncing = false;
  }
}

Storage.prototype.setItem = function(key, value) {
  originalSetItem.call(this, key, value);
  if (this === localStorage && key === STORE && !syncing) {
    try { void syncState(JSON.parse(value)); } catch (error) { console.error(error); }
  }
};

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'save-doc') {
    const file = document.querySelector('#doc-file')?.files?.[0];
    const patientId = document.querySelector('#doc-patient')?.value;
    if (file && patientId) pendingDocument = { file, patientId };
  }
  if (action === 'save-rx') {
    pendingPrescriptionNotes = document.querySelector('#rx-notes')?.value?.trim() || '';
  }
}, true);

function renderLogin(message = '') {
  document.querySelector('#app').innerHTML = `
    <style>
      body{margin:0;background:#f5f8fa;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#153044}
      .auth-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.auth-card{width:min(420px,100%);background:white;border:1px solid #e4ebef;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(20,50,70,.08)}
      .auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.auth-mark{width:44px;height:44px;border-radius:14px;background:#2680b3;color:white;display:grid;place-items:center;font-weight:800;font-size:22px}.auth-brand strong{display:block;font-size:20px}.auth-brand small{color:#748995}
      .auth-card h1{font-size:25px;margin:0 0 6px}.auth-card p{color:#6c818d;margin:0 0 22px}.auth-card label{display:block;font-size:13px;font-weight:700;margin:14px 0 7px}.auth-card input{box-sizing:border-box;width:100%;padding:13px 14px;border:1px solid #d9e3e8;border-radius:12px;font:inherit}.auth-card button{width:100%;border:0;border-radius:12px;background:#2680b3;color:#fff;padding:14px;margin-top:20px;font:inherit;font-weight:800;cursor:pointer}.auth-error{margin-top:14px!important;color:#b42318!important;font-size:13px}.auth-status{font-size:13px;color:#6c818d;margin-top:12px}
    </style>
    <div class="auth-wrap"><form class="auth-card" id="login-form">
      <div class="auth-brand"><span class="auth-mark">A</span><div><strong>Alegrare</strong><small>Gestão clínica</small></div></div>
      <h1>Acesso ao painel</h1><p>Entre com a conta autorizada da clínica.</p>
      <label for="auth-email">E-mail</label><input id="auth-email" type="email" autocomplete="username" value="daniellecoelho@alegrare.com" required>
      <label for="auth-password">Senha</label><input id="auth-password" type="password" autocomplete="current-password" required>
      <button type="submit">Entrar</button>${message ? `<p class="auth-error">${escapeHtml(message)}</p>` : ''}
    </form></div>`;

  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true; button.textContent = 'Entrando…';
    const email = document.querySelector('#auth-email').value.trim();
    const password = document.querySelector('#auth-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { renderLogin('E-mail ou senha inválidos.'); return; }
    location.reload();
  });
}

async function boot() {
  const sessionResult = await supabase.auth.getSession();
  currentUser = sessionResult.data.session?.user || null;
  if (!currentUser) { renderLogin(); return; }

  document.querySelector('#app').innerHTML = '<div style="padding:40px;font-family:system-ui;color:#607580">Carregando dados da clínica…</div>';
  try {
    await getProfile();
    if (!profile?.clinic_id) throw new Error('Usuário sem clínica vinculada.');
    await refreshLocalState();
    await import('/app.js');
    await import('/document-signing.js');
    document.addEventListener('click', async event => {
      if (event.target.closest('.avatar')) {
        await supabase.auth.signOut();
        location.reload();
      }
    }, true);
  } catch (error) {
    console.error(error);
    renderLogin('Não foi possível carregar os dados da clínica.');
  }
}

void boot();
