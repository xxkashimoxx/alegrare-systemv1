import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as whatsapp from '../document-whatsapp.js';

const source=(await readFile(new URL('../document-signing.js',import.meta.url),'utf8'))
  .split('const observer=new MutationObserver')[0].replace(/^import .*;\n/gm,'');
const patient={id:'patient-a',full_name:'Paciente A',phone:'(21) 99900-1234',email:'',source_payload:{}};
const otherPatient={id:'patient-b',full_name:'Paciente B',phone:'(21) 99900-5678',source_payload:{}};

function element(value=''){return {value,disabled:false,hidden:false,textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};}
function makeForm(){
  const save=element(),send=element(),contact=element(),hint=element(),feedback=element(),preview=element();
  const elements={patient:element(patient.id),title:element('Termo de teste'),signers:element('patient'),patientSignerName:element('Paciente A'),file:{files:[{name:'termo.pdf',type:'application/pdf',size:200}]},body:element('Texto do termo de consentimento para teste.'),responsibleName:element(),responsibleDocument:element(),accompanied:{checked:false}};
  elements.patient.selectedOptions=[{dataset:{name:patient.full_name,phone:patient.phone,email:patient.email}}];
  const nodes={'#real-upload-submit':save,'[data-document-contact]':contact,'[data-document-send-whatsapp]':send,'[data-whatsapp-contact]':hint,'[data-create-feedback]':feedback,'[data-patient-preview]':preview};
  return {elements,dataset:{},save,send,contact,hint,feedback,preview,listeners:{},querySelector(selector){return nodes[selector];},querySelectorAll(selector){return selector==='[name="signers"]'?[elements.signers]:[save,send];},addEventListener(name,fn){this.listeners[name]=fn;}};
}

function harness({failSigners=false,popupBlocked=false}={}){
  const events=[],documents=[],signers=[],messages=[],form=makeForm();
  const target={closed:false,document:{body:{}},location:{replace(url){events.push(['navigate',url]);}},close(){this.closed=true;events.push(['popup-close']);}};
  class Query{
    constructor(table){this.table=table;this.filters={};}
    select(){return this;}eq(key,value){this.filters[key]=value;return this;}
    insert(rows){this.rows=rows;this.operation='insert';return this;}
    delete(){this.operation='delete';return this;}
    single(){return this.execute();}maybeSingle(){return this.execute();}
    then(resolve,reject){return this.execute().then(resolve,reject);}
    async execute(){
      if(this.table==='agenda_settings')return {data:{owner_id:'professional-a'},error:null};
      if(this.operation==='insert'){
        events.push(['insert',this.table]);
        if(this.table==='document_signers'){
          if(failSigners)return {data:null,error:new Error('Falha de gravação de assinantes')};
          signers.push(...this.rows);
        }else documents.push(this.rows);
        return {data:this.rows,error:null};
      }
      if(this.operation==='delete'){documents.splice(0,documents.length);events.push(['delete',this.table]);}
      return {data:null,error:null};
    }
  }
  const context={...whatsapp,console:{error(){}},crypto:{randomUUID},SUPABASE_URL:'https://example.supabase.co',SUPABASE_KEY:'publishable-test',location:{href:'https://painel-alegrare.vercel.app/#/documents'},document:{},window:{open(){events.push(['popup']);return popupBlocked?null:target;},location:{assign(url){events.push(['navigate',url]);}}},FormData:class{constructor(form){this.values=Object.fromEntries(Object.entries(form.elements).map(([key,input])=>[key,input.value]));}get(key){return this.values[key];}},supabase:{from:table=>new Query(table),storage:{from:()=>({async upload(path){events.push(['upload',path]);return {error:null};},async remove(){events.push(['remove-file']);return {error:null};}})}},loadPatientDirectory:async()=>({data:[patient,otherPatient],error:null}),bindPatientPicker(){},createDocumentImage:async()=>({name:'novo-termo.png',type:'image/png',size:200}),form,events,messages,sessionMutation:null};
  vm.runInNewContext(source+`
    session=async()=>{if(sessionMutation)sessionMutation();return {user:{id:'professional-a'}};};
    profile=async()=>({id:'professional-a',clinic_id:'clinic-a',full_name:'Profissional de teste'});
    closeModal=()=>{};refreshDocuments=async()=>{};refreshPatientDocuments=async()=>{};
    toast=message=>messages.push(message);showPatientLink=(token)=>events.push(['link-ready',token]);
    modal=html=>{events.push(['modal',html]);return {querySelector:selector=>selector==='[data-patient-preview]'?form.preview:form};};
    globalThis.api={uploadDocument,openCreateDocument,bindDocumentContact,documentWhatsappAction};
  `,context);
  return {context,api:context.api,form,target,events,documents,signers,messages};
}
const event=(form,whatsapp=true)=>({currentTarget:form,submitter:{value:whatsapp?'whatsapp':''},preventDefault(){}});

test('upload salva arquivo, documento e assinantes antes de abrir o WhatsApp com o token salvo',async()=>{
  const h=harness();await h.api.uploadDocument(event(h.form),()=>{});
  assert.equal(h.documents.length,1);assert.equal(h.signers.length,1);
  assert.equal(h.events[0][0],'popup');
  const navigation=h.events.find(item=>item[0]==='navigate');
  const url=new URL(navigation[1]);assert.equal(url.pathname,'/5521999001234');
  assert.ok(url.searchParams.get('text').includes(h.signers[0].signing_token));
  assert.ok(h.events.findIndex(item=>item[0]==='insert'&&item[1]==='document_signers')<h.events.indexOf(navigation));
  assert.equal(h.signers[0].metadata.delivery_status,'not_sent');
  assert.equal(h.signers[0].metadata.sent_at,undefined);
  assert.equal(h.form.dataset.saving,undefined);
});

test('falha na gravação não encaminha um link incompleto e remove o upload pendente',async()=>{
  const h=harness({failSigners:true});await h.api.uploadDocument(event(h.form),()=>{});
  assert.equal(h.documents.length,0);assert.equal(h.signers.length,0);
  assert.ok(h.events.some(item=>item[0]==='remove-file'));
  assert.ok(!h.events.some(item=>item[0]==='navigate'));
  assert.equal(h.target.closed,true);assert.equal(h.form.send.disabled,false);
});

test('salvar sem envio continua funcionando e popup bloqueado usa a navegação direta após salvar',async()=>{
  const saved=harness();await saved.api.uploadDocument(event(saved.form,false),()=>{});
  assert.equal(saved.documents.length,1);assert.ok(!saved.events.some(item=>['popup','navigate'].includes(item[0])));
  const blocked=harness({popupBlocked:true});await blocked.api.uploadDocument(event(blocked.form),()=>{});
  assert.ok(blocked.events.some(item=>item[0]==='navigate'));assert.equal(blocked.documents.length,1);
});

test('criar documento no painel também grava a cópia e abre o WhatsApp escolhido',async()=>{
  const h=harness();await h.api.openCreateDocument();
  assert.ok(h.events.find(item=>item[0]==='modal')[1].includes('Enviar documento pelo WhatsApp'));
  await h.form.onsubmit(event(h.form));
  assert.equal(h.documents[0].file_name,'novo-termo.png');
  assert.ok(new URL(h.events.find(item=>item[0]==='navigate')[1]).searchParams.get('text').includes(h.signers[0].signing_token));
});

test('trocar o paciente durante a gravação não troca o destinatário do documento iniciado',async()=>{
  const h=harness();h.context.sessionMutation=()=>{h.form.elements.patient.value=otherPatient.id;h.form.elements.patient.selectedOptions=[{dataset:{name:otherPatient.full_name,phone:otherPatient.phone}}];};
  await h.api.uploadDocument(event(h.form),()=>{});
  assert.equal(h.documents[0].patient_id,patient.id);assert.equal(h.documents[0].patient_name,patient.full_name);
  assert.equal(new URL(h.events.find(item=>item[0]==='navigate')[1]).pathname,'/5521999001234');
});

test('contato acompanha o paciente selecionado e bloqueia envio sem telefone ou durante gravação',()=>{
  const h=harness(),patients=[patient,{...otherPatient,phone:null}];h.api.bindDocumentContact(h.form,patients);
  assert.equal(h.form.send.disabled,false);assert.match(h.form.hint.textContent,/Paciente A/);
  h.form.elements.patient.value=otherPatient.id;h.form.elements.patient.listeners.change();
  assert.equal(h.form.send.disabled,true);assert.equal(h.form.elements.patientSignerName.value,otherPatient.full_name);
  h.form.elements.patient.value=patient.id;h.form.dataset.saving='true';h.form.elements.patient.listeners.change();assert.equal(h.form.send.disabled,true);
  delete h.form.dataset.saving;h.form.elements.signers.value='professional';h.form.elements.signers.listeners.change();assert.equal(h.form.contact.hidden,true);
});

test('documento salvo usa o telefone atual do cadastro, preservando o token no reenvio',()=>{
  const h=harness(),token=randomUUID();
  const html=h.api.documentWhatsappAction({title:'Termo de teste',patient_name:'Nome antigo',patients:patient,document_signers:[{signer_type:'patient',status:'pending',signing_token:token,signer_phone:otherPatient.phone}]});
  assert.match(html,/wa.me\/5521999001234/);assert.doesNotMatch(html,/wa.me\/5521999005678/);assert.ok(html.includes(token));
});
