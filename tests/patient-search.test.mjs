import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {patientDisplayName,patientMatches} from '../clinic-search.js';

test('nome social aparece primeiro e busca inclui nome legal, social e telefone',()=>{
  const patient={full_name:'Maria da Conceição',social_name:'Dani Coelho',phone:'(11) 98765-4321'};
  assert.equal(patientDisplayName(patient),'Dani Coelho');
  assert.equal(patientMatches('dáni',patient),true);
  assert.equal(patientMatches('conceicao',patient),true);
  assert.equal(patientMatches('98765',patient),true);
  assert.equal(patientMatches('desconhecido',patient),false);
});
