import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as alerts from '../stock-alerts.js';

const source = (await readFile(new URL('../catalog-manager.js', import.meta.url),'utf8'))
  .replace(/^import .*;\n/gm,'').replace('export class CatalogManager','class CatalogManager') + '\nglobalThis.CatalogManager=CatalogManager;';
const deferred = () => { let resolve; const promise=new Promise(done=>{resolve=done;}); return {promise,resolve}; };
const flush = () => new Promise(done=>setImmediate(done));

function createManager({medications,stock}) {
  const query={select(){return this;},eq(){return this;},order(){return medications.promise;}};
  const context={...alerts,supabase:{from:()=>query},STOCK_FIELDS:'id,name',loadClinicStock:()=>stock.promise,document:{removeEventListener(){}}};
  vm.runInNewContext(source,context,{filename:'catalog-manager.js'});
  const manager=new context.CatalogManager({clinicId:'clinic-a',profileId:'profile-a'});
  manager.render=()=>{};manager.setControls=()=>{};manager.paintRows=()=>{};manager.paintAlerts=()=>{};manager.showFeedback=message=>{manager.feedback=message;};
  return manager;
}

test('resposta atrasada de medicamentos não substitui os produtos após trocar de aba', async () => {
  const medications=deferred(),stock=deferred(),manager=createManager({medications,stock});
  const oldRequest=manager.load();
  manager.rows=[{display_name:'Nome anterior'}];
  manager.switchType('stock');
  assert.equal(manager.rows.length,0);
  assert.equal(manager.ready,false);
  assert.equal(manager.canSave(),false);
  stock.resolve([{id:'stock-a',name:'Luvas',quantity:0,minimum_quantity:2}]);
  await flush();
  assert.equal(manager.ready,true);
  assert.equal(manager.rows[0].name,'Luvas');
  medications.resolve({data:[{display_name:'Medicamento antigo'}],error:null});
  await oldRequest;
  assert.equal(manager.type,'stock');
  assert.equal(manager.rows[0].id,'stock-a');
});

test('troca de aba é bloqueada durante gravação e falha de leitura mantém cadastro bloqueado', async () => {
  const medications=deferred(),stock=deferred(),manager=createManager({medications,stock});
  manager.busy=true;manager.switchType('stock');assert.equal(manager.type,'medication');
  manager.busy=false;
  const request=manager.load();medications.resolve({data:null,error:{message:'Sem conexão'}});await request;
  assert.equal(manager.loading,false);assert.equal(manager.canSave(),false);
});

test('destroy impede que uma leitura pendente atualize uma tela já fechada', async () => {
  const medications=deferred(),stock=deferred(),manager=createManager({medications,stock});
  const request=manager.load();manager.destroy();medications.resolve({data:[{display_name:'Antigo'}],error:null});await request;
  assert.equal(manager.rows.length,0);assert.equal(manager.ready,false);
});
