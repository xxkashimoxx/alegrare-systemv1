export const EXPIRY_WARNING_DAYS = 30;

export function clinicDay(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(reference);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function stockAlerts(row, today = clinicDay()) {
  const quantity = Number(row.quantity), minimum = Number(row.minimum_quantity);
  const stock = Number.isFinite(quantity)
    ? quantity <= 0 ? 'empty' : Number.isFinite(minimum) && quantity <= minimum ? 'low' : null
    : null;
  const expiryTime = dateTime(row.expires_on), todayTime = dateTime(today);
  const daysToExpiry = expiryTime !== null && todayTime !== null
    ? Math.round((expiryTime - todayTime) / 86400000) : null;
  const expiry = Number.isFinite(quantity) && quantity > 0 && daysToExpiry !== null
    ? daysToExpiry < 0 ? 'expired' : daysToExpiry <= EXPIRY_WARNING_DAYS ? 'expiring' : null
    : null;
  return { stock, expiry, daysToExpiry };
}

export function stockSummary(rows, today = clinicDay()) {
  return rows.reduce((counts, row) => {
    const alert = stockAlerts(row, today);
    if (alert.stock) counts.replenish++;
    if (alert.expiry) counts[alert.expiry]++;
    if (alert.stock || alert.expiry) counts.total++;
    return counts;
  }, { replenish: 0, expired: 0, expiring: 0, total: 0 });
}

export function matchesStockAlert(row, filter, today = clinicDay()) {
  const alert = stockAlerts(row, today);
  return filter === 'all' || (filter === 'replenish' ? Boolean(alert.stock) : alert.expiry === filter);
}

export function stockAlertLabels(row, today = clinicDay()) {
  const alert = stockAlerts(row, today), labels = [];
  if (alert.stock === 'empty') labels.push({ tone: 'danger', text: 'Estoque zerado' });
  if (alert.stock === 'low') labels.push({ tone: 'warning', text: 'Estoque no mínimo ou abaixo' });
  if (alert.expiry === 'expired') labels.push({ tone: 'danger', text: 'Validade vencida' });
  if (alert.expiry === 'expiring') labels.push({ tone: 'warning', text: alert.daysToExpiry === 0
    ? 'Vence hoje' : alert.daysToExpiry === 1 ? 'Vence amanhã' : `Vence em ${alert.daysToExpiry} dias` });
  return labels;
}

export function stockDateLabel(value) {
  return dateTime(value) === null ? 'Não informada' : value.split('-').reverse().join('/');
}

export function stockNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
