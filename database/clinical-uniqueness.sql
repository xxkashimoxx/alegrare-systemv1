-- One current odontogram record for each patient/dentition identifier.
-- Scoped to the existing clinical_records table and Alegrare dental records only.
-- Existing imported records and their external identifiers are left untouched.
create unique index if not exists clinical_odontogram_tooth_unique
  on public.clinical_records (clinic_id, patient_id, external_source, external_id)
  where external_source = 'alegrare_odontogram';
