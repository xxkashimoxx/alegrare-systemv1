begin;

alter table public.patients
  add column if not exists social_name text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'patients_social_name_length' and conrelid = 'public.patients'::regclass) then
    alter table public.patients add constraint patients_social_name_length
      check (social_name is null or char_length(social_name) <= 160);
  end if;
end $$;

commit;
