export const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export const matchesSearch=(term,...values)=>normalizeSearch(values.filter(Boolean).join(' ')).includes(normalizeSearch(term));
export const patientDisplayName=patient=>patient?.social_name?.trim()||patient?.full_name||'Paciente';
export const patientMatches=(term,patient)=>matchesSearch(term,patient?.full_name,patient?.social_name,patient?.phone);
// PostgREST OR syntax is assembled exclusively with these literal patterns and UUIDs.
export const searchPattern=value=>'%'+String(value||'').replace(/[\\%_*(),."']/g,' ').replace(/\s+/g,' ').trim().slice(0,100)+'%';
export const safeIdList=values=>[...new Set(values)].filter(v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
export function bindPatientPicker(select,patients,{optional=false,onSelect}={}){
  if(!select||select.dataset.picker)return;
  select.dataset.picker='true';const label=select.closest('label');if(!label)return;
  const id='patient-picker-'+crypto.randomUUID();const picked=patients.find(p=>p.id===select.value);
  const input=document.createElement('input');input.id=id;input.type='search';input.autocomplete='off';input.placeholder='Nome, nome social ou telefone';input.value=picked?patientDisplayName(picked):'';input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',id+'-results');
  const box=document.createElement('div');box.id=id+'-results';box.className='patient-search-results';box.setAttribute('role','listbox');
  const status=document.createElement('small');status.className='patient-search-status';status.setAttribute('role','status');status.textContent=picked?'Paciente selecionado.':optional?'Sem paciente vinculado.':'Selecione um paciente encontrado.';
  select.hidden=true;select.required=false;label.htmlFor=id;label.classList.add('patient-picker-label');label.append(input,box,status);
  let index=-1,found=[];
  const choose=p=>{select.value=p?.id||'';input.value=p?patientDisplayName(p):'';box.innerHTML='';box.classList.remove('open');status.textContent=p?'Paciente selecionado.':optional?'Sem paciente vinculado.':'Selecione um paciente encontrado.';select.dispatchEvent(new Event('change',{bubbles:true}));onSelect?.(p);};
  const paint=()=>{index=-1;found=patients.filter(p=>patientMatches(input.value,p)).slice(0,15);box.replaceChildren();if(optional){const b=document.createElement('button');b.type='button';b.textContent='Sem paciente vinculado';b.onclick=()=>choose(null);box.append(b);}for(const p of found){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');const strong=document.createElement('b');strong.textContent=patientDisplayName(p);const small=document.createElement('small');small.textContent=[p.social_name&&p.social_name!==p.full_name?`Cadastro: ${p.full_name}`:'',p.phone||'Telefone não informado'].filter(Boolean).join(' · ');b.append(strong,small);b.onclick=()=>choose(p);box.append(b);}if(!found.length){const note=document.createElement('div');note.className='patient-search-empty';note.textContent='Nenhum paciente encontrado.';box.append(note);}box.classList.add('open');};
  input.oninput=()=>{select.value='';status.textContent=optional&&!input.value?'Sem paciente vinculado.':'Selecione um paciente encontrado.';paint();};input.onfocus=paint;
  input.onkeydown=e=>{const buttons=[...box.querySelectorAll('button')];if(e.key==='Escape'){box.classList.remove('open');return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();index=Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)));buttons.forEach((b,i)=>b.classList.toggle('keyboard-selected',i===index));}if(e.key==='Enter'&&box.classList.contains('open')){e.preventDefault();if(index>=0)buttons[index]?.click();else if(found.length===1)choose(found[0]);}};
  label.addEventListener('focusout',()=>setTimeout(()=>{if(!label.contains(document.activeElement))box.classList.remove('open');},100));
  select.form?.addEventListener('submit',e=>{if((!optional&&!select.value)||(optional&&input.value&&!select.value)){e.preventDefault();e.stopImmediatePropagation();status.textContent='Escolha um paciente da lista.';input.focus();}},true);
}
