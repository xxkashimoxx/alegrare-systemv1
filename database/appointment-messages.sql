-- Mensagens transacionais de agendamento. Não gera mensagens para consultas antigas.
begin;
create table if not exists public.appointment_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  event_key text not null,
  event_type text not null check (event_type in ('received','confirmed','rescheduled')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped','obsolete')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  recipient text,
  provider_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (appointment_id, channel, event_key)
);
create index if not exists appointment_messages_pending on public.appointment_messages(clinic_id,next_attempt_at)
  where status in ('pending','failed');
alter table public.appointment_messages enable row level security;
revoke all on public.appointment_messages from anon,authenticated;

create table if not exists public.patient_message_settings (
  clinic_id uuid primary key references public.clinics(id),
  sender_phone text not null,
  sender_email text not null,
  enabled boolean not null default false,
  check (sender_phone ~ '^\+55[0-9]{10,11}$')
);
alter table public.patient_message_settings enable row level security;
revoke all on public.patient_message_settings from anon,authenticated;

create or replace function agenda_private.queue_patient_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text; fingerprint text;
begin
  if tg_op='UPDATE' then
    if new.status='cancelled' or new.source_payload->>'patient_message_opt_in' is distinct from 'true' then
      update public.appointment_messages set status='obsolete' where appointment_id=new.id and status in ('pending','failed');
      return new;
    end if;
    if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
      kind='rescheduled';
    elsif new.approval_status='approved' and old.approval_status='pending' then
      kind='confirmed';
    else
      return new;
    end if;
  else
    kind=case when new.approval_status='pending' then 'received' else 'confirmed' end;
  end if;
  if new.source<>'manual' or new.status='cancelled' or new.source_payload->>'patient_message_opt_in' is distinct from 'true' then return new;end if;
  update public.appointment_messages set status='obsolete' where appointment_id=new.id and status in ('pending','failed');
  fingerprint=kind||':'||new.starts_at::text||':'||new.ends_at::text;
  insert into public.appointment_messages(clinic_id,appointment_id,channel,event_key,event_type)
    values(new.clinic_id,new.id,'email',fingerprint,kind),(new.clinic_id,new.id,'whatsapp',fingerprint,kind)
    on conflict (appointment_id,channel,event_key) do nothing;
  return new;
end $$;
revoke all on function agenda_private.queue_patient_message() from public,anon,authenticated;
drop trigger if exists agenda_queue_patient_message on public.appointments;
create trigger agenda_queue_patient_message after insert or update of starts_at,ends_at,approval_status,status,source_payload on public.appointments
for each row execute function agenda_private.queue_patient_message();

create or replace function public.claim_patient_messages(p_clinic_id uuid,p_appointment_id uuid,p_limit integer default 10)
returns setof public.appointment_messages language plpgsql security definer set search_path='' as $$
begin
  if current_setting('request.jwt.claim.role',true) <> 'service_role' then raise exception 'Acesso restrito'; end if;
  return query
    with candidate as (
      select id from public.appointment_messages
      where clinic_id=p_clinic_id and (p_appointment_id is null or appointment_id=p_appointment_id)
        and ((status in ('pending','failed') and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '5 minutes'))
        and attempts<4
      order by created_at limit least(greatest(p_limit,1),20) for update skip locked
    )
    update public.appointment_messages m set status='sending',locked_at=now(),attempts=m.attempts+1,error_message=null
    from candidate c where m.id=c.id returning m.*;
end $$;
revoke all on function public.claim_patient_messages(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_patient_messages(uuid,uuid,integer) to service_role;

insert into public.patient_message_settings(clinic_id,sender_phone,sender_email,enabled)
values('4a27d66a-6ab4-4c25-95af-6aedfae6c45f','+5521994133062','daniellecoelho@alegrare.com',false)
on conflict (clinic_id) do nothing;
update public.agenda_settings set notification_phone='+5521994133062'
where clinic_id='4a27d66a-6ab4-4c25-95af-6aedfae6c45f' and notification_phone is null;
commit;
