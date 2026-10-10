import { loadClinicStock } from './stock-store.js';
import { clinicDay, stockSummary, stockAlertLabels } from './stock-alerts.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

export class StockAlertPanel {
  constructor(clinicId) {
    this.clinicId = clinicId;
    this.disposed = false;
    this.loading = false;
    this.onVisibility = () => { if (!document.hidden) this.load(); };
  }

  mount(host) {
    this.host = host;
    this.host.innerHTML = '<p class="search-feedback" role="status">Carregando avisos de estoque e validade…</p>';
    document.addEventListener('visibilitychange', this.onVisibility);
    this.load();
  }

  async load() {
    if (this.disposed || this.loading) return;
    this.loading = true;
    try {
      const rows = await loadClinicStock(this.clinicId);
      if (this.disposed || !this.host.isConnected) return;
      const today = clinicDay(), counts = stockSummary(rows, today);
      const flagged = rows.filter(row => stockAlertLabels(row, today).length).sort((a, b) => {
        const score = row => { const labels = stockAlertLabels(row, today); return labels.some(label => label.tone === 'danger') ? 0 : 1; };
        return score(a) - score(b) || a.name.localeCompare(b.name, 'pt-BR');
      });
      this.host.innerHTML = `<style>
        .stock-overview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}
        .stock-overview-grid a{display:grid;gap:5px;padding:14px;border:1px solid #e1e8ed;border-radius:12px;text-decoration:none;background:#fbfdfe;color:#415967}
        .stock-overview-grid a:focus-visible{outline:3px solid #2680b355}.stock-overview-grid strong{font-size:23px;color:#263b48}.stock-overview-grid span{font-size:12px;line-height:1.4}
        .stock-overview-grid a.warning{background:#fff9ee;border-color:#efdab0}.stock-overview-grid a.danger{background:#fff4f2;border-color:#efc6bf}
        .stock-overview-items{display:grid;gap:9px;margin:12px 0}.stock-overview-items p{display:grid;gap:4px;font-size:13px;margin:0}.stock-overview-items small{color:#7d5644;font-size:11px}
        @media(max-width:600px){.stock-overview-grid{grid-template-columns:1fr}.stock-overview-grid a{grid-template-columns:36px 1fr;align-items:center}}
      </style><div class="card-title"><div><h2>Estoque e validade</h2></div><a class="link" href="#/catalog/stock">Ver estoque</a></div>
        <div class="stock-overview-grid">
          ${[['replenish', 'Precisam de reposição', 'warning'], ['expired', 'Lotes vencidos', 'danger'], ['expiring', 'Vencem em até 30 dias', 'warning']].map(([key, label, tone]) => `<a href="#/catalog/stock/${key}" class="${counts[key] ? tone : ''}"><strong>${counts[key]}</strong><span>${label}</span></a>`).join('')}
        </div>
        ${flagged.length ? `<div class="stock-overview-items">${flagged.slice(0, 3).map(row => `<p><b>${escape(row.name)}${row.lot_code ? ` · Lote ${escape(row.lot_code)}` : ''}</b><small>${escape(stockAlertLabels(row, today).map(label => label.text).join(' · '))}</small></p>`).join('')}</div>${flagged.length > 3 ? `<p class="search-feedback">Mais ${flagged.length - 3} item(ns) com avisos no estoque.</p>` : ''}`
          : `<p class="search-feedback">${rows.length ? 'Nenhum aviso de reposição ou validade no momento.' : 'Cadastre quantidades, estoque mínimo e validade para acompanhar os avisos.'}</p>`}
        <p class="search-feedback">Avisos de validade consideram os lotes com quantidade em estoque.</p>`;
    } catch (error) {
      if (!this.disposed && this.host.isConnected) {
        this.host.innerHTML = '<div class="card-title"><h2>Estoque e validade</h2><a class="link" href="#/catalog/stock">Abrir estoque</a></div><p class="search-feedback" role="status">Não foi possível carregar os avisos. <button class="link" type="button" data-retry-stock>Tentar novamente</button></p>';
        this.host.querySelector('[data-retry-stock]').onclick = () => this.load();
      }
    } finally {
      this.loading = false;
    }
  }

  destroy() {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
