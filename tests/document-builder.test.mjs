import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../document-builder.js',import.meta.url),'utf8');
const {anamnesisBody}=await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('documento de anamnese inclui perguntas respondidas sem publicar campos internos',()=>{
  const answers=[{question:'Tem alergias?',answer:'Sim, conforme resposta declarada',source_row:1,alert:'Uso interno'}, {question:'Medicação',answer:['Informada','Revisada']}];
  const body=anamnesisBody(answers);
  assert.match(body,/Tem alergias\?\nResposta: Sim, conforme resposta declarada/);
  assert.match(body,/Medicação\nResposta: \["Informada","Revisada"\]/);
  assert.doesNotMatch(body,/Uso interno|source_row|alert/);
});

test('não usa objetos sem pergunta como conteúdo de assinatura',()=>{
  assert.equal(anamnesisBody([{answer:'Campo sem pergunta',internal_note:'Não divulgar'}]),'');
  assert.equal(anamnesisBody(null),'');
});
