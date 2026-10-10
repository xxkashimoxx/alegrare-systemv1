import { supabase } from './supabase-client.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const categoryNames = { product:'Produto', supply:'Insumo', cleaning:'Limpeza', material:'Material', medication:'Medicamento' };

export class CatalogManager {
  constructor({ clinicId, profileId }) {
    this.clinicId = clinicId;
    this.profileId = profileId;
    this.type = 'medication';
    this.filter = 'all';
    this.term = '';
    this.rows = [];
    this.busy = false;
    this.loading = false;
    this.requestVersion = 0;
    this.disposed = false;
  }

  mount(host) {
    this.host = host;
    this.render();
    this.load();
  }

  render() {
    this.host.innerHTML = `
      <style>
        .catalog-manager{--cat-blue:#2680b3;--cat-ink:#263b48;--cat-muted:#617480;color:var(--cat-ink)}
        .catalog-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
        .catalog-intro h2{font:700 19px Manrope,Arial,sans-serif;margin:0 0 6px}.catalog-intro p{color:var(--cat-muted);font-size:13px;line-height:1.5;margin:0}
        .catalog-tabs,.catalog-filters{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
        .catalog-tabs button,.catalog-filters button{border:1px solid #d7e2e8;background:#fff;color:#49606e;border-radius:9px;padding:9px 12px;font:700 12px Inter,Arial,sans-serif;cursor:pointer}
        .catalog-tabs button.active,.catalog-filters button.active{background:#eaf4f9;border-color:#b8d8e8;color:#205f80}
        .catalog-form{display:grid;gap:13px;padding:17px;border:1px solid #e1e9ed;border-radius:13px;background:#fbfdfe;margin:12px 0 20px}
        .catalog-form h3{font:700 15px Manrope,Arial,sans-serif;margin:0}.catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .catalog-form label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#526975;min-width:0}
        .catalog-form input,.catalog-form select{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #d6e2e8;border-radius:9px;background:#fff;padding:9px 11px;font:13px Inter,Arial,sans-serif;color:var(--cat-ink)}
        .catalog-form input:focus,.catalog-form select:focus,.catalog-search input:focus{outline:3px solid #2680b326;border-color:var(--cat-blue)}
        .catalog-submit{justify-self:start;border:0;border-radius:9px;background:var(--cat-blue);color:#fff;padding:11px 16px;font-weight:700;cursor:pointer}.catalog-submit:disabled{opacity:.6;cursor:wait}
        .catalog-feedback{min-height:18px;margin:0;color:#526975;font-size:12px}.catalog-feedback.error{color:#a33f36}.catalog-feedback.success{color:#26734a}
        .catalog-list-head{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0 9px}.catalog-list-head h3{font:700 16px Manrope,Arial,sans-serif;margin:0}
        .catalog-search{display:grid;gap:5px;font-size:11px;color:#5b717e;min-width:min(300px,100%)}.catalog-search input{box-sizing:border-box;width:100%;padding:9px 11px;border:1px solid #d6e2e8;border-radius:9px}
        .catalog-list{display:grid;gap:8px}.catalog-item{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 14px;border:1px solid #e2e9ed;border-radius:11px;background:#fff}.catalog-item>div:first-child{min-width:0;display:grid;gap:4px}.catalog-item b{font-size:13px;overflow-wrap:anywhere}.catalog-item small{font-size:11px;color:#617480;overflow-wrap:anywhere}.catalog-badge{flex:none;border-radius:999px;background:#eef5f8;color:#3d6678;padding:5px 8px;font-size:10px;font-weight:700}.catalog-empty{border:1px dashed #cbd9df;border-radius:11px;padding:22px;text-align:center;color:#617480;font-size:12px}
        .catalog-count{font-size:11px;color:#617480;margin:0 0 8px}.catalog-refresh{border:0;background:none;color:#2675a0;font-weight:700;font-size:12px;cursor:pointer}
        @media(max-width:600px){.catalog-grid{grid-template-columns:1fr}.catalog-intro{display:block}.catalog-item{align-items:flex-start}.catalog-badge{white-space:nowrap}}
      </style>
      <div class="catalog-manager">
        <div class="catalog-intro"><div><h2>Catálogo da clínica</h2><p>Cadastre medicamentos para usar nas prescrições e organize os demais itens usados na rotina.</p></div><button class="catalog-refresh" type="button" data-refresh>Atualizar lista</button></div>
        <div class="catalog-tabs" role="tablist" aria-label="Tipo de cadastro">
          <button type="button" role="tab" data-type="medication" class="${this.type==='medication'?'active':''}" aria-selected="${this.type==='medication'}">Medicamento</button>
          <button type="button" role="tab" data-type="stock" class="${this.type==='stock'?'active':''}" aria-selected="${this.type==='stock'}">Produto e estoque</button>
        </div>
        ${this.type==='medication'?this.medicationForm():this.stockForm()}
        <p class="catalog-feedback" role="status" aria-live="polite" data-feedback></p>
        <div class="catalog-list-head"><h3>${this.type==='medication'?'Medicamentos da clínica':'Produtos e insumos'}</h3><label class="catalog-search">Buscar neste cadastro<input type="search" data-search value="${escape(this.term)}" placeholder="Digite o nome"></label></div>
        ${this.type==='stock'?`<div class="catalog-filters" aria-label="Filtrar estoque">${[['all','Todos'],['product','Produtos'],['supply','Insumos'],['cleaning','Limpeza']].map(([key,name])=>`<button type="button" data-filter="${key}" class="${this.filter===key?'active':''}">${name}</button>`).join('')}</div>`:''}
        <p class="catalog-count" data-count>Carregando cadastros…</p><div class="catalog-list" data-list aria-live="polite"></div>
      </div>`;
    this.host.querySelectorAll('[data-type]').forEach(button => button.onclick = () => { this.requestVersion++; this.loading=false; this.type=button.dataset.type; this.term=''; this.render(); this.load(); });
    this.host.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { this.filter=button.dataset.filter; this.render(); this.paintRows(); });
    this.host.querySelector('[data-search]').oninput = event => { this.term=event.target.value; this.paintRows(); };
    this.host.querySelector('[data-refresh]').onclick = () => this.load();
    this.host.querySelector('#catalog-medication-form')?.addEventListener('submit', event => this.saveMedication(event));
    this.host.querySelector('#catalog-stock-form')?.addEventListener('submit', event => this.saveStock(event));
    this.paintRows();
  }

  medicationForm() {
    return `<form class="catalog-form" id="catalog-medication-form"><h3>Novo medicamento personalizado</h3><div class="catalog-grid"><label>Nome do medicamento<input name="display_name" required maxlength="160" placeholder="Ex.: nome comercial ou fórmula"></label><label>Princípio ativo<input name="active_ingredient" maxlength="160" placeholder="Opcional"></label></div><label>Apresentação<input name="presentation" maxlength="160" placeholder="Ex.: concentração e forma farmacêutica (opcional)"></label><button class="catalog-submit">Cadastrar medicamento</button></form>`;
  }

  stockForm() {
    return `<form class="catalog-form" id="catalog-stock-form"><h3>Novo item de produto, insumo ou limpeza</h3><div class="catalog-grid"><label>Nome do item<input name="name" required minlength="2" maxlength="160" placeholder="Ex.: luvas, sabonete enzimático, desinfetante"></label><label>Tipo<select name="category" required><option value="product">Produto</option><option value="supply">Insumo</option><option value="cleaning">Limpeza</option></select></label></div><div class="catalog-grid"><label>Unidade de controle<input name="unit" required maxlength="30" value="un" placeholder="un, caixa, frasco, litro"></label><label>Fornecedor<input name="supplier" maxlength="160" placeholder="Opcional"></label></div><div class="catalog-grid"><label>Quantidade atual<input name="quantity" type="number" min="0" step="0.01" value="0" required></label><label>Estoque mínimo<input name="minimum_quantity" type="number" min="0" step="0.01" value="0" required></label></div><div class="catalog-grid"><label>Lote<input name="lot_code" maxlength="120" placeholder="Opcional"></label><label>Validade<input name="expires_on" type="date"></label></div><div class="catalog-grid"><label>Valor unitário (R$)<input name="unit_price" type="number" min="0" step="0.01" placeholder="Opcional"></label><label>Data da compra<input name="purchased_on" type="date"></label></div><button class="catalog-submit">Cadastrar item</button></form>`;
  }

  async load() {
    if (this.loading || this.disposed) return;
    this.loading=true;
    const type=this.type, request=++this.requestVersion;
    const count=this.host.querySelector('[data-count]'); if(count)count.textContent='Atualizando cadastros…';
    const query=type==='medication'
      ? supabase.from('medications').select('id,display_name,active_ingredient,presentation,is_active,created_at').eq('clinic_id',this.clinicId).order('display_name')
      : supabase.from('stock_items').select('id,name,category,unit,quantity,minimum_quantity,lot_code,supplier,expires_on,unit_price').eq('clinic_id',this.clinicId).order('name');
    const {data,error}=await query;
    if(request===this.requestVersion)this.loading=false;
    if(this.disposed||request!==this.requestVersion)return;
    if(error){this.showFeedback(`Não foi possível carregar: ${error.message}`,true);if(count)count.textContent='Falha ao carregar. Tente novamente.';return;}
    this.rows=data||[];this.paintRows();
  }

  paintRows() {
    if(!this.host?.isConnected)return;
    const list=this.host.querySelector('[data-list]'),count=this.host.querySelector('[data-count]');if(!list||!count)return;
    const term=this.term.trim().toLocaleLowerCase('pt-BR');
    let rows=this.rows.filter(row=>this.type==='medication'
      ? `${row.display_name} ${row.active_ingredient||''} ${row.presentation||''}`.toLocaleLowerCase('pt-BR').includes(term)
      : (this.filter==='all'||row.category===this.filter)&&`${row.name} ${row.supplier||''} ${row.lot_code||''}`.toLocaleLowerCase('pt-BR').includes(term));
    count.textContent=`${rows.length} ${this.type==='medication'?'medicamento(s) cadastrado(s)':'item(ns) encontrado(s)'}`;
    list.innerHTML=rows.length?rows.map(row=>this.type==='medication'
      ? `<article class="catalog-item"><div><b>${escape(row.display_name)}</b><small>${escape([row.active_ingredient,row.presentation].filter(Boolean).join(' · ')||'Sem princípio ativo ou apresentação registrados')}</small></div><span class="catalog-badge">${row.is_active?'Disponível':'Inativo'}</span></article>`
      : `<article class="catalog-item"><div><b>${escape(row.name)}</b><small>${escape([row.quantity, row.unit, row.supplier, row.expires_on?`Validade ${new Date(`${row.expires_on}T12:00:00`).toLocaleDateString('pt-BR')}`:null].filter(Boolean).join(' · '))}</small></div><span class="catalog-badge">${escape(categoryNames[row.category]||row.category)}${Number(row.quantity)<=Number(row.minimum_quantity)?' · Repor':''}</span></article>`).join(''):`<div class="catalog-empty">Nenhum item neste cadastro ainda. Use o formulário acima para adicionar o primeiro.</div>`;
  }

  async saveMedication(event) {
    event.preventDefault(); if(this.busy)return;
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]')||form.querySelector('.catalog-submit'),fd=new FormData(form),name=String(fd.get('display_name')||'').trim();
    if(name.length<2){this.showFeedback('Informe um nome com pelo menos duas letras.',true);return;}
    this.busy=true;button.disabled=true;button.textContent='Salvando…';
    const duplicate=this.rows.find(row=>row.display_name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
    if(duplicate){this.busy=false;button.disabled=false;button.textContent='Cadastrar medicamento';this.showFeedback('Este medicamento já está cadastrado na clínica.',true);return;}
    const payload={clinic_id:this.clinicId,display_name:name,active_ingredient:String(fd.get('active_ingredient')||'').trim()||null,presentation:String(fd.get('presentation')||'').trim()||null,source:'clinic_custom',is_active:true};
    const {data,error}=await supabase.from('medications').insert(payload).select('id,display_name,active_ingredient,presentation,is_active,created_at').single();
    this.busy=false;if(this.disposed)return;button.disabled=false;button.textContent='Cadastrar medicamento';
    if(error){this.showFeedback(`Não foi possível salvar: ${error.message}`,true);return;}
    this.rows.push(data);this.rows.sort((a,b)=>a.display_name.localeCompare(b.display_name,'pt-BR'));form.reset();this.showFeedback('Medicamento cadastrado e disponível para as próximas prescrições.',false);this.paintRows();
  }

  async saveStock(event) {
    event.preventDefault(); if(this.busy)return;
    const form=event.currentTarget,button=form.querySelector('.catalog-submit'),fd=new FormData(form),name=String(fd.get('name')||'').trim();
    if(name.length<2){this.showFeedback('Informe o nome do item com pelo menos duas letras.',true);return;}
    const category=String(fd.get('category'));
    const duplicate=this.rows.find(row=>row.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')&&row.category===category&&(row.lot_code||'')===(String(fd.get('lot_code')||'').trim()));
    if(duplicate){this.showFeedback('Este item com o mesmo tipo e lote já está cadastrado.',true);return;}
    this.busy=true;button.disabled=true;button.textContent='Salvando…';
    const number=value=>value===''||value==null?null:Number(value);
    const payload={clinic_id:this.clinicId,created_by:this.profileId,name,category,unit:String(fd.get('unit')||'un').trim()||'un',quantity:Number(fd.get('quantity')||0),minimum_quantity:Number(fd.get('minimum_quantity')||0),lot_code:String(fd.get('lot_code')||'').trim(),supplier:String(fd.get('supplier')||'').trim()||null,expires_on:String(fd.get('expires_on')||'')||null,unit_price:number(fd.get('unit_price')),purchased_on:String(fd.get('purchased_on')||'')||null};
    const {data,error}=await supabase.from('stock_items').insert(payload).select('id,name,category,unit,quantity,minimum_quantity,lot_code,supplier,expires_on,unit_price').single();
    this.busy=false;if(this.disposed)return;button.disabled=false;button.textContent='Cadastrar item';
    if(error){this.showFeedback(`Não foi possível salvar: ${error.message}`,true);return;}
    this.rows.push(data);this.rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));form.reset();form.elements.unit.value='un';form.elements.quantity.value='0';form.elements.minimum_quantity.value='0';this.showFeedback('Item adicionado ao estoque da clínica.');this.paintRows();
  }

  showFeedback(message,error=false){const feedback=this.host?.querySelector('[data-feedback]');if(feedback){feedback.textContent=message;feedback.className=`catalog-feedback ${error?'error':'success'}`;}}
  destroy(){this.disposed=true;}
}
