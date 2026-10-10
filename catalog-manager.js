import { supabase } from './supabase-client.js';
import { STOCK_FIELDS, loadClinicStock } from './stock-store.js';
import { clinicDay, stockSummary, matchesStockAlert, stockAlertLabels, stockDateLabel, stockNumber } from './stock-alerts.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const categoryNames = { product:'Produto', supply:'Insumo', cleaning:'Limpeza', material:'Material', medication:'Medicamento' };
const medicationFields = 'id,display_name,active_ingredient,presentation,is_active,created_at';

export class CatalogManager {
  constructor({ clinicId, profileId, initialType='medication', initialAlert='all' }) {
    this.clinicId=clinicId; this.profileId=profileId;
    this.type=initialType==='stock'?'stock':'medication';
    this.filter='all'; this.alertFilter=['replenish','expired','expiring'].includes(initialAlert)?initialAlert:'all';
    this.term=''; this.rows=[]; this.busy=false; this.loading=false; this.ready=false;
    this.requestVersion=0; this.disposed=false; this.editId=null;
    this.onVisibility=()=>{if(!document.hidden&&!this.editId)this.load();};
  }

  mount(host) { this.host=host; this.render(); document.addEventListener('visibilitychange',this.onVisibility); this.load(); }

  render() {
    this.host.innerHTML=`<style>
      .catalog-manager{--cat-blue:#2680b3;--cat-ink:#263b48;--cat-muted:#617480;color:var(--cat-ink)}
      .catalog-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.catalog-intro h2{font:700 19px Manrope,Arial,sans-serif;margin:0 0 6px}.catalog-intro p{color:var(--cat-muted);font-size:13px;line-height:1.5;margin:0}
      .catalog-tabs,.catalog-filters{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.catalog-tabs button,.catalog-filters button{border:1px solid #d7e2e8;background:#fff;color:#49606e;border-radius:9px;padding:9px 12px;font:700 12px Inter,Arial,sans-serif;cursor:pointer}.catalog-tabs button.active,.catalog-filters button.active{background:#eaf4f9;border-color:#b8d8e8;color:#205f80}.catalog-manager button:disabled{opacity:.6;cursor:wait}
      .catalog-form{display:grid;gap:13px;padding:17px;border:1px solid #e1e9ed;border-radius:13px;background:#fbfdfe;margin:12px 0 20px}.catalog-form h3{font:700 15px Manrope,Arial,sans-serif;margin:0}.catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.catalog-form label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#526975;min-width:0}
      .catalog-form input,.catalog-form select{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #d6e2e8;border-radius:9px;background:#fff;padding:9px 11px;font:13px Inter,Arial,sans-serif;color:var(--cat-ink)}.catalog-form input:focus,.catalog-form select:focus,.catalog-search input:focus,.catalog-manager button:focus-visible{outline:3px solid #2680b326;border-color:var(--cat-blue)}
      .catalog-submit{justify-self:start;border:0;border-radius:9px;background:var(--cat-blue);color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.catalog-hint{margin:0;font-size:11px;line-height:1.5;color:#617480}.catalog-feedback{min-height:18px;margin:0;color:#526975;font-size:12px}.catalog-feedback.error{color:#a33f36}.catalog-feedback.success{color:#26734a}
      .catalog-list-head{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0 9px}.catalog-list-head h3{font:700 16px Manrope,Arial,sans-serif;margin:0}.catalog-search{display:grid;gap:5px;font-size:11px;color:#5b717e;min-width:min(300px,100%)}.catalog-search input{box-sizing:border-box;width:100%;padding:9px 11px;border:1px solid #d6e2e8;border-radius:9px}
      .catalog-list{display:grid;gap:8px}.catalog-item{display:grid;gap:10px;padding:13px 14px;border:1px solid #e2e9ed;border-radius:11px;background:#fff}.catalog-item-main{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.catalog-item-main>div:first-child{min-width:0;display:grid;gap:5px}.catalog-item b{font-size:13px;overflow-wrap:anywhere}.catalog-item small{font-size:11px;color:#617480;overflow-wrap:anywhere;line-height:1.5}.catalog-badge{flex:none;border-radius:999px;background:#eef5f8;color:#3d6678;padding:5px 8px;font-size:10px;font-weight:700}.catalog-item-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .catalog-empty{border:1px dashed #cbd9df;border-radius:11px;padding:22px;text-align:center;color:#617480;font-size:12px}.catalog-count{font-size:11px;color:#617480;margin:0 0 8px}.catalog-refresh,.catalog-edit{border:0;background:none;color:#2675a0;font-weight:700;font-size:12px;cursor:pointer;padding:5px 0}
      .catalog-alerts{margin:20px 0}.catalog-alerts h3{font:700 16px Manrope,Arial,sans-serif;margin:0 0 8px}.catalog-alert-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:10px 0}.catalog-alert-grid button{display:grid;gap:5px;text-align:left;border:1px solid #dce7ec;background:#fbfdfe;color:#415967;border-radius:11px;padding:13px;cursor:pointer}.catalog-alert-grid strong{font-size:22px}.catalog-alert-grid span{font-size:12px;line-height:1.4}.catalog-alert-grid button.warning{background:#fff9ee;border-color:#efdab0}.catalog-alert-grid button.danger{background:#fff4f2;border-color:#efc6bf}.catalog-alert-grid button.active{outline:2px solid #2680b3;outline-offset:1px}
      .catalog-alert-tags{display:flex;gap:6px;flex-wrap:wrap}.catalog-alert-tag{font-size:11px;font-weight:700;padding:5px 8px;border-radius:6px}.catalog-alert-tag.warning{color:#815318;background:#fff4de}.catalog-alert-tag.danger{color:#9d382e;background:#fdebe8}.catalog-stock-edit{margin:0;padding:12px}.catalog-editor-actions{display:flex;align-items:center;gap:15px}
      @media(max-width:600px){.catalog-grid{grid-template-columns:1fr}.catalog-intro{display:block}.catalog-item-main{flex-direction:column;gap:9px}.catalog-item-actions{justify-content:flex-start}.catalog-alert-grid{grid-template-columns:1fr}.catalog-alert-grid button{grid-template-columns:36px 1fr;align-items:center}}
    </style><div class="catalog-manager">
      <div class="catalog-intro"><div><h2>Catálogo da clínica</h2><p>Cadastre medicamentos para as prescrições e acompanhe o estoque dos itens usados na rotina.</p></div><button class="catalog-refresh" type="button" data-refresh>Atualizar lista</button></div>
      <div class="catalog-tabs" role="tablist" aria-label="Tipo de cadastro"><button type="button" role="tab" data-type="medication" class="${this.type==='medication'?'active':''}" aria-selected="${this.type==='medication'}">Medicamentos</button><button type="button" role="tab" data-type="stock" class="${this.type==='stock'?'active':''}" aria-selected="${this.type==='stock'}">Produtos e estoque</button></div>
      ${this.type==='medication'?this.medicationForm():this.stockForm()}<p class="catalog-feedback" role="status" aria-live="polite" data-feedback></p>
      ${this.type==='stock'?'<section class="catalog-alerts" data-alerts aria-label="Avisos de estoque e validade"></section>':''}
      <div class="catalog-list-head"><h3>${this.type==='medication'?'Medicamentos da clínica':'Itens em estoque'}</h3><label class="catalog-search">Buscar neste cadastro<input type="search" data-search value="${escape(this.term)}" placeholder="Nome, fornecedor ou lote"></label></div>
      ${this.type==='stock'?`<div class="catalog-filters" aria-label="Filtrar tipo de item">${[['all','Todos'],['product','Produtos'],['supply','Insumos'],['cleaning','Limpeza'],['medication','Medicamentos'],['material','Materiais']].map(([key,name])=>`<button type="button" data-filter="${key}" class="${this.filter===key?'active':''}" aria-pressed="${this.filter===key}">${name}</button>`).join('')}</div>`:''}
      <p class="catalog-count" data-count></p><div class="catalog-list" data-list aria-live="polite"></div></div>`;
    this.host.querySelectorAll('[data-type]').forEach(button=>button.onclick=()=>this.switchType(button.dataset.type));
    this.host.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{this.filter=button.dataset.filter;this.editId=null;this.host.querySelectorAll('[data-filter]').forEach(item=>{item.classList.toggle('active',item.dataset.filter===this.filter);item.setAttribute('aria-pressed',item.dataset.filter===this.filter);});this.paintRows();});
    this.host.querySelector('[data-search]').oninput=event=>{this.term=event.target.value;this.editId=null;this.paintRows();};
    this.host.querySelector('[data-refresh]').onclick=()=>this.load();
    this.host.querySelector('#catalog-medication-form')?.addEventListener('submit',event=>this.saveMedication(event));
    this.host.querySelector('#catalog-stock-form')?.addEventListener('submit',event=>this.saveStock(event));
    this.host.querySelector('[data-list]').addEventListener('click',event=>{const button=event.target.closest('[data-edit-stock], [data-cancel-stock]');if(!button||this.busy||this.loading)return;this.editId=button.hasAttribute('data-cancel-stock')?null:button.dataset.editStock;this.paintRows();if(this.editId)this.host.querySelector('[data-stock-edit] input')?.focus();});
    this.host.querySelector('[data-list]').addEventListener('submit',event=>{if(event.target.matches('[data-stock-edit]'))this.saveStockUpdate(event);});
    this.paintAlerts();this.paintRows();this.setControls();
  }

  switchType(type) {
    if(this.busy||this.type===type||!['medication','stock'].includes(type))return;
    this.requestVersion++;this.loading=false;this.ready=false;this.type=type;this.rows=[];this.term='';this.filter='all';this.alertFilter='all';this.editId=null;
    this.render();this.load();
  }

  medicationForm() {
    return `<form class="catalog-form" id="catalog-medication-form"><h3>Novo medicamento personalizado</h3><div class="catalog-grid"><label>Nome do medicamento<input name="display_name" required minlength="2" maxlength="160" placeholder="Nome comercial ou fórmula"></label><label>Princípio ativo<input name="active_ingredient" maxlength="160" placeholder="Opcional"></label></div><label>Apresentação<input name="presentation" maxlength="160" placeholder="Concentração e forma farmacêutica (opcional)"></label><p class="catalog-hint">Para acompanhar quantidade, lote e validade, registre o medicamento também em Produtos e estoque.</p><button type="submit" class="catalog-submit" data-label="Cadastrar medicamento">Cadastrar medicamento</button></form>`;
  }

  stockForm() {
    return `<form class="catalog-form" id="catalog-stock-form"><h3>Novo item em estoque</h3><div class="catalog-grid"><label>Nome do item<input name="name" required minlength="2" maxlength="160" placeholder="Luvas, desinfetante, medicamento…"></label><label>Tipo<select name="category" required>${Object.entries(categoryNames).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><div class="catalog-grid"><label>Unidade de controle<input name="unit" required maxlength="30" value="un" placeholder="un, caixa, frasco, litro"></label><label>Fornecedor<input name="supplier" maxlength="160" placeholder="Opcional"></label></div><div class="catalog-grid"><label>Quantidade atual<input name="quantity" type="number" min="0" step="0.01" value="0" required></label><label>Estoque mínimo<input name="minimum_quantity" type="number" min="0" step="0.01" value="0" required></label></div><div class="catalog-grid"><label>Lote<input name="lot_code" maxlength="120" placeholder="Opcional"></label><label>Validade<input name="expires_on" type="date"></label></div><div class="catalog-grid"><label>Valor unitário (R$)<input name="unit_price" type="number" min="0" step="0.01" placeholder="Opcional"></label><label>Data da compra<input name="purchased_on" type="date"></label></div><p class="catalog-hint">O aviso de reposição aparece quando a quantidade chega ao mínimo. Para lotes com saldo, a validade é avisada com 30 dias de antecedência.</p><button type="submit" class="catalog-submit" data-label="Cadastrar item">Cadastrar item</button></form>`;
  }

  async load() {
    if(this.loading||this.busy||this.disposed)return;
    this.loading=true;const type=this.type,request=++this.requestVersion;this.setControls();this.paintRows();
    try {
      let rows;
      if(type==='stock')rows=await loadClinicStock(this.clinicId);
      else {const {data,error}=await supabase.from('medications').select(medicationFields).eq('clinic_id',this.clinicId).order('display_name');if(error)throw error;rows=data||[];}
      if(this.disposed||request!==this.requestVersion)return;
      this.rows=rows;this.ready=true;this.showFeedback('');
    } catch(error) {if(!this.disposed&&request===this.requestVersion)this.showFeedback(`Não foi possível carregar: ${error.message||'Tente novamente.'}`,true);}
    finally {if(!this.disposed&&request===this.requestVersion){this.loading=false;this.paintAlerts();this.paintRows();this.setControls();}}
  }

  paintAlerts() {
    const host=this.host?.querySelector('[data-alerts]');if(!host)return;
    if(!this.ready){host.innerHTML='<p class="catalog-hint">Carregue o estoque para consultar os avisos.</p>';return;}
    const counts=stockSummary(this.rows);
    host.innerHTML=`<h3>Avisos de estoque e validade</h3><div class="catalog-alert-grid">${[['replenish','Precisam de reposição','warning'],['expired','Lotes vencidos','danger'],['expiring','Vencem em até 30 dias','warning']].map(([key,label,tone])=>`<button type="button" data-alert-filter="${key}" aria-pressed="${this.alertFilter===key}" class="${counts[key]?tone:''} ${this.alertFilter===key?'active':''}"><strong>${counts[key]}</strong><span>${label}</span></button>`).join('')}</div><p class="catalog-hint">${counts.total?`${counts.total} item(ns) com avisos. Selecione um aviso para filtrar a lista.`:'Nenhum aviso no momento.'} Validade considera apenas lotes com saldo em estoque.</p>${this.alertFilter!=='all'?'<button class="catalog-refresh" type="button" data-alert-filter="all">Mostrar todos os avisos e itens</button>':''}`;
    host.querySelectorAll('[data-alert-filter]').forEach(button=>button.onclick=()=>{if(this.busy)return;this.alertFilter=this.alertFilter===button.dataset.alertFilter?'all':button.dataset.alertFilter;this.editId=null;this.paintAlerts();this.paintRows();});
  }

  paintRows() {
    if(!this.host?.isConnected)return;
    const list=this.host.querySelector('[data-list]'),count=this.host.querySelector('[data-count]');if(!list||!count)return;
    if(!this.ready){count.textContent=this.loading?'Carregando cadastros…':'Aguardando o carregamento dos cadastros.';list.innerHTML='';return;}
    const term=this.term.trim().toLocaleLowerCase('pt-BR'),today=clinicDay();
    const rows=this.rows.filter(row=>this.type==='medication'?`${row.display_name} ${row.active_ingredient||''} ${row.presentation||''}`.toLocaleLowerCase('pt-BR').includes(term):(this.filter==='all'||row.category===this.filter)&&matchesStockAlert(row,this.alertFilter,today)&&`${row.name} ${row.supplier||''} ${row.lot_code||''}`.toLocaleLowerCase('pt-BR').includes(term));
    count.textContent=`${rows.length} ${this.type==='medication'?'medicamento(s) cadastrado(s)':'item(ns) encontrado(s)'}${this.loading?' · Atualizando…':''}`;
    list.innerHTML=rows.length?rows.map(row=>this.type==='medication'?`<article class="catalog-item"><div class="catalog-item-main"><div><b>${escape(row.display_name)}</b><small>${escape([row.active_ingredient,row.presentation].filter(Boolean).join(' · ')||'Sem princípio ativo ou apresentação registrados')}</small></div><span class="catalog-badge">${row.is_active?'Disponível':'Inativo'}</span></div></article>`:this.stockRow(row,today)).join(''):`<div class="catalog-empty">${this.rows.length?'Nenhum item corresponde aos filtros selecionados.':'Nenhum item cadastrado. Use o formulário acima para adicionar o primeiro.'}</div>`;
    this.setControls();
  }

  stockRow(row,today) {
    const details=[`Quantidade ${stockNumber(row.quantity)} ${row.unit}`,`Mínimo ${stockNumber(row.minimum_quantity)} ${row.unit}`,row.lot_code?`Lote ${row.lot_code}`:null,row.supplier,`Validade ${stockDateLabel(row.expires_on)}`].filter(Boolean).join(' · '),alerts=stockAlertLabels(row,today);
    return `<article class="catalog-item"><div class="catalog-item-main"><div><b>${escape(row.name)}</b><small>${escape(details)}</small>${alerts.length?`<div class="catalog-alert-tags">${alerts.map(alert=>`<span class="catalog-alert-tag ${alert.tone}">${escape(alert.text)}</span>`).join('')}</div>`:''}</div><div class="catalog-item-actions"><span class="catalog-badge">${escape(categoryNames[row.category]||row.category)}</span><button type="button" class="catalog-edit" data-edit-stock="${escape(row.id)}" aria-label="Atualizar estoque de ${escape(row.name)}">Atualizar estoque</button></div></div>${this.editId===row.id?this.stockEditor(row):''}</article>`;
  }

  stockEditor(row) {
    return `<form class="catalog-form catalog-stock-edit" data-stock-edit="${escape(row.id)}"><h3>Atualizar quantidade e validade</h3><div class="catalog-grid"><label>Quantidade atual (${escape(row.unit)})<input name="quantity" type="number" min="0" step="0.01" value="${escape(row.quantity)}" required></label><label>Estoque mínimo (${escape(row.unit)})<input name="minimum_quantity" type="number" min="0" step="0.01" value="${escape(row.minimum_quantity)}" required></label></div><label>Validade do lote<input name="expires_on" type="date" value="${escape(row.expires_on||'')}"></label><div class="catalog-editor-actions"><button type="submit" class="catalog-submit" data-label="Salvar estoque">Salvar estoque</button><button type="button" class="catalog-edit" data-cancel-stock>Cancelar</button></div></form>`;
  }

  setControls() {
    if(!this.host||this.disposed)return;
    this.host.querySelectorAll('[data-type], [data-filter], [data-alert-filter], [data-cancel-stock]').forEach(button=>button.disabled=this.busy);
    this.host.querySelectorAll('[data-refresh], [data-edit-stock]').forEach(button=>button.disabled=this.busy||this.loading||!this.ready&&button.hasAttribute('data-edit-stock'));
    this.host.querySelectorAll('.catalog-submit').forEach(button=>{button.disabled=this.busy||this.loading||!this.ready;button.textContent=this.busy?'Salvando…':button.dataset.label;});
    const search=this.host.querySelector('[data-search]');if(search)search.disabled=this.busy;
  }

  canSave() {if(this.busy||this.disposed)return false;if(!this.ready||this.loading){this.showFeedback('Aguarde o carregamento dos cadastros para salvar.',true);return false;}return true;}

  async saveMedication(event) {
    event.preventDefault();if(!this.canSave())return;
    const form=event.currentTarget,fd=new FormData(form),name=String(fd.get('display_name')||'').trim();
    if(name.length<2){this.showFeedback('Informe um nome com pelo menos duas letras.',true);return;}
    if(this.rows.some(row=>String(row.display_name||'').toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){this.showFeedback('Este medicamento já está cadastrado na clínica.',true);return;}
    const payload={clinic_id:this.clinicId,display_name:name,active_ingredient:String(fd.get('active_ingredient')||'').trim()||null,presentation:String(fd.get('presentation')||'').trim()||null,source:'clinic_custom',is_active:true};
    this.busy=true;this.setControls();
    try {const {data,error}=await supabase.from('medications').insert(payload).select(medicationFields).single();if(error)throw error;if(this.disposed)return;this.rows.push(data);this.rows.sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR'));form.reset();this.showFeedback('Medicamento cadastrado e disponível para as próximas prescrições.');this.paintRows();}
    catch(error){if(!this.disposed)this.showFeedback(`Não foi possível salvar: ${error.message||'Tente novamente.'}`,true);}
    finally{this.busy=false;this.setControls();}
  }

  async saveStock(event) {
    event.preventDefault();if(!this.canSave())return;
    const form=event.currentTarget,fd=new FormData(form),name=String(fd.get('name')||'').trim(),category=String(fd.get('category')),lot=String(fd.get('lot_code')||'').trim();
    if(name.length<2){this.showFeedback('Informe o nome do item com pelo menos duas letras.',true);return;}
    if(this.rows.some(row=>String(row.name||'').toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')&&row.category===category&&(row.lot_code||'')===lot)){this.showFeedback('Este item com o mesmo tipo e lote já está cadastrado.',true);return;}
    const number=value=>value===''||value==null?null:Number(value);
    const payload={clinic_id:this.clinicId,created_by:this.profileId,name,category,unit:String(fd.get('unit')||'un').trim()||'un',quantity:Number(fd.get('quantity')),minimum_quantity:Number(fd.get('minimum_quantity')),lot_code:lot,supplier:String(fd.get('supplier')||'').trim()||null,expires_on:String(fd.get('expires_on')||'')||null,unit_price:number(fd.get('unit_price')),purchased_on:String(fd.get('purchased_on')||'')||null};
    if(!Object.hasOwn(categoryNames,category)||![payload.quantity,payload.minimum_quantity,payload.unit_price??0].every(value=>Number.isFinite(value)&&value>=0)){this.showFeedback('Confira o tipo e informe quantidades e valores maiores ou iguais a zero.',true);return;}
    this.busy=true;this.setControls();
    try {const {data,error}=await supabase.from('stock_items').insert(payload).select(STOCK_FIELDS).single();if(error)throw error;if(this.disposed)return;this.rows.push(data);this.rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));form.reset();this.showFeedback('Item adicionado ao estoque. Os avisos foram atualizados.');this.paintAlerts();this.paintRows();}
    catch(error){if(!this.disposed)this.showFeedback(`Não foi possível salvar: ${error.message||'Tente novamente.'}`,true);}
    finally{this.busy=false;this.setControls();}
  }

  async saveStockUpdate(event) {
    event.preventDefault();if(!this.canSave())return;
    const form=event.target,fd=new FormData(form),id=form.dataset.stockEdit;if(!this.rows.some(row=>row.id===id))return;
    const payload={quantity:Number(fd.get('quantity')),minimum_quantity:Number(fd.get('minimum_quantity')),expires_on:String(fd.get('expires_on')||'')||null};
    if(![payload.quantity,payload.minimum_quantity].every(value=>Number.isFinite(value)&&value>=0)){this.showFeedback('Informe quantidades maiores ou iguais a zero.',true);return;}
    this.busy=true;this.setControls();
    try {const {data,error}=await supabase.from('stock_items').update(payload).eq('id',id).eq('clinic_id',this.clinicId).select(STOCK_FIELDS).single();if(error)throw error;if(this.disposed)return;this.rows=this.rows.map(row=>row.id===id?data:row);this.editId=null;this.showFeedback('Estoque salvo. Os avisos foram atualizados.');this.paintAlerts();this.paintRows();}
    catch(error){if(!this.disposed)this.showFeedback(`Não foi possível atualizar: ${error.message||'Tente novamente.'}`,true);}
    finally{this.busy=false;this.setControls();}
  }

  showFeedback(message,error=false) {const feedback=this.host?.querySelector('[data-feedback]');if(feedback){feedback.textContent=message;feedback.className=`catalog-feedback ${error?'error':'success'}`;}}
  destroy() {this.disposed=true;this.requestVersion++;document.removeEventListener('visibilitychange',this.onVisibility);}
}
