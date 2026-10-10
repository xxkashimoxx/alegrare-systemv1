import { patientWhatsappNumber } from './appointment-whatsapp.js';

export function documentWhatsappNumber(phone) {
  const value=String(phone || '').trim();
  if(value.startsWith('+')&&!value.startsWith('+55'))return '';
  return patientWhatsappNumber(value);
}

export function documentSigningLink(token, pageUrl) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')) return '';
  const url = new URL(pageUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return '';
  url.search = '';
  url.hash = `/assinar/${token}`;
  return url.href;
}

export function documentWhatsappUrl({ token, phone, patientName, title, signed = false, pageUrl }) {
  const number = documentWhatsappNumber(phone);
  if (!number) return '';
  const link = documentSigningLink(token, pageUrl);
  if (!link) return '';
  const name = String(patientName || '').replace(/\s+/g, ' ').trim();
  const documentTitle = String(title || 'Documento').replace(/\s+/g, ' ').trim();
  const message = `Olá${name ? `, ${name}` : ''}! A Alegrare disponibilizou o documento “${documentTitle}” para sua leitura${signed ? '' : ' e assinatura'}.\nAcesse seu link individual: ${link}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
