begin;

create or replace function public.guard_clinic_document_signer() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  -- The public patient link uses a service-role Edge Function after validating its token.
  if current_setting('request.jwt.claim.role',true)='service_role' then return new; end if;
  if auth.uid() is null then raise exception 'Acesso à assinatura não autorizado.'; end if;
  if new.clinic_id is distinct from old.clinic_id or new.document_id is distinct from old.document_id
    or new.signer_type is distinct from old.signer_type or new.signing_token is distinct from old.signing_token
    or new.signer_user_id is distinct from old.signer_user_id
    or new.signer_email is distinct from old.signer_email or new.signer_phone is distinct from old.signer_phone then
    raise exception 'Não é permitido alterar a identidade do signatário.';
  end if;
  if old.signer_type='patient' and (new.status is distinct from old.status
    or new.signed_at is distinct from old.signed_at or new.signer_name is distinct from old.signer_name
    or new.signed_ip is distinct from old.signed_ip or new.signed_user_agent is distinct from old.signed_user_agent
    or new.signature_method is distinct from old.signature_method) then
    raise exception 'A assinatura do paciente só pode ser registrada pelo link individual.';
  end if;
  if old.signer_type='patient' and (coalesce(new.metadata,'{}'::jsonb) - array['sent_at','sent_channel','received_at'])
    is distinct from (coalesce(old.metadata,'{}'::jsonb) - array['sent_at','sent_channel','received_at']) then
    raise exception 'Os dados de aceite do paciente não podem ser modificados pela equipe.';
  end if;
  if old.signer_type='professional' and (new.status is distinct from old.status or new.signed_at is distinct from old.signed_at) then
    if old.signer_user_id is distinct from auth.uid() then raise exception 'Somente a profissional designada pode assinar.'; end if;
    if old.status='signed' then raise exception 'Uma assinatura registrada não pode ser desfeita.'; end if;
    if new.status<>'signed' then raise exception 'Transição de assinatura inválida.'; end if;
  end if;
  if old.signer_type='professional' and (new.signer_name is distinct from old.signer_name
    or new.signature_method is distinct from old.signature_method and not (old.status='pending' and new.status='signed' and old.signer_user_id=auth.uid())
    or new.metadata is distinct from old.metadata or new.signed_ip is distinct from old.signed_ip
    or new.signed_user_agent is distinct from old.signed_user_agent) then
    raise exception 'Os dados da assinatura profissional não podem ser alterados.';
  end if;
  return new;
end $$;

revoke all on function public.guard_clinic_document_signer() from public,anon,authenticated;
drop trigger if exists guard_clinic_document_signer on public.document_signers;
create trigger guard_clinic_document_signer before update on public.document_signers
for each row execute function public.guard_clinic_document_signer();

commit;
