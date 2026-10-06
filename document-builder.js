const display = value => String(value ?? '').trim() || 'Não informado';
const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')) : 'Não informado';

export function anamnesisBody(answers){
  if(!Array.isArray(answers))return '';
  return answers.filter(item=>item&&typeof item==='object'&&item.question).map((item,index)=>{
    const answer=item.answer;
    const value=answer==null?'Não respondido':typeof answer==='string'?answer:JSON.stringify(answer);
    return `${index+1}. ${String(item.question).trim()}\nResposta: ${value}`;
  }).join('\n\n');
}

export async function createDocumentImage({title,body,patient,responsibleName,responsibleDocument,professional,accompanied}){
  const canvas=document.createElement('canvas');const width=1200,margin=100,textWidth=width-margin*2;
  const measure=document.createElement('canvas').getContext('2d');
  if(!measure)throw new Error('Seu navegador não conseguiu preparar o documento.');
  measure.font='bold 36px Arial';
  const titleLines=[];let titlePart='';
  for(const word of String(title||'').split(/\s+/)){
    if(measure.measureText(word).width>textWidth)throw new Error('O título contém uma palavra longa demais.');
    const next=titlePart?titlePart+' '+word:word;
    if(measure.measureText(next).width>textWidth){titleLines.push(titlePart);titlePart=word;}else titlePart=next;
  }
  if(titlePart)titleLines.push(titlePart);
  if(titleLines.length>4)throw new Error('Resuma o título do documento.');
  measure.font='27px Arial';
  const lines=[];
  const add=(text,gap=0)=>{
    lines.push({text:'',gap});
    for(const paragraph of String(text||'').split('\n')){
      if(!paragraph.trim()){lines.push({text:'',gap:18});continue;}
      let current='';
      for(const word of paragraph.split(/\s+/)){
        if(measure.measureText(word).width>textWidth)throw new Error('O documento contém uma palavra longa demais. Separe o texto e tente novamente.');
        const next=current?current+' '+word:word;
        if(measure.measureText(next).width>textWidth){lines.push({text:current,gap:0});current=word;}else current=next;
      }
      if(current)lines.push({text:current,gap:0});
    }
  };
  add(`Paciente: ${display(patient.full_name)}`);
  add(`CPF: ${display(patient.cpf)}  |  Nascimento: ${formatDate(patient.birth_date)}`);
  add(`Telefone: ${display(patient.phone)}  |  E-mail: ${display(patient.email)}`);
  if(responsibleName)add(`Responsável: ${responsibleName}  |  Documento: ${display(responsibleDocument)}`);
  add(`Profissional: ${display(professional)}`);
  if(accompanied)add('Preenchimento da anamnese realizado com acompanhamento da profissional.');
  add('',24);
  add(body);
  const titleOffset=(titleLines.length-1)*43;
  const height=Math.max(1350,370+titleOffset+lines.reduce((n,line)=>n+37+line.gap,0)+160);
  if(height>16000)throw new Error('O conteúdo ultrapassa o limite de uma página longa. Divida o documento antes de gerar.');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#1d6178';ctx.fillRect(margin,65,66,66);ctx.fillStyle='#fff';ctx.font='bold 44px Arial';ctx.fillText('A',margin+17,112);
  ctx.fillStyle='#193746';ctx.font='bold 40px Arial';ctx.fillText('ALEGRARE',margin+82,112);
  ctx.fillStyle='#596c74';ctx.font='20px Arial';ctx.fillText('ODONTOLOGIA ESPECIAL',margin+84,142);
  ctx.fillStyle='#193746';ctx.font='bold 36px Arial';titleLines.forEach((line,index)=>ctx.fillText(line,margin,205+index*43));
  ctx.font='21px Arial';ctx.fillStyle='#596c74';ctx.fillText('Criado em '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date()),margin,245+titleOffset);
  ctx.strokeStyle='#b9c9cf';ctx.beginPath();ctx.moveTo(margin,270+titleOffset);ctx.lineTo(width-margin,270+titleOffset);ctx.stroke();
  let y=330+titleOffset;ctx.font='27px Arial';ctx.fillStyle='#233845';
  for(const line of lines){y+=line.gap;if(line.text)ctx.fillText(line.text,margin,y);y+=37;}
  ctx.strokeStyle='#b9c9cf';ctx.beginPath();ctx.moveTo(margin,height-110);ctx.lineTo(width-margin,height-110);ctx.stroke();
  ctx.font='19px Arial';ctx.fillStyle='#596c74';ctx.fillText('Documento individual para leitura e assinatura eletrônica no Painel Alegrare.',margin,height-75);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Não foi possível gerar a imagem do documento.');
  if(blob.size>20*1024*1024)throw new Error('Documento acima de 20 MB. Reduza o texto.');
  return new File([blob],`alegrare-${Date.now()}.png`,{type:'image/png'});
}
