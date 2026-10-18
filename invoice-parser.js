const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(value = '') {
  return String(value).replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, numeric, named) => {
    if (named) return XML_ENTITIES[named.toLowerCase()];
    const base = numeric[0].toLowerCase() === 'x' ? 16 : 10;
    return String.fromCodePoint(parseInt(numeric.replace(/^x/i, ''), base));
  }).trim();
}

function tagText(xml, tag) {
  const match = String(xml).match(new RegExp(`<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, 'i'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '')) : '';
}

function blocks(xml, tag) {
  const result = [], pattern = new RegExp(`<(?:(?:\\w+):)?${tag}\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, 'gi');
  let match;
  while ((match = pattern.exec(String(xml)))) result.push({ attributes: match[1], content: match[2] });
  return result;
}

export function invoiceNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim().replace(/\s/g, '');
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '');
  const number = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

export function invoiceDate(value) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  const result = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : br ? `${br[3]}-${br[2]}-${br[1]}` : null;
  if (!result) return null;
  const time = Date.parse(`${result}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === result ? result : null;
}

export function inferInvoiceCategory(name, hasMedicationDetails = false) {
  if (hasMedicationDetails) return 'medication';
  const text = String(name || '').toLocaleLowerCase('pt-BR');
  if (/(^|\s)(mg|mcg|comprimido|cápsula|capsula|ampola|medicamento|anestésico|anestesico|antibiótico|antibiotico|dipirona|lidocaína|lidocaina)(\s|$)/.test(text)) return 'medication';
  if (/(^|\s)(luva|máscara|mascara|gaze|seringa|agulha|algodão|algodao|sugador|touca|avental)(\s|$)/.test(text)) return 'supply';
  if (/(^|\s)(desinfetante|detergente|álcool|alcool|sabão|sabao|limpeza|papel toalha)(\s|$)/.test(text)) return 'cleaning';
  if (/(^|\s)(broca|espelho|pinça|pinca|instrumento|moldeira)(\s|$)/.test(text)) return 'material';
  return 'product';
}

const xmlNumber = value => {
  const number = Number(String(value || '').trim());
  return Number.isFinite(number) ? number : null;
};

export function parseNfeXml(text, sourceName = 'nota-fiscal.xml') {
  if (!/<(?:(?:\w+):)?(?:NFe|nfeProc)\b/i.test(text)) throw new Error('O XML selecionado não parece ser uma NF-e válida.');
  const infNfe = blocks(text, 'infNFe')[0];
  const id = infNfe?.attributes.match(/\bId=["']NFe(\d{44})["']/i)?.[1] || '';
  const invoiceKey = tagText(text, 'chNFe') || id || null;
  const supplier = tagText(blocks(text, 'emit')[0]?.content || '', 'xNome') || null;
  const purchasedOn = invoiceDate(tagText(text, 'dhEmi') || tagText(text, 'dEmi'));
  const items = blocks(text, 'det').flatMap((det, detIndex) => {
    const prod = blocks(det.content, 'prod')[0]?.content || det.content;
    const name = tagText(prod, 'xProd');
    if (!name) return [];
    const medication = blocks(prod, 'med')[0]?.content || blocks(det.content, 'med')[0]?.content || '';
    const traces = blocks(prod, 'rastro');
    const base = {
      name, product_code: tagText(prod, 'cProd') || null,
      category: inferInvoiceCategory(name, Boolean(medication)), unit: tagText(prod, 'uCom') || 'un',
      quantity: xmlNumber(tagText(prod, 'qCom')) ?? 0,
      minimum_quantity: 1, unit_price: xmlNumber(tagText(prod, 'vUnCom')),
      supplier, purchased_on: purchasedOn, lot_code: '', expires_on: null,
      source_item_number: Number(det.attributes.match(/\bnItem=["'](\d+)["']/i)?.[1]) || detIndex + 1
    };
    if (!traces.length) return [base];
    return traces.map(trace => ({
      ...base,
      quantity: xmlNumber(tagText(trace.content, 'qLote')) ?? base.quantity,
      lot_code: tagText(trace.content, 'nLote'),
      expires_on: invoiceDate(tagText(trace.content, 'dVal'))
    }));
  }).map((item, index) => ({ ...item, invoice_item_number: index + 1 }));
  if (!items.length) throw new Error('Não encontrei itens no XML da NF-e.');
  return { format: 'xml', invoice_key: invoiceKey, supplier, purchased_on: purchasedOn, source_name: sourceName, items };
}

function parseCsvRows(text, delimiter) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++;
      row.push(value.trim()); value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

const cleanHeader = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseInvoiceCsv(text, sourceName = 'nota-fiscal.csv') {
  const first = String(text).split(/\r?\n/, 1)[0] || '';
  const delimiter = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = parseCsvRows(String(text).replace(/^\uFEFF/, ''), delimiter);
  if (rows.length < 2) throw new Error('A planilha precisa ter um cabeçalho e pelo menos um item.');
  const headers = rows[0].map(cleanHeader), find = (...aliases) => headers.findIndex(header => aliases.includes(header));
  const columns = {
    name: find('produto','descricao','descricaodoproduto','nome','item'), quantity: find('quantidade','qtd','qtde'),
    unit: find('unidade','un','ucom'), price: find('valorunitario','precounitario','preco','vuncom'),
    lot: find('lote','numerodolote','nrolote'), expiry: find('validade','datadevalidade','dval'),
    code: find('codigo','codigodoproduto','cprod','sku'), category: find('categoria','tipo'),
    supplier: find('fornecedor','emitente'), purchased: find('datadecompra','emissao','dataemissao'), minimum: find('estoqueminimo','minimo')
  };
  if (columns.name < 0) throw new Error('Não encontrei uma coluna de produto, descrição ou nome no CSV.');
  const validCategories = new Set(['product','supply','cleaning','material','medication']);
  const items = rows.slice(1).flatMap((row, index) => {
    const name = String(row[columns.name] || '').trim(); if (!name) return [];
    const categoryValue = columns.category >= 0 ? cleanHeader(row[columns.category]) : '';
    return [{
      name, product_code: columns.code >= 0 ? row[columns.code] || null : null,
      category: validCategories.has(categoryValue) ? categoryValue : inferInvoiceCategory(name),
      unit: columns.unit >= 0 ? row[columns.unit] || 'un' : 'un', quantity: columns.quantity >= 0 ? invoiceNumber(row[columns.quantity]) ?? 0 : 0,
      minimum_quantity: columns.minimum >= 0 ? invoiceNumber(row[columns.minimum]) ?? 1 : 1,
      unit_price: columns.price >= 0 ? invoiceNumber(row[columns.price]) : null,
      lot_code: columns.lot >= 0 ? row[columns.lot] || '' : '', expires_on: columns.expiry >= 0 ? invoiceDate(row[columns.expiry]) : null,
      supplier: columns.supplier >= 0 ? row[columns.supplier] || null : null, purchased_on: columns.purchased >= 0 ? invoiceDate(row[columns.purchased]) : null,
      source_item_number: index + 1, invoice_item_number: index + 1
    }];
  });
  if (!items.length) throw new Error('Não encontrei itens preenchidos no CSV.');
  return { format: 'csv', invoice_key: null, supplier: items.find(item => item.supplier)?.supplier || null, purchased_on: items.find(item => item.purchased_on)?.purchased_on || null, source_name: sourceName, items };
}

export function parseDanfeText(lines, sourceName = 'danfe.pdf') {
  const items = [];
  for (const raw of lines) {
    const line = String(raw).replace(/\s+/g, ' ').trim();
    const marker = line.match(/\b(\d{8})\s+(\d{4})\b/);
    if (!marker) continue;
    const before = line.slice(0, marker.index).trim(), after = line.slice(marker.index + marker[0].length).trim();
    const firstSpace = before.indexOf(' '); if (firstSpace < 1) continue;
    const productCode = before.slice(0, firstSpace), name = before.slice(firstSpace + 1).trim();
    const tokens = after.split(' '), unitIndex = tokens.findIndex(token => /^(UN|UND|PC|PÇ|CX|FR|AMP|KG|G|L|ML|RL|PCT|KIT)$/i.test(token));
    if (name.length < 2 || unitIndex < 0) continue;
    const numbers = tokens.slice(unitIndex + 1).map(invoiceNumber).filter(value => value !== null);
    if (!numbers.length) continue;
    items.push({
      name, product_code: productCode, category: inferInvoiceCategory(name), unit: tokens[unitIndex], quantity: numbers[0] ?? 0,
      minimum_quantity: 1, unit_price: numbers[1] ?? null, lot_code: '', expires_on: null, supplier: null, purchased_on: null,
      source_item_number: items.length + 1, invoice_item_number: items.length + 1
    });
  }
  if (!items.length) throw new Error('Não consegui reconhecer os itens deste PDF. Prefira o XML da NF-e ou exporte uma planilha CSV.');
  return { format: 'pdf', invoice_key: null, supplier: null, purchased_on: null, source_name: sourceName, items };
}

async function parsePdf(buffer, sourceName) {
  const pdfjs = await import('https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise, lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber), content = await page.getTextContent(), groups = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform?.[5] || 0), x = item.transform?.[4] || 0;
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push({ x, text: item.str });
    }
    [...groups.entries()].sort((a,b) => b[0] - a[0]).forEach(([, parts]) => lines.push(parts.sort((a,b) => a.x - b.x).map(part => part.text).join(' ')));
  }
  return parseDanfeText(lines, sourceName);
}

async function fingerprint(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function parseInvoiceFile(file) {
  if (!file) throw new Error('Selecione uma nota fiscal.');
  if (file.size > 15 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 15 MB.');
  const buffer = await file.arrayBuffer(), extension = String(file.name || '').split('.').pop().toLowerCase();
  let parsed;
  if (extension === 'pdf' || file.type === 'application/pdf') parsed = await parsePdf(buffer, file.name);
  else {
    const text = new TextDecoder('utf-8').decode(buffer);
    parsed = extension === 'xml' || /xml/i.test(file.type) || /<(?:(?:\w+):)?(?:NFe|nfeProc)\b/i.test(text)
      ? parseNfeXml(text, file.name) : parseInvoiceCsv(text, file.name);
  }
  parsed.invoice_key ||= `arquivo-${await fingerprint(buffer)}`;
  return parsed;
}
