import {supabase} from './supabase-client.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const permanent = [1,2,3,4].flatMap(q => Array.from({length:8},(_,i) => `${q}${i+1}`));
const deciduous = [5,6,7,8].flatMap(q => Array.from({length:5},(_,i) => `${q}${i+1}`));
const teeth = [...permanent,...deciduous];
const toothLabel = code => `${code} · ${Number(code[0]) < 5 ? 'permanente' : 'decíduo'}`;
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
      supabase.from('anamnesis_questions').select('id,question,required,sequence,source_payload').eq('clinic_id',this.clinicId).order('sequence',{ascending:true,nullsFirst:false}).limit(300),
      supabase.from('clinical_records').select('id,title,content,external_source,external_id,updated_at').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('external_source','alegrare_odontogram').order('updated_at',{ascending:false}).limit(100),
      supabase.from('treatment_plans').select('id,title,status,total_amount,source_payload,updated_at').eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).order('created_at',{ascending:false}).limit(100)
    ];
    const results=await Promise.all(calls);
    if(this.disposed||seq!==this.sequence)return;
    const failure=results.find(r=>r.error);
    if(failure){this.host.querySelector('[role=status]').textContent=`Falha ao carregar dados clínicos: ${failure.error.message}`;return;}
    [this.anamneses,this.questions,this.records,this.plans]=results.map(r=>r.data||[]);
    this.paint();
  }
  paint() {
    const current=this.anamneses.find(a=>a.is_current)||this.anamneses[0];
    const custom=this.questions.filter(q=>q.source_payload?.alegrare_internal_parameter===true);
    const dental=this.records.filter(r=>r.external_source==='alegrare_odontogram'&&teeth.includes(r.external_id));
    const selected=dental.find(r=>r.external_id===this.selectedTooth);
    let entry={};try{entry=selected?JSON.parse(selected.content):{};}catch{entry={note:selected?.content||''};}
    const host=this.host.querySelector('[data-clinical-content]');
    this.host.querySelector('[role=status]').textContent='Dados clínicos da clínica. Alterações são gravadas diretamente no Supabase.';
    host.innerHTML=`<section class="clinical-section"><h3>Anamnese e observações internas</h3><p>${current?`Registro de ${date(current.anamnesis_date)} · ${esc(current.template_description||'Anamnese geral')}`:'Nenhuma anamnese importada para este paciente.'}</p>
      ${current?`<form data-anamnesis class="data-form"><label>Observações internas sobre saúde e continuidade do cuidado<textarea name="notes" rows="4" placeholder="Alergias, medicações, condições, alertas e acompanhamento, conforme avaliação profissional">${esc(current.notes||'')}</textarea></label>${custom.map(q=>`<label>${esc(q.question)}<input data-internal-question="${q.id}" value="${esc(current.source_payload?.alegrare_internal_fields?.[q.id]||'')}" ${q.required?'required':''}></label>`).join('')}<p class="privacy-hint">Uso interno da equipe autorizada. Estes campos não integram mensagens nem links para o paciente.</p><button class="secondary">Salvar observações</button></form>`:'<p>Registre a anamnese clínica antes de editar observações vinculadas a ela.</p>'}
      <details><summary>Ver respostas da anamnese</summary><pre class="clinical-answers">${esc(current?JSON.stringify(current.answers,null,2):'Sem respostas')}</pre></details>
      <h4>Parâmetros internos da clínica</h4><ul>${custom.map(q=>`<li>${esc(q.question)}${q.required?' · obrigatório':''}</li>`).join('')||'<li>Nenhum parâmetro adicional.</li>'}</ul>
      ${['owner','dentist'].includes(this.profile.role)?`<form data-parameter class="data-form form-grid"><label>Novo parâmetro para futuras anamneses<input name="question" required maxlength="200" placeholder="Ex.: condição que interfere no atendimento"></label><label><input type="checkbox" name="required"> Obrigatório</label><button class="secondary">Adicionar parâmetro</button></form>`:'<p>A profissional responsável pode acrescentar parâmetros.</p>'}</section>
      <section class="clinical-section"><h3>Odontograma</h3><p>Selecione qualquer dente permanente ou decíduo, descreva face, condição, procedimento e evolução. O registro mantém a identificação FDI.</p>
      <h4>Dentição permanente</h4><div class="tooth-grid">${permanent.map(code=>this.toothButton(code,dental)).join('')}</div><h4>Dentição decídua</h4><div class="tooth-grid">${deciduous.map(code=>this.toothButton(code,dental)).join('')}</div>
      <form data-tooth class="data-form"><h4>Dente ${toothLabel(this.selectedTooth)}</h4><div class="form-grid"><label>Face / região<input name="surface" maxlength="100" value="${esc(entry.surface||'')}" placeholder="Oclusal, mesial, vestibular, raiz…"></label><label>Condição / procedimento<input name="condition" maxlength="160" value="${esc(entry.condition||'')}" placeholder="Descreva livremente"></label></div><label>Detalhes e evolução<textarea name="note" rows="3">${esc(entry.note||'')}</textarea></label><button class="primary">Salvar dente ${this.selectedTooth}</button></form></section>
      <section class="clinical-section"><h3>Orçamentos e reflexo no financeiro</h3><p>As observações abaixo são lidas diretamente pelo Financeiro, sem criar cobrança ou duplicar lançamento.</p>${this.plans.map(p=>`<form class="data-form plan-observation" data-plan="${p.id}"><b>${esc(p.title)} · ${Number(p.total_amount||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · ${esc(p.status)}</b><label>Observação do orçamento<textarea name="observation" rows="2">${esc(p.source_payload?.alegrare_finance_observation||'')}</textarea></label><button class="secondary">Salvar no orçamento e financeiro</button></form>`).join('')||'<p>Nenhum orçamento encontrado.</p>'}</section><p class="clinical-feedback" role="status"></p>`;
    host.querySelectorAll('[data-tooth-code]').forEach(b=>b.onclick=()=>{this.selectedTooth=b.dataset.toothCode;this.paint();});
    host.querySelector('[data-anamnesis]')?.addEventListener('submit',e=>this.saveAnamnesis(e,current));
    host.querySelector('[data-parameter]')?.addEventListener('submit',e=>this.addParameter(e));
    host.querySelector('[data-tooth]').addEventListener('submit',e=>this.saveTooth(e,selected));
    host.querySelectorAll('[data-plan]').forEach(f=>f.addEventListener('submit',e=>this.savePlan(e,this.plans.find(p=>p.id===f.dataset.plan))));
  }
  toothButton(code,records){return `<button type="button" class="tooth ${code===this.selectedTooth?'active':''} ${records.some(r=>r.external_id===code)?'recorded':''}" data-tooth-code="${code}" aria-label="Dente ${toothLabel(code)}">${code}</button>`;}
  async run(form,job){const button=form.querySelector('button[type=submit],button:not([type])');const feedback=this.host.querySelector('.clinical-feedback');button.disabled=true;feedback.textContent='Salvando no banco…';try{await job();feedback.textContent='Salvo no prontuário.';await this.load();}catch(error){feedback.textContent=error.message||'Não foi possível salvar.';}finally{button.disabled=false;}}
  saveAnamnesis(event,current){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const notes=form.elements.notes.value.trim()||null;const fields={...(current.source_payload?.alegrare_internal_fields||{})};form.querySelectorAll('[data-internal-question]').forEach(input=>{fields[input.dataset.internalQuestion]=input.value.trim();});const source_payload={...(current.source_payload||{}),alegrare_internal_fields:fields};const {data,error}=await supabase.from('patient_anamneses').update({notes,source_payload}).eq('id',current.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',current.updated_at).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('A anamnese mudou em outra sessão. Recarregue para revisar antes de salvar.');});}
  addParameter(event){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const question=form.elements.question.value.trim();if(!question)throw new Error('Descreva o parâmetro.');const {error}=await supabase.from('anamnesis_questions').insert({clinic_id:this.clinicId,question,question_type:'text',template_type:'general',required:form.elements.required.checked,sequence:Math.max(0,...this.questions.map(q=>q.sequence||0))+1,source_payload:{alegrare_internal_parameter:true}});if(error)throw error;});}
  saveTooth(event,existing){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const content=JSON.stringify({surface:form.elements.surface.value.trim(),condition:form.elements.condition.value.trim(),note:form.elements.note.value.trim()});if(content==='{"surface":"","condition":"","note":""}')throw new Error('Preencha uma condição ou uma observação.');let q;if(existing)q=supabase.from('clinical_records').update({content}).eq('id',existing.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',existing.updated_at);else q=supabase.from('clinical_records').insert({clinic_id:this.clinicId,patient_id:this.patient.id,record_type:'observation',title:`Odontograma · ${this.selectedTooth}`,content,external_source:'alegrare_odontogram',external_id:this.selectedTooth,created_by:this.profile.id});const {data,error}=await q.select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('O dente foi alterado em outra sessão. Recarregue antes de salvar.');});}
  savePlan(event,plan){event.preventDefault();const form=event.currentTarget;this.run(form,async()=>{const source_payload={...(plan.source_payload||{}),alegrare_finance_observation:form.elements.observation.value.trim()};const {data,error}=await supabase.from('treatment_plans').update({source_payload}).eq('id',plan.id).eq('clinic_id',this.clinicId).eq('patient_id',this.patient.id).eq('updated_at',plan.updated_at).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('O orçamento mudou em outra sessão. Recarregue antes de salvar.');});}
  destroy(){this.disposed=true;this.sequence++;}
}
