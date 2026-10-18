import test from 'node:test';
import assert from 'node:assert/strict';
import { inferInvoiceCategory, invoiceDate, invoiceNumber, parseInvoiceCsv, parseNfeXml, parseDanfeText } from '../invoice-parser.js';

test('lê itens, fornecedor, lote e validade do XML de NF-e', () => {
  const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe12345678901234567890123456789012345678901234"><ide><dhEmi>2026-10-18T10:00:00-03:00</dhEmi></ide><emit><xNome>Dental &amp; Cia</xNome></emit><det nItem="1"><prod><cProd>ABC1</cProd><xProd>Lidocaína 2%</xProd><uCom>CX</uCom><qCom>2.0000</qCom><vUnCom>45.90</vUnCom><med><cProdANVISA>123</cProdANVISA></med><rastro><nLote>L-10</nLote><qLote>2.000</qLote><dVal>2027-04-30</dVal></rastro></prod></det></infNFe></NFe><protNFe><infProt><chNFe>12345678901234567890123456789012345678901234</chNFe></infProt></protNFe></nfeProc>`;
  const parsed = parseNfeXml(xml, 'compra.xml');
  assert.equal(parsed.invoice_key, '12345678901234567890123456789012345678901234');
  assert.equal(parsed.supplier, 'Dental & Cia');
  assert.equal(parsed.purchased_on, '2026-10-18');
  assert.deepEqual(parsed.items.map(({ name, category, quantity, unit_price, lot_code, expires_on }) => ({ name, category, quantity, unit_price, lot_code, expires_on })), [
    { name:'Lidocaína 2%', category:'medication', quantity:2, unit_price:45.9, lot_code:'L-10', expires_on:'2027-04-30' }
  ]);
});

test('lê CSV brasileiro e mantém números decimais', () => {
  const csv = 'Código;Descrição;Quantidade;Unidade;Valor unitário;Lote;Validade;Fornecedor\n1;Luva nitrílica;10,5;CX;25,90;A1;31/12/2027;Dental Sul';
  const parsed = parseInvoiceCsv(csv, 'itens.csv');
  assert.equal(parsed.items[0].name, 'Luva nitrílica');
  assert.equal(parsed.items[0].category, 'supply');
  assert.equal(parsed.items[0].quantity, 10.5);
  assert.equal(parsed.items[0].unit_price, 25.9);
  assert.equal(parsed.items[0].expires_on, '2027-12-31');
});

test('normaliza datas e valores e rejeita datas impossíveis', () => {
  assert.equal(invoiceNumber('1.234,56'), 1234.56);
  assert.equal(invoiceNumber('12.34'), 12.34);
  assert.equal(invoiceDate('18/10/2026'), '2026-10-18');
  assert.equal(invoiceDate('31/02/2026'), null);
  assert.equal(inferInvoiceCategory('Álcool 70%'), 'cleaning');
});

test('reconhece uma linha textual de DANFE PDF', () => {
  const parsed = parseDanfeText(['001 LUVA NITRILICA AZUL 40151900 5102 UN 20,0000 1,50 30,00'], 'danfe.pdf');
  assert.equal(parsed.items[0].name, 'LUVA NITRILICA AZUL');
  assert.equal(parsed.items[0].quantity, 20);
  assert.equal(parsed.items[0].unit_price, 1.5);
});
