export const businessDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const cents=value=>Math.round(Number(value||0)*100);
export function financeState(doc,today=businessDate()){
 const ledger=doc.metadata?.finance||{};
 const payments=Array.isArray(ledger.payments)?ledger.payments:[];
 const paid=payments.filter(p=>!p.voided_at&&p.confirmed===true&&Number.isInteger(p.amount_cents)&&p.amount_cents>0).reduce((sum,p)=>sum+p.amount_cents,0);
 const total=Math.max(0,cents(doc.amount));const tracked=ledger.tracking_started===true||paid>0;
 const remaining=Math.max(0,total-paid);
 const state=doc.status==='cancelled'?'cancelled':!tracked?'unreconciled':remaining===0&&total>0?'paid':paid>0?'partial':ledger.due_date&&ledger.due_date<today?'overdue':'pending';
 return {total,paid,remaining,tracked,state,dueDate:ledger.due_date||'',payments};
}
export const paymentLabels={unreconciled:'Não conciliado',pending:'A receber',overdue:'Vencido',partial:'Recebimento parcial',paid:'Recebido',cancelled:'Cancelado'};
export function financeTotals(records,today){return records.reduce((t,d)=>{const f=financeState(d,today);t.documents+=f.total;t.received+=f.paid;if(d.status!=='cancelled'&&f.tracked)t.pending+=f.remaining;if(f.state==='overdue'||(f.state==='partial'&&f.dueDate&&f.dueDate<today))t.overdue+=f.remaining;if(!f.tracked&&d.status!=='cancelled')t.unreconciled++;return t;},{documents:0,received:0,pending:0,overdue:0,unreconciled:0});}
export function addPayment(doc,input,actorId){
 const f=financeState(doc);const amount=cents(input.amount);
 if(doc.status==='cancelled')throw new Error('Um documento cancelado não pode receber novos lançamentos.');
 if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Informe um valor positivo.');
 if(amount>f.remaining)throw new Error('O recebimento ultrapassa o saldo do documento.');
 if(!input.confirmed)throw new Error('Confirme que conferiu o recebimento antes de registrar.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(+new Date(input.date+'T12:00:00Z'))||new Date(input.date+'T12:00:00Z').toISOString().slice(0,10)!==input.date||input.date>businessDate())throw new Error('Confira a data do recebimento.');
 if(!String(input.reference||'').trim())throw new Error('Informe a referência ou identificação do comprovante.');
 const payment={id:crypto.randomUUID(),amount_cents:amount,received_on:input.date,method:input.method,reference:String(input.reference).trim(),confirmed:true,recorded_by:actorId,recorded_at:new Date().toISOString()};
 return {...(doc.metadata||{}),finance:{...(doc.metadata?.finance||{}),tracking_started:true,payments:[...f.payments,payment]}};
}
