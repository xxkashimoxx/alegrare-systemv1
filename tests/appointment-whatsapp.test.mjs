import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {appointmentConfirmationUrl,patientWhatsappNumber} from '../appointment-whatsapp.js';

test('usa o número brasileiro cadastrado sem duplicar o DDI',()=>{
  assert.equal(patientWhatsappNumber('(21) 99413-3062'),'5521994133062');
  assert.equal(patientWhatsappNumber('+55 21 99413-3062'),'5521994133062');
  assert.equal(patientWhatsappNumber('123'),'');
});

test('prepara mensagem com data, horário de Brasília e procedimento salvos',()=>{
  const url=appointmentConfirmationUrl({starts_at:'2026-10-06T18:30:00Z',procedure_name:'Avaliação odontológica'},{phone:'(21) 99999-1234',full_name:'Maria',social_name:'Mara'});
  assert.equal(new URL(url).pathname,'/5521999991234');
  const message=new URL(url).searchParams.get('text');
  assert.match(message,/Olá, Mara!/);
  assert.match(message,/06\/10\/2026, às 15:30 \(horário de Brasília\)/);
  assert.match(message,/Procedimento: Avaliação odontológica/);
  assert.equal(appointmentConfirmationUrl({starts_at:'2026-10-06T18:30:00Z'},{phone:''}),'');
});
