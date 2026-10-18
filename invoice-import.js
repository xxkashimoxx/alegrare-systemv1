import { supabase } from './supabase-client.js';
import { STOCK_FIELDS } from './stock-store.js';
import { parseInvoiceFile } from './invoice-parser.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const categories = { product:'Produto', supply:'Insumo', cleaning:'Limpeza', material:'Material', medication:'Medicamento' };
const money = value => value == null ? '' : Number(value).toFixed(2);

export class InvoiceImport {
  constructor({ clinicId, profileId, onImported }) {
    this.clinicId = clinicId; this.profileId = profileId; this.onImported = onImported;
    this.parsed = null; this.busy = false; this.disposed = false;
  }

  open() {
    this.host = document.createElement('div');
    this.host.className = 'invoice-overlay';
    this.host.innerHTML = `<style>
      .invoice-overlay{position:fixed;inset:0;z-index:1000;background:#18303d99;display:grid;place-items:center;padding:18px}.invoice-dialog{box-sizing:border-box;width:min(1180px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px #142a3570;color:#263b48}
      .invoice-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:18px;padding:18px 20px;background:#fff;border-bottom:1px solid #e1e9ed}.invoice-head h2{font:700 19px Manrope,Arial,sans-serif;margin:0 0 5px}.invoice-head p{font-size:12px;color:#617480;margin:0}.invoice-close{border:0;background:none;color:#49606e;font-size:24px;line-height:1;cursor:pointer}
      .invoice-body{padding:20px}.invoice-upload{display:grid;gap:13px;padding:18px;border:1px dashed #b9ced8;border-radius:13px;background:#f8fbfc}.invoice-upload label{font-size:13px;font-weight:700}.invoice-upload input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #d6e2e8;border-radius:9px;background:#fff}.invoice-hint,.invoice-status{font-size:12px;line-height:1.5;color:#617480;margin:0}.invoice-status.error{color:#a33f36}.invoice-status.success{color:#26734a}
      .invoice-primary,.invoice-secondary{border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}.invoice-primary{border:0;background:#2680b3;color:#fff}.invoice-secondary{border:1px solid #cbdce4;background:#fff;color:#30677f}.invoice-primary:disabled,.invoice-secondary:disabled{opacity:.55;cursor:wait}.invoice-summary{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin:0 0 14px}.invoice-summary strong{display:block;font-size:15px}.invoice-summary small{font-size:11px;color:#617480}
      .invoice-table-wrap{overflow:auto;border:1px solid #dce7ec;border-radius:11px}.invoice-table{width:100%;min-width:1060px;border-collapse:collapse}.invoice-table th,.invoice-table td{padding:8px;border-bottom:1px solid #e8eef1;text-align:left;vertical-align:top;font-size:11px}.invoice-table th{position:sticky;top:74px;background:#f5f9fb;color:#506875;z-index:1}.invoice-table input,.invoice-table select{box-sizing:border-box;width:100%;min-width:75px;border:1px solid #d3e0e6;border-radius:7px;padding:7px;font:12px Inter,Arial,sans-serif}.invoice-table .invoice-name{min-width:220px}.invoice-table .invoice-check{width:18px;min-width:18px}.invoice-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:15px}.invoice-select-actions{display:flex;gap:12px}.invoice-select-actions button{border:0;background:none;color:#2675a0;font-weight:700;cursor:pointer;padding:4px 0}
      @media(max-width:700px){.invoice-overlay{padding:0;place-items:stretch}.invoice-dialog{width:100%;max-height:100vh;border-radius:0}.invoice-head{padding:15px}.invoice-body{padding:15px}.invoice-table th{top:68px}}
    </style><section class="invoice-dialog" role="dialog" aria-modal="true" aria-labelledby="invoice-title"><header class="invoice-head"><div><h2 id="invoice-title">Importar nota fiscal</h2><p>Leia os itens e confira antes de adicionar ao estoque.</p></div><button type="button" class="invoice-close" data-close aria-label="Fechar">×</button></header><div class="invoice-body" data-body></div></section>`;
    document.body.append(this.host);
    this.host.querySelector('[data-close]').onclick = () => this.destroy();
    this.host.addEventListener('click', event => { if (event.target === this.host && !this.busy) this.destroy(); });
    this.keydown = event => { if (event.key === 'Escape' && !this.busy) this.destroy(); };
    document.addEventListener('keydown', this.keydown);
    this.renderUpload();
  }

  renderUpload(message = '', error = false) {
    const body = this.host.querySelector('[data-body]');
    body.innerHTML = `<div class="invoice-upload"><label for="invoice-file">Arquivo da nota fiscal</label><input id="invoice-file" data-file type="file" accept=".xml,.csv,.pdf,text/xml,text/csv,application/xml,application/pdf"><p class="invoice-hint"><b>XML da NF-e é o formato recomendado</b>, pois traz nomes, quantidades, valores e, quando emitidos, lotes e validades. CSV e PDF com texto também são aceitos. Limite: 15 MB.</p><button type="button" class="invoice-primary" data-read>Continuar para conferência</button><p class="invoice-status ${error?'error':''}" role="status" data-status>${escape(message)}</p></div>`;
    body.querySelector('[data-read]').onclick = () => this.readFile();
    body.querySelector('[data-file]').focus();
  }

  async readFile() {
    const input = this.host.querySelector('[data-file]'), button = this.host.querySelector('[data-read]'), status = this.host.querySelector('[data-status]');
    if (!input.files?.[0]) { status.textContent = 'Selecione o arquivo da nota fiscal.'; status.className = 'invoice-status error'; return; }
    this.busy = true; button.disabled = true; button.textContent = 'Lendo a nota…'; status.textContent = 'Identificando os itens. Isso pode levar alguns segundos.';
    try { this.parsed = await parseInvoiceFile(input.files[0]); if (!this.disposed) this.renderReview(); }
    catch (error) { if (!this.disposed) { status.textContent = error.message || 'Não foi possível ler o arquivo.'; status.className = 'invoice-status error'; button.disabled = false; button.textContent = 'Tentar novamente'; } }
    finally { this.busy = false; }
  }

  renderReview() {
    const body = this.host.querySelector('[data-body]'), meta = this.parsed;
    body.innerHTML = `<div class="invoice-summary"><div><strong>${meta.items.length} item(ns) reconhecido(s)</strong><small>${escape(meta.source_name)}${meta.supplier?` · ${escape(meta.supplier)}`:''}</small></div><button type="button" class="invoice-secondary" data-change>Escolher outro arquivo</button></div><p class="invoice-hint">Confira principalmente o tipo, o lote, a validade e o estoque mínimo. Os avisos de fim de estoque e vencimento usam esses campos.</p><div class="invoice-table-wrap"><table class="invoice-table"><thead><tr><th><input class="invoice-check" type="checkbox" data-toggle-all checked aria-label="Selecionar todos"></th><th>Item</th><th>Tipo</th><th>Qtd.</th><th>Unidade</th><th>Estoque mínimo</th><th>Lote</th><th>Validade</th><th>Valor unit.</th></tr></thead><tbody>${meta.items.map((item,index)=>this.itemRow(item,index)).join('')}</tbody></table></div><div class="invoice-actions"><div class="invoice-select-actions"><button type="button" data-select-all>Selecionar todos</button><button type="button" data-clear-all>Desmarcar todos</button></div><div><button type="button" class="invoice-primary" data-import>Importar itens selecionados</button></div></div><p class="invoice-status" role="status" data-status></p>`;
    body.querySelector('[data-change]').onclick = () => this.renderUpload();
    body.querySelector('[data-toggle-all]').onchange = event => this.toggleAll(event.target.checked);
    body.querySelector('[data-select-all]').onclick = () => this.toggleAll(true);
    body.querySelector('[data-clear-all]').onclick = () => this.toggleAll(false);
    body.querySelector('[data-import]').onclick = () => this.importRows();
  }

  itemRow(item, index) {
    return `<tr data-row="${index}"><td><input class="invoice-check" type="checkbox" name="selected" checked aria-label="Importar ${escape(item.name)}"></td><td><input class="invoice-name" name="name" required maxlength="160" value="${escape(item.name)}"></td><td><select name="category">${Object.entries(categories).map(([value,label])=>`<option value="${value}" ${item.category===value?'selected':''}>${label}</option>`).join('')}</select></td><td><input name="quantity" type="number" min="0" step="0.01" value="${escape(item.quantity)}"></td><td><input name="unit" maxlength="30" value="${escape(item.unit||'un')}"></td><td><input name="minimum_quantity" type="number" min="0" step="0.01" value="${escape(item.minimum_quantity??1)}"></td><td><input name="lot_code" maxlength="120" value="${escape(item.lot_code||'')}"></td><td><input name="expires_on" type="date" value="${escape(item.expires_on||'')}"></td><td><input name="unit_price" type="number" min="0" step="0.01" value="${escape(money(item.unit_price))}"></td></tr>`;
  }

  toggleAll(checked) {
    this.host.querySelectorAll('tbody [name="selected"]').forEach(input => { input.checked = checked; });
    const toggle = this.host.querySelector('[data-toggle-all]'); if (toggle) toggle.checked = checked;
  }

  payloads() {
    return [...this.host.querySelectorAll('tbody [data-row]')].flatMap(row => {
      if (!row.querySelector('[name="selected"]').checked) return [];
      const index = Number(row.dataset.row), source = this.parsed.items[index], value = name => row.querySelector(`[name="${name}"]`).value;
      const optionalNumber = name => value(name) === '' ? null : Number(value(name));
      return [{
        clinic_id: this.clinicId, created_by: this.profileId, invoice_key: this.parsed.invoice_key,
        invoice_item_number: source.invoice_item_number, invoice_source_name: this.parsed.source_name, product_code: source.product_code,
        name: value('name').trim(), category: value('category'), quantity: Number(value('quantity')), unit: value('unit').trim() || 'un',
        minimum_quantity: Number(value('minimum_quantity')), lot_code: value('lot_code').trim(), expires_on: value('expires_on') || null,
        unit_price: optionalNumber('unit_price'), supplier: source.supplier || this.parsed.supplier, purchased_on: source.purchased_on || this.parsed.purchased_on
      }];
    });
  }

  async importRows() {
    const status = this.host.querySelector('[data-status]'), button = this.host.querySelector('[data-import]'), payloads = this.payloads();
    if (!payloads.length) { status.textContent = 'Selecione pelo menos um item.'; status.className = 'invoice-status error'; return; }
    const invalid = payloads.find(item => item.name.length < 2 || !categories[item.category] || ![item.quantity,item.minimum_quantity,item.unit_price??0].every(value => Number.isFinite(value) && value >= 0));
    if (invalid) { status.textContent = 'Confira nome, tipo, quantidade, estoque mínimo e valor dos itens selecionados.'; status.className = 'invoice-status error'; return; }
    this.busy = true; button.disabled = true; button.textContent = 'Importando…'; status.textContent = `Salvando ${payloads.length} item(ns) no estoque…`; status.className = 'invoice-status';
    try {
      const imported = [];
      for (let offset = 0; offset < payloads.length; offset += 100) {
        const batch = payloads.slice(offset, offset + 100);
        const { data, error } = await supabase.from('stock_items').upsert(batch, { onConflict:'clinic_id,invoice_key,invoice_item_number', ignoreDuplicates:true }).select(STOCK_FIELDS);
        if (error) throw error;
        imported.push(...(data || []));
      }
      if (this.disposed) return;
      const duplicates = payloads.length - imported.length;
      status.textContent = `${imported.length} item(ns) importado(s)${duplicates?` e ${duplicates} já existente(s) ignorado(s)`:''}. Os avisos de estoque e validade foram atualizados.`;
      status.className = 'invoice-status success'; button.textContent = 'Concluído';
      await this.onImported?.({ imported: imported.length, duplicates });
      const actions = this.host.querySelector('.invoice-actions');
      actions.innerHTML = '<button type="button" class="invoice-primary" data-done>Fechar e ver estoque</button>';
      actions.querySelector('[data-done]').onclick = () => this.destroy();
    } catch (error) {
      status.textContent = `Não foi possível importar: ${error.message || 'tente novamente.'}`; status.className = 'invoice-status error';
      button.disabled = false; button.textContent = 'Tentar importar novamente';
    } finally { this.busy = false; }
  }

  destroy() {
    this.disposed = true; document.removeEventListener('keydown', this.keydown); this.host?.remove(); this.host = null;
  }
}
