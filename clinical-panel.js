import {supabase} from './supabase-client.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const permanent = [1,2,3,4].flatMap(q => Array.from({length:8},(_,i) => `${q}${i+1}`));
const deciduous = [5,6,7,8].flatMap(q => Array.from({length:5},(_,i) => `${q}${i+1}`));
const teeth = [...permanent,...deciduous];
const toothLabel = code => `${code} · ${permanent.includes(code)?'permanente':deciduous.includes(code)?'decíduo':'outra identificação'}`;
const date = value => value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data';

// The same clinical source is read by the patient record and the finance panel.
export class ClinicalPanel {
  constructor({clinicId, patient, profile}) { Object.assign(this,{clinicId,patient,profile}); this.sequence=0; this.disposed=false; this.selectedTooth='11'; }
  mount(host) {
    this.host=host;
    host.innerHTML='<p role="status">Carregando prontuário…</p><div data-clinical-content></div>';
    this.load();
  }
  async load() {
    const seq=++this.sequence;
    const calls=[
      supabase.from('patient_anamneses').select('id,anamnesis_date,notes,answers,is_current,updated_at,template_description,source_payload').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).order('anamnesis_date',{ascending:false,nullsFirst:false}).limit(30),
      supabase.from('anamnesis_questions').select('id,question,required,sequence,source_payload,template_description,template_expertise,template_type').eq('clinic_id',this.clinicId).order('sequence',{ascending:true,nullsFirst:false}).limit(300),
      supabase.from('clinical_records').select('id,title,content,external_source,external_id,updated_at').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('external_source','alegrare_odontogram').order('updated_at',{ascending:false}).limit(100),
      supabase.from('treatment_plans').select('id,title,status,total_amount,source_payload,updated_at').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).order('created_at',{ascending:false}).limit(100),
      supabase.from('clinical_records').select('id,title,content,external_source,created_at').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('external_source','alegrare_specialty').order('created_at',{ascending:false}).limit(50),
      supabase.from('appointments').select('id,starts_at,procedure_name,notes,status').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).ilike('notes','%[Ocorrência clínica]%').order('starts_at',{ascending:false}).limit(30)
    ];
    const results=await Promise.all(calls);
    if(this.disposed||seq!==this.sequence)return;
    const failure=results.find(r=>r.error);
    if(failure){this.host.querySelector('[role=status]').textContent=`Falha ao carregar dados clínicos: ${failure.error.message}`;return;}
    [this.anamneses,this.questions,this.records,this.plans,this.specialties,this.occurrences]=results.map(r=>r.data||[]);
    this.paint();
  }
  paint() {
    const current=this.anamneses.find(a=>a.is_current)||this.anamneses[0];
    const custom=this.questions.filter(q=>q.source_payload?.alegrare_internal_parameter===true);
    const dental=this.records.filter(r=>r.external_source==='alegrare_odontogram');
    const customTeeth=dental.filter(r=>!teeth.includes(r.external_id));
    const selected=dental.find(r=>r.external_id===this.selectedTooth);
    let entry={};try{entry=selected?JSON.parse(selected.content):{};}catch{entry={note:selected?.content||''};}
    const host=this.host.querySelector('[data-clinical-content]');
    this.host.querySelector('[role=status]').textContent='Dados clínicos da clínica. Alterações são gravadas diretamente no Supabase.';
    host.innerHTML=`<section class="clinical-section"><h3>Anamnese e observações internas</h3><p>${current?`Registro de ${date(current.anamnesis_date)} · ${esc(current.template_description||'Anamnese geral')}`:'Nenhuma anamnese importada para este paciente.'}</p>
      ${current?`<form data-anamnesis class="data-form"><label>Observações internas sobre saúde e continuidade do cuidado<textarea name="notes" rows="4" placeholder="Alergias, medicações, condições, alertas e acompanhamento, conforme avaliação profissional">${esc(current.notes||'')}</textarea></label>${custom.map(q=>`<label>${esc(q.question)}<input data-internal-question="${q.id}" value="${esc(current.source_payload?.alegrare_internal_fields?.[q.id]||'')}" ${q.required?'required':''}></label>`).join('')}<p class="privacy-hint">Uso interno da equipe autorizada. Estes campos não integram mensagens nem links para o paciente.</p><button class="secondary">Salvar observações</button></form>`:'<p>Registre a anamnese clínica antes de editar observações vinculadas a ela.</p>'}
      <details><summary>Ver respostas da anamnese</summary><pre class="clinical-answers">${esc(current?JSON.stringify(current.answers,null,2):'Sem respostas')}</pre></details>
      ${current?.answers?.length?'<button type="button" class="secondary" data-anamnesis-document>Preparar anamnese para assinatura</button>':''}
      <h4>Parâmetros internos da clínica</h4><ul>${custom.map(q=>`<li>${esc(q.question)}${q.required?' · obrigatório':''}</li>`).join('')||'<li>Nenhum parâmetro adicional.</li>'}</ul>
      ${['owner','dentist'].includes(this.profile.role)?`<form data-parameter class="data-form form-grid"><label>Novo parâmetro para futuras anamneses<input name="question" required maxlength="200" placeholder="Ex.: condição que interfere no atendimento"></label><label><input type="checkbox" name="required"> Obrigatório</label><button class="secondary">Adicionar parâmetro</button></form>`:'<p>A profissional responsável pode acrescentar parâmetros.</p>'}</section>
      <section class="clinical-section"><h3>Atendimento clínico geral</h3><p>Registre uma ficha de especialidade como no quadro de referência. Cada criação vira um evento datado no prontuário.</p>
      <form data-specialty class="data-form"><label>Ficha de especialidade<select name="template" required><option value="">Selecione uma ficha de especialidade…</option><option value="Atendimento clínico geral">Atendimento clínico geral</option>${[...new Set(this.questions.map(q=>q.template_description).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label><label>Descrição da avaliação, ocorrência e conduta<textarea name="description" rows="4" required maxlength="4000" placeholder="Descreva a avaliação e a conduta de forma clara"></textarea></label><button class="primary">Criar ficha</button></form>
      <div class="clinical-history">${this.specialties.map(s=>`<article><b>${esc(s.title)} · ${date(s.created_at)}</b><p>${esc(s.content)}</p></article>`).join('')||'<p>Nenhuma ficha criada no painel.</p>'}</div>
      <h4>Ocorrências que impediram atendimento</h4><div class="clinical-history">${this.occurrences.map(a=>`<article><b>${date(a.starts_at)} · ${esc(a.procedure_name||'Consulta')} · ${esc(a.status)}</b><p>${esc(a.notes)}</p></article>`).join('')||'<p>Nenhuma ocorrência registrada.</p>'}</div></section>
      <section class="clinical-section"><h3>Odontograma</h3><p>Selecione qualquer dente permanente ou decíduo, descreva face, condição, procedimento e evolução. O registro mantém a identificação FDI.</p>
      <h4>Dentição permanente</h4><div class="tooth-grid">${permanent.map(code=>this.toothButton(code,dental)).join('')}</div><h4>Dentição decídua</h4><div class="tooth-grid">${deciduous.map(code=>this.toothButton(code,dental)).join('')}</div>
      ${customTeeth.length?`<h4>Outras classificações</h4><div class="tooth-grid">${customTeeth.map(r=>this.toothButton(r.external_id,dental)).join('')}</div>`:''}
      <form data-custom-tooth class="data-form form-grid"><label>Adicionar outra identificação de dente<input name="code" maxlength="30" required pattern="[A-Za-z0-9_-]{2,30}" placeholder="Ex.: SUP-11"></label><button class="secondary">Selecionar identificação</button></form>
      <form data-tooth class="data-form"><h4>Dente ${esc(this.selectedTooth)}</h4><div class="form-grid"><label>Classificação<select name="classification"><option value="permanente">Permanente</option><option value="decíduo">Dente de leite</option><option value="implante">Implante</option><option value="pôntico">Pôntico</option><option value="supranumerário">Supranumerário</option><option value="ausente">Ausente</option><option value="outra">Outra</option></select></label><label>Substitui / relacionado a<input name="replaces" maxlength="30" value="${esc(entry.replaces||'')}" placeholder="Ex.: 51 substituído por 11"></label><label>Face / região<input name="surface" maxlength="100" value="${esc(entry.surface||'')}" placeholder="Oclusal, mesial, vestibular, raiz…"></label><label>Condição / procedimento<input name="condition" maxlength="160" value="${esc(entry.condition||'')}" placeholder="Descreva livremente"></label></div><label>Detalhes e evolução<textarea name="note" rows="3">${esc(entry.note||'')}</textarea></label><button class="primary">Salvar dente ${esc(this.selectedTooth)}</button></form></section>
      <section class="clinical-section"><h3>Orçamentos e reflexo no financeiro</h3><p>As observações abaixo são lidas diretamente pelo Financeiro, sem criar cobrança ou duplicar lançamento.</p>${this.plans.map(p=>`<form class="data-form plan-observation" data-plan="${p.id}"><b>${esc(p.title)} · ${Number(p.total_amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · ${esc(p.status)}</b><label>Observação do orçamento<textarea name="observation" rows="2">${esc(p.source_payload?.alegrare_finance_observation||'')}</textarea></label><button class="secondary">Salvar no orçamento e financeiro</button></form>`).join('')||'<p>Nenhum orçamento encontrado.</p>'}</section><p class="clinical-feedback" role="status"></p>`;
    host.querySelectorAll('[data-tooth-code]').forEach(b=>b.onclick=()=>{this.selectedTooth=b.dataset.toothCode;this.paint();});
    host.querySelector('[data-tooth] select[name=classification]').value=entry.classification||(Number(this.selectedTooth[0])>=5&&Number(this.selectedTooth[0])<=8?'decíduo':'permanente');
    host.querySelector('[data-custom-tooth]').addEventListener('submit',e=>{e.preventDefault();this.selectedTooth=e.currentTarget.elements.code.value.trim().toUpperCase();this.paint();});
    host.querySelector('[data-specialty]').addEventListener('submit',e=>this.saveSpecialty(e));
    host.querySelector('[data-anamnesis]')?.addEventListener('submit',e=>this.saveAnamnesis(e,current));
    host.querySelector('[data-anamnesis-document]')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('alegrare:create-anamnesis-document',{detail:{patientId:this.patient.id,anamnesisId:current.id}})));
    host.querySelector('[data-parameter]')?.addEventListener('submit',e=>this.addParameter(e));
    host.querySelector('[data-tooth]').addEventListener('submit',e=>this.saveTooth(e,selected));
    host.querySelectorAll('[data-plan]').forEach(f=>f.addEventListener('submit',e=>this.savePlan(e,this.plans.find(p=>p.id===f.dataset.plan))));
  }
  toothButton(code,records){return `<button type="button" class="tooth ${code===this.selectedTooth?'active':''} ${records.some(r=>r.external_id===code)?'recorded':''}" data-tooth-code="${esc(code)}" aria-label="Dente ${esc(toothLabel(code))}">${esc(code)}</button>`;}
  async run(form,job){const button=form.querySelector('button[type=submit],button:not([type])');const feedback=this.host.querySelector('.clinical-feedback');button.disabled=true;feedback.textContent='Salvando no banco…';try{await job();feedback.textContent='Salvo no prontuário.';await this.load();}catch(error){feedback.textContent=error.message||'Não foi possível salvar.';}finally{button.disabled=false;}}
  saveAnamnesis(event,current){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const notes=form.elements.notes.value.trim()||null;const fields={...(current.source_payload?.alegrare_internal_fields||{})};form.querySelectorAll('[data-internal-question]').forEach(input=>{fields[input.dataset.internalQuestion]=input.value.trim();});const source_payload={...(current.source_payload||{}),alegrare_internal_fields:fields};const {data,error}=await supabase.from('patient_anamneses').update({notes,source_payload}).eq('id',current.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',current.updated_at).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('A anamnese mudou em outra sessão. Recarregue para revisar antes de salvar.');});}
  addParameter(event){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const question=form.elements.question.value.trim();if(!question)throw new Error('Descreva o parâmetro.');const {error}=await supabase.from('anamnesis_questions').insert({clinic_id:this.clinicId,question,question_type:'text',template_type:'general',required:form.elements.required.checked,sequence:Math.max(0,...this.questions.map(q=>q.sequence||0))+1,source_payload:{alegrare_internal_parameter:true}});if(error)throw error;});}
  saveTooth(event,existing){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const content=JSON.stringify({classification:form.elements.classification.value,replaces:form.elements.replaces.value.trim(),surface:form.elements.surface.value.trim(),condition:form.elements.condition.value.trim(),note:form.elements.note.value.trim()});if(!form.elements.condition.value.trim()&&!form.elements.note.value.trim())throw new Error('Preencha uma condição ou uma observação.');let q;if(existing)q=supabase.from('clinical_records').update({content}).eq('id',existing.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',existing.updated_at);else q=supabase.from('clinical_records').insert({clinic_id:this.clinicId,patient_id:this.patient.id,record_type:'observation',title:`Odontograma · ${this.selectedTooth}`,content,external_source:'alegrare_odontogram',external_id:this.selectedTooth,created_by:this.profile.id});const {data,error}=await q.select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('O dente foi alterado em outra sessão. Recarregue antes de salvar.');});}
  saveSpecialty(event){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const template=form.elements.template.value,description=form.elements.description.value.trim();if(!template||!description)throw new Error('Escolha uma ficha e escreva a descrição.');const {error}=await supabase.from('clinical_records').insert({clinic_id:this.clinicId,patient_id:this.patient.id,record_type:'evolution',title:`Ficha de especialidade · ${template}`,content:description,external_source:'alegrare_specialty',created_by:this.profile.id});if(error)throw error;});}
  savePlan(event,plan){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const source_payload={...(plan.source_payload||{}),alegrare_finance_observation:form.elements.observation.value.trim()};const {data,error}=await supabase.from('treatment_plans').update({source_payload}).eq('id',plan.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',plan.updated_at).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('O orçamento mudou em outra sessão. Recarregue antes de salvar.');});}
  destroy(){this.disposed=true;this.sequence++;}
}
