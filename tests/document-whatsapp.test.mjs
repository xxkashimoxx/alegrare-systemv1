import test from 'node:test';
import assert from 'node:assert/strict';
import { documentSigningLink, documentWhatsappUrl } from '../document-whatsapp.js';

const token='87b2e903-c7ec-4e59-9449-636c6ad1f7f9';
const pageUrl='https://painel-alegrare.vercel.app/?busca=interno#/documents';
const document={token,phone:'+55 (21) 99900-1234',patientName:'Paciente de teste',title:'Termo de consentimento',pageUrl};

test('WhatsApp recebe o número cadastrado e o link individual do documento, sem parâmetros internos',()=>{
  const url=new URL(documentWhatsappUrl(document));
  assert.equal(url.origin,'https://wa.me');
  assert.equal(url.pathname,'/5521999001234');
  const message=url.searchParams.get('text');
  assert.match(message,/Olá, Paciente de teste!/);
  assert.match(message,/Termo de consentimento/);
  assert.match(message,/leitura e assinatura/);
  assert.ok(message.includes(`https://painel-alegrare.vercel.app/#/assinar/${token}`));
  assert.doesNotMatch(message,/busca=|#\/documents/);
  assert.equal(documentWhatsappUrl({...document,phone:'(21) 99900-1234'}),documentWhatsappUrl(document));
});

test('telefone ausente ou inválido e token inválido nunca geram um destino de envio',()=>{
  for(const phone of ['',null,'123','+1 212 999 1234'])assert.equal(documentWhatsappUrl({...document,phone}),'');
  assert.equal(documentWhatsappUrl({...document,token:'documento-sem-token'}),'');
  assert.equal(documentSigningLink(token,'javascript:alert(1)'),'');
});

test('reenvio preserva o token e não pede nova assinatura de um documento já assinado',()=>{
  const message=new URL(documentWhatsappUrl({...document,signed:true})).searchParams.get('text');
  assert.match(message,/para sua leitura\./);
  assert.doesNotMatch(message,/leitura e assinatura/);
  assert.ok(message.includes(token));
});
