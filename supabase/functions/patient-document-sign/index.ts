import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!['GET','POST'].includes(req.method)) return json({ error: 'Método não permitido.' }, 405);

  const url = new URL(req.url);
  let token = url.searchParams.get('token') || '';
  let signerName = '';
  let signerLocation = '';
  let accepted = false;

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      token = String(body?.token || token);
      signerName = String(body?.signerName || '').trim();
      signerLocation = String(body?.location || '').trim();
      accepted = body?.accepted === true;
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
    .select('id, title, patient_name, file_path, file_name, mime_type, status, created_at')
    .eq('id', signer.document_id)
    .maybeSingle();

  if (documentError || !document || document.status === 'cancelled') return json({ error: 'Documento indisponível.' }, 404);

  if (req.method === 'GET') {
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('clinic-documents')
      .createSignedUrl(document.file_path, 600);
    if (urlError) return json({ error: 'Não foi possível abrir o documento.' }, 500);
    return json({
      document: {
        title: document.title,
        patientName: document.patient_name,
        fileName: document.file_name,
        mimeType: document.mime_type,
        createdAt: document.created_at,
        url: signedUrlData.signedUrl,
      },
      signer: {
        name: signer.signer_name,
        status: signer.status,
        signedAt: signer.signed_at,
        accompanied: signer.metadata?.accompanied_by_professional === true,
        location: signer.metadata?.signer_location || null,
      },
    });
  }

  if (signer.status === 'signed') return json({ ok: true, alreadySigned: true, signedAt: signer.signed_at });
  if (!accepted) return json({ error: 'É necessário confirmar que você leu e concorda com o documento.' }, 400);
  if (signerName.length < 3 || signerName.length > 160) return json({ error: 'Informe o nome completo do paciente.' }, 400);
  if (signerLocation.length > 120 || /[\r\n\x00-\x1f]/.test(signerLocation)) return json({ error: 'Localidade inválida.' }, 400);

  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent') || null;

  const { data: updated, error: updateError } = await supabase
    .from('document_signers')
    .update({
      signer_name: signerName,
      status: 'signed',
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      signed_ip: forwarded,
      signed_user_agent: userAgent,
      metadata: { ...(signer.metadata || {}), consent: true, consent_text: 'Li e concordo com o documento apresentado.', signer_location: signerLocation || null },
    })
    .eq('id', signer.id)
    .eq('status', 'pending')
    .eq('updated_at', signer.updated_at)
    .select('signed_at')
    .maybeSingle();

  if (updateError) return json({ error: 'Não foi possível registrar a assinatura.' }, 500);
  if (!updated) return json({ error: 'A assinatura já foi alterada. Recarregue o documento.' }, 409);
  return json({ ok: true, signedAt: updated.signed_at });
});
