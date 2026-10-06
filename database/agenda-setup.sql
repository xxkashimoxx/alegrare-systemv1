-- Apply in the Alegrare SQL editor after confirming profiles/appointments schema.
-- Uses the existing clinic and profile UUIDs. No existing appointments are deleted.
begin;
create schema if not exists agenda_private;
revoke all on schema agenda_private from public, anon, authenticated;
create table if not exists public.agenda_settings (
 clinic_id uuid primary key references public.clinics(id),
 owner_id uuid not null references public.profiles(id),
 weekly jsonb not null default '{}'::jsonb,
 enforce_weekly boolean not null default false,
 notification_phone text,
 notification_active boolean not null default false,
 check(notification_phone is null or notification_phone ~ '^\+55[0-9]{10,11}$')
);
create table if not exists public.agenda_windows (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 kind text not null check(kind in ('available','blocked')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 reason text check(length(reason)<=160),
 created_by uuid not null references public.profiles(id),
 check(ends_at>starts_at)
);
create index if not exists agenda_windows_range on public.agenda_windows(clinic_id,starts_at,ends_at);
alter table public.agenda_settings enable row level security;
alter table public.agenda_windows enable row level security;
revoke all on public.agenda_settings,public.agenda_windows from anon,authenticated;
grant select,insert,update on public.agenda_settings to authenticated;
grant select,delete on public.agenda_windows to authenticated;
create policy agenda_settings_read on public.agenda_settings for select to authenticated using (clinic_id=(select clinic_id from public.profiles where id=(select auth.uid())));
create policy agenda_settings_initialize on public.agenda_settings for insert to authenticated with check (clinic_id=(select clinic_id from public.profiles where id=(select auth.uid())) and owner_id=(select auth.uid()) and notification_active=false);
create policy agenda_settings_update on public.agenda_settings for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and clinic_id=(select clinic_id from public.profiles where id=(select auth.uid())));
create policy agenda_windows_read on public.agenda_windows for select to authenticated using (clinic_id=(select clinic_id from public.profiles where id=(select auth.uid())));
create policy agenda_windows_delete on public.agenda_windows for delete to authenticated using (exists(select 1 from public.agenda_settings s where s.clinic_id=agenda_windows.clinic_id and s.owner_id=(select auth.uid())));
-- Client cannot claim that an unconfigured sender is active.
revoke update(notification_active) on public.agenda_settings from authenticated;
revoke update on public.agenda_settings from authenticated;
grant update(weekly,enforce_weekly,notification_phone) on public.agenda_settings to authenticated;

alter table public.appointments add column if not exists approval_status text not null default 'approved' check(approval_status in ('approved','pending'));
create table if not exists public.agenda_notifications (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 appointment_id uuid not null references public.appointments(id),
 recipient_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 delivered_at timestamptz,
 status text not null default 'awaiting_connection' check(status in ('awaiting_connection','queued','sent','failed','obsolete')),
 error_message text
);
alter table public.agenda_notifications enable row level security;
revoke all on public.agenda_notifications from anon,authenticated;
grant select on public.agenda_notifications to authenticated;
create policy agenda_notification_read on public.agenda_notifications for select to authenticated using(recipient_id=(select auth.uid()));

create or replace function public.check_agenda_slot(p_clinic_id uuid,p_start timestamptz,p_end timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare settings public.agenda_settings; d date; minutes_start time; minutes_end time; allowed boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and clinic_id=p_clinic_id) then raise exception 'Acesso à agenda não autorizado.'; end if;
 if p_end<=p_start then raise exception 'O término deve ser depois do início.'; end if;
 if exists(select 1 from public.agenda_windows where clinic_id=p_clinic_id and kind='blocked' and starts_at<p_end and ends_at>p_start) then raise exception 'A responsável bloqueou este período. Escolha outro horário.'; end if;
 select * into settings from public.agenda_settings where clinic_id=p_clinic_id;
 if not found or not settings.enforce_weekly then return; end if;
 if exists(select 1 from public.agenda_windows where clinic_id=p_clinic_id and kind='available' and starts_at<=p_start and ends_at>=p_end) then return; end if;
 d=(p_start at time zone 'America/Sao_Paulo')::date;
 if (p_end at time zone 'America/Sao_Paulo')::date<>d then raise exception 'O período ultrapassa os horários disponíveis.'; end if;
 minutes_start=(p_start at time zone 'America/Sao_Paulo')::time;minutes_end=(p_end at time zone 'America/Sao_Paulo')::time;
 select exists(select 1 from jsonb_array_elements(coalesce(settings.weekly->extract(dow from d)::int::text,'[]'::jsonb)) r where (r->>'start')::time<=minutes_start and (r->>'end')::time>=minutes_end) into allowed;
 if not allowed then raise exception 'Este horário está fora da disponibilidade da responsável.'; end if;
end $$;
revoke all on function public.check_agenda_slot(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.check_agenda_slot(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.save_agenda_window(p_kind text,p_start timestamptz,p_end timestamptz,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings public.agenda_settings; count_existing integer; result_id uuid;
begin
 select * into settings from public.agenda_settings where owner_id=auth.uid();
 if auth.uid() is null or not found then raise exception 'Somente a responsável pode alterar a disponibilidade.'; end if;
 if p_kind not in ('available','blocked') or p_end<=p_start then raise exception 'Confira o tipo e o período.';end if;
 perform pg_advisory_xact_lock(hashtextextended(settings.clinic_id::text,0));
 insert into public.agenda_windows(clinic_id,kind,starts_at,ends_at,reason,created_by) values(settings.clinic_id,p_kind,p_start,p_end,p_reason,auth.uid()) returning id into result_id;
 select count(*) into count_existing from public.appointments where clinic_id=settings.clinic_id and status::text<>'cancelled' and starts_at<p_end and ends_at>p_start;
 return jsonb_build_object('id',result_id,'existing_appointments',case when p_kind='blocked' then count_existing else 0 end);
end $$;
revoke all on function public.save_agenda_window(text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.save_agenda_window(text,timestamptz,timestamptz,text) to authenticated;

create or replace function agenda_private.guard_appointment() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.agenda_settings; changed boolean;
begin
 -- Imports authorized with the service role retain their original source fields.
 if current_setting('request.jwt.claim.role',true)='service_role' then return new; end if;
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and clinic_id=new.clinic_id) then raise exception 'Acesso à agenda não autorizado.';end if;
 if not exists(select 1 from public.patients p where p.id=new.patient_id and p.clinic_id=new.clinic_id) then raise exception 'Paciente não pertence a esta clínica.';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.clinic_id::text,0));
 select * into settings from public.agenda_settings where clinic_id=new.clinic_id;
 changed=tg_op='INSERT';
 if tg_op='UPDATE' then
   if new.clinic_id<>old.clinic_id then raise exception 'Não é permitido transferir a consulta de clínica.';end if;
   changed=new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or (old.status::text='cancelled' and new.status::text<>'cancelled');
   if new.approval_status is distinct from old.approval_status and settings.owner_id is distinct from auth.uid() then raise exception 'Somente a responsável pode confirmar o agendamento.';end if;
 end if;
 if new.status::text<>'cancelled' and changed then
   perform public.check_agenda_slot(new.clinic_id,new.starts_at,new.ends_at);
   if exists(select 1 from public.appointments a where a.clinic_id=new.clinic_id and a.id<>new.id and a.status::text<>'cancelled' and a.starts_at<new.ends_at and a.ends_at>new.starts_at) then raise exception using errcode='23P01',message='Este horário já está reservado. Escolha outro período.';end if;
   new.approval_status=case when settings.owner_id is not null and settings.owner_id<>auth.uid() then 'pending' else 'approved' end;
 end if;
 if settings.owner_id is not null then new.professional_id=settings.owner_id;end if;
 if tg_op='INSERT' then new.created_by=auth.uid();end if;
 return new;
end $$;
revoke all on function agenda_private.guard_appointment() from public,anon,authenticated;
create trigger agenda_appointment_guard before insert or update on public.appointments for each row execute function agenda_private.guard_appointment();

create or replace function agenda_private.enqueue_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare settings public.agenda_settings; changed boolean;
begin
 changed=tg_op='INSERT';
 if tg_op='UPDATE' then changed=new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or (old.status::text='cancelled' and new.status::text<>'cancelled');end if;
 if new.approval_status='pending' and new.status::text<>'cancelled' and changed then
 select * into settings from public.agenda_settings where clinic_id=new.clinic_id;
 update public.agenda_notifications set status='obsolete' where appointment_id=new.id and status in ('queued','awaiting_connection');
 insert into public.agenda_notifications(clinic_id,appointment_id,recipient_id,status) values(new.clinic_id,new.id,settings.owner_id,case when settings.notification_active then 'queued' else 'awaiting_connection' end);
 elsif new.approval_status='approved' or new.status::text='cancelled' then
 update public.agenda_notifications set status='obsolete' where appointment_id=new.id and status in ('queued','awaiting_connection');
 end if;
 return new;
end $$;
revoke all on function agenda_private.enqueue_notification() from public,anon,authenticated;
create trigger agenda_enqueue_notification after insert or update on public.appointments for each row execute function agenda_private.enqueue_notification();
commit;
