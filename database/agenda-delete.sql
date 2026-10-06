begin;

-- An appointment removed from the schedule cannot retain a pending notice.
alter table public.agenda_notifications
  drop constraint agenda_notifications_appointment_id_fkey;
alter table public.agenda_notifications
  add constraint agenda_notifications_appointment_id_fkey
  foreign key (appointment_id) references public.appointments(id) on delete cascade;

create or replace function agenda_private.guard_appointment_delete() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.status in ('completed','checked_in','no_show') then
    raise exception 'Consultas com presença ou falta registrada devem permanecer no histórico.';
  end if;
  if exists(select 1 from public.clinical_records where appointment_id=old.id) then
    raise exception 'Há registros clínicos vinculados. Preserve o histórico e cancele a consulta.';
  end if;
  return old;
end $$;
revoke all on function agenda_private.guard_appointment_delete() from public,anon,authenticated;
create trigger agenda_appointment_delete_guard before delete on public.appointments
for each row execute function agenda_private.guard_appointment_delete();

commit;
