import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicDay, stockAlerts, stockSummary, matchesStockAlert, stockAlertLabels, stockDateLabel, stockNumber } from '../stock-alerts.js';

const today = '2026-10-10';
const item = overrides => ({ quantity: 10, minimum_quantity: 2, expires_on: null, ...overrides });

test('reposição inclui estoque zerado e o limite mínimo, inclusive quantidades decimais', () => {
  for (const [quantity, minimum_quantity, expected] of [[0,0,'empty'],[0,5,'empty'],[2,2,'low'],['1.25','1.50','low'],[3,2,null],[5,0,null],['invalid',2,null]]) {
    assert.equal(stockAlerts(item({ quantity, minimum_quantity }), today).stock, expected);
  }
  assert.equal(stockNumber(0), '0');
});

test('validade distingue vencido, hoje, amanhã e a janela inclusiva de 30 dias', () => {
  for (const [expires_on, days, expected] of [['2026-10-09',-1,'expired'],['2026-10-10',0,'expiring'],['2026-10-11',1,'expiring'],['2026-11-09',30,'expiring'],['2026-11-10',31,null]]) {
    const alert = stockAlerts(item({ expires_on }), today);
    assert.equal(alert.daysToExpiry, days);
    assert.equal(alert.expiry, expected);
  }
  assert.equal(stockAlertLabels(item({ expires_on: today }), today)[0].text, 'Vence hoje');
  assert.equal(stockAlertLabels(item({ expires_on: '2026-10-11' }), today)[0].text, 'Vence amanhã');
});

test('lotes sem saldo ou sem data válida não geram aviso de validade', () => {
  for (const overrides of [{ quantity:0, expires_on:'2026-10-09' },{ expires_on:null },{ expires_on:'2026-02-30' },{ expires_on:'invalid' },{ quantity:Infinity, expires_on:today }]) {
    assert.equal(stockAlerts(item(overrides), today).expiry, null);
  }
  assert.equal(stockDateLabel('2026-10-10'), '10/10/2026');
  assert.equal(stockDateLabel('2026-02-30'), 'Não informada');
});

test('data da clínica usa São Paulo e diferenças de dias independem do horário do navegador', () => {
  assert.equal(clinicDay(new Date('2026-10-10T01:00:00Z')), '2026-10-09');
  assert.equal(clinicDay(new Date('2026-10-10T03:00:00Z')), '2026-10-10');
  assert.equal(stockAlerts(item({ expires_on:'2028-03-01' }), '2028-02-28').daysToExpiry, 2);
});

test('resumo não duplica itens com dois avisos e filtros preservam cada motivo', () => {
  const rows = [item({ quantity:1,expires_on:'2026-10-09' }),item({ quantity:0 }),item({ expires_on:'2026-10-11' }),item({ expires_on:'2026-12-01' })];
  assert.deepEqual(stockSummary(rows,today), { replenish:2,expired:1,expiring:1,total:3 });
  assert.equal(rows.filter(row=>matchesStockAlert(row,'replenish',today)).length, 2);
  assert.equal(rows.filter(row=>matchesStockAlert(row,'expired',today)).length, 1);
  assert.equal(rows.filter(row=>matchesStockAlert(row,'expiring',today)).length, 1);
  assert.equal(rows.filter(row=>matchesStockAlert(row,'all',today)).length, 4);
});
