import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const bytesOf = (encoded: string) => Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
const plain = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ').slice(0, 130);
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');

async function signedPdf(original: Uint8Array, mime: string, signature: Uint8Array, details: { title: string; patient: string; documentId: string; signerId: string; signedAt: string; location: string }) {
  let pdf: PDFDocument;
  if (mime === 'application/pdf') pdf = await PDFDocument.load(original);
  else if (mime === 'image/png' || mime === 'image/jpeg') {
    pdf = await PDFDocument.create();
    const image = mime === 'image/png' ? await pdf.embedPng(original) : await pdf.embedJpg(original);
    const width = 535, height = image.height * width / image.width, segment = 782;
    if (Math.ceil(height / segment) > 40) throw new Error('Documento extenso demais para gerar uma cópia assinada.');
    for (let i = 0; i < Math.ceil(height / segment); i++) pdf.addPage([595, 842]).drawImage(image, { x: 30, y: 812 - height + i * segment, width, height });
  } else throw new Error('Envie o documento em PDF, PNG ou JPG para recolher a assinatura.');

  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.23, 0.29);
  page.drawText('ALEGRARE  |  ASSINATURAS DO DOCUMENTO', { x: 42, y: 782, size: 16, font: bold, color: ink });
  page.drawText('Esta pagina integra o documento apresentado nas paginas anteriores.', { x: 42, y: 754, size: 10, font: regular, color: ink });
  const rows = [
    `Documento: ${plain(details.title)}`,
    `Paciente: ${plain(details.patient)}`,
    `Assinado em: ${plain(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(details.signedAt)))} (Brasilia)`,
    `Localidade declarada: ${plain(details.location || 'Nao informada')}`,
  ];
  rows.forEach((row, i) => page.drawText(row, { x: 42, y: 710 - i * 27, size: 11, font: regular, color: ink }));
  page.drawText('Assinatura do paciente', { x: 42, y: 566, size: 12, font: bold, color: ink });
  const sign = await pdf.embedPng(signature);
  const size = sign.scaleToFit(420, 140);
  page.drawImage(sign, { x: 42, y: 400 + (140 - size.height) / 2, width: size.width, height: size.height });
  page.drawLine({ start: { x: 42, y: 395 }, end: { x: 495, y: 395 }, thickness: 0.6, color: ink });
  page.drawText(plain(details.patient), { x: 42, y: 374, size: 11, font: regular, color: ink });
  page.drawText(`Documento ID: ${details.documentId}`, { x: 42, y: 90, size: 9, font: regular, color: ink });
  page.drawText(`Registro de assinatura: ${details.signerId}`, { x: 42, y: 74, size: 9, font: regular, color: ink });
  page.drawText('Aceite eletronico registrado no Painel Alegrare.', { x: 42, y: 54, size: 9, font: regular, color: ink });
  return pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!['GET','POST'].includes(req.method)) return json({ error: 'Método não permitido.' }, 405);

  const url = new URL(req.url);
  let token = url.searchParams.get('token') || '';
  let signerName = '';
  let signerLocation = '';
  let accepted = false;
  let signature = '';

  if (req.method === 'POST') {
    if (Number(req.headers.get('content-length') || 0) > 800000) return json({ error: 'Assinatura grande demais.' }, 413);
    try {
      const body = await req.json();
      token = String(body?.token || token);
      signerName = String(body?.signerName || '').trim();
      signerLocation = String(body?.location || '').trim();
      accepted = body?.accepted === true;
      signature = String(body?.signature || '');
    } catch {
      return json({ error: 'Corpo inválido.' }, 400);
    }
  }

  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: 'Link de assinatura inválido.' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: signer, error: signerError } = await supabase
    .from('document_signers')
    .select('id, document_id, signer_type, signer_name, status, signed_at, updated_at, metadata')
    .eq('signing_token', token)
    .eq('signer_type', 'patient')
    .maybeSingle();

  if (signerError || !signer) return json({ error: 'Link de assinatura não encontrado ou expirado.' }, 404);

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id, clinic_id, title, patient_name, file_path, file_name, mime_type, status, created_at')
    .eq('id', signer.document_id)
    .maybeSingle();

  if (documentError || !document || document.status === 'cancelled') return json({ error: 'Documento indisponível.' }, 404);

  if (req.method === 'GET') {
    const { data: professionals } = await supabase.from('document_signers').select('signer_name,status,signed_at').eq('document_id', document.id).eq('signer_type', 'professional');
    const signedCopyPath = signer.status === 'signed' ? signer.metadata?.signed_copy_path : null;
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('clinic-documents')
      .createSignedUrl(signedCopyPath || document.file_path, 600);
    if (urlError) return json({ error: 'Não foi possível abrir o documento.' }, 500);
    return json({
      document: {
        title: document.title,
        patientName: document.patient_name,
        fileName: signedCopyPath ? `${document.title} - assinado.pdf` : document.file_name,
        mimeType: signedCopyPath ? 'application/pdf' : document.mime_type,
        createdAt: document.created_at,
        url: signedUrlData.signedUrl,
        signedCopy: Boolean(signedCopyPath),
      },
      signer: {
        name: signer.signer_name,
        status: signer.status,
        signedAt: signer.signed_at,
        accompanied: signer.metadata?.accompanied_by_professional === true,
        location: signer.metadata?.signer_location || null,
      },
      professional: professionals?.[0] || null,
    });
  }

  if (signer.status === 'signed') return json({ ok: true, alreadySigned: true, signedAt: signer.signed_at });
  if (!accepted) return json({ error: 'É necessário confirmar que você leu e concorda com o documento.' }, 400);
  if (signerName.length < 3 || signerName.length > 160) return json({ error: 'Informe o nome completo do paciente.' }, 400);
  if (signerLocation.length > 120 || /[\r\n\x00-\x1f]/.test(signerLocation)) return json({ error: 'Localidade inválida.' }, 400);
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(signature);
  if (!match || match[1].length > 700000) return json({ error: 'Desenhe sua assinatura no campo indicado.' }, 400);
  let signatureBytes: Uint8Array;
  try { signatureBytes = bytesOf(match[1]); } catch { return json({ error: 'Assinatura inválida.' }, 400); }
  if (signatureBytes.length > 500000 || signatureBytes.length < 200 || signatureBytes.slice(0, 8).some((v, i) => v !== [137,80,78,71,13,10,26,10][i])) return json({ error: 'Imagem da assinatura inválida.' }, 400);

  const mime = document.mime_type || (/\.pdf$/i.test(document.file_name) ? 'application/pdf' : /\.png$/i.test(document.file_name) ? 'image/png' : /\.jpe?g$/i.test(document.file_name) ? 'image/jpeg' : '');
  if (!['application/pdf','image/png','image/jpeg'].includes(mime)) return json({ error: 'Este arquivo precisa ser convertido para PDF antes da assinatura.' }, 422);
  const { data: source, error: sourceError } = await supabase.storage.from('clinic-documents').download(document.file_path);
  if (sourceError || !source) return json({ error: 'Não foi possível carregar o documento original.' }, 500);
  const original = new Uint8Array(await source.arrayBuffer());
  const signedAt = new Date().toISOString();
  let pdfBytes: Uint8Array;
  try { pdfBytes = await signedPdf(original, mime, signatureBytes, { title: document.title, patient: signerName, documentId: document.id, signerId: signer.id, signedAt, location: signerLocation }); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Não foi possível preparar a cópia assinada.' }, 422); }
  if (pdfBytes.length > 20 * 1024 * 1024) return json({ error: 'A cópia assinada excedeu 20 MB. Compacte o original e tente novamente.' }, 413);
  const signedCopyPath = `${document.clinic_id}/${document.id}/signed-${signer.id}.pdf`;
  const { error: uploadError } = await supabase.storage.from('clinic-documents').upload(signedCopyPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
  if (uploadError) return json({ error: 'Não foi possível salvar a cópia assinada. Tente novamente.' }, 500);

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent') || null;

  const { data: updated, error: updateError } = await supabase
    .from('document_signers')
    .update({
      signer_name: signerName,
      status: 'signed',
      signed_at: signedAt,
      updated_at: new Date().toISOString(),
      signature_method: 'drawn_electronic_consent',
      signed_ip: forwarded,
      signed_user_agent: userAgent,
      metadata: { ...(signer.metadata || {}), consent: true, consent_text: 'Li e concordo com o documento apresentado.', signer_location: signerLocation || null, signed_copy_path: signedCopyPath, original_sha256: await digest(original), signature_sha256: await digest(signatureBytes), signed_copy_sha256: await digest(pdfBytes) },
    })
    .eq('id', signer.id)
    .eq('status', 'pending')
    .eq('updated_at', signer.updated_at)
    .select('signed_at')
    .maybeSingle();

  if (updateError || !updated) {
    await supabase.storage.from('clinic-documents').remove([signedCopyPath]);
    return json({ error: updateError ? 'Não foi possível registrar a assinatura.' : 'A assinatura já foi alterada. Recarregue o documento.' }, updateError ? 500 : 409);
  }
  const { data: finalUrl } = await supabase.storage.from('clinic-documents').createSignedUrl(signedCopyPath, 600);
  return json({ ok: true, signedAt: updated.signed_at, signedUrl: finalUrl?.signedUrl || null });
});
