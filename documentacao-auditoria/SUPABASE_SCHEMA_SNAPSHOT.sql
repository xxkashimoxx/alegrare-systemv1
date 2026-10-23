-- Supabase Alegrare schema snapshot 2026-10-23
-- Leitura exclusiva do catalogo PG: dados clinicos e segredos nao exportados.
-- APENAS AUDITORIA; NAO EXECUTE COMO DUMP DE RESTAURACAO.
-- Referencias a auth, storage, extensions, grants e dependencias podem exigir preparacao.

-- table/accounts_payable
CREATE TABLE public.accounts_payable (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  description text NOT NULL,
  supplier text,
  category text,
  amount numeric(12,2) NOT NULL,
  due_on date NOT NULL,
  paid_at timestamp with time zone,
  payment_method text,
  payment_reference text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/agenda_notifications
CREATE TABLE public.agenda_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  delivered_at timestamp with time zone,
  status text DEFAULT 'awaiting_connection'::text NOT NULL,
  error_message text
);

-- table/agenda_settings
CREATE TABLE public.agenda_settings (
  clinic_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  weekly jsonb DEFAULT '{}'::jsonb NOT NULL,
  enforce_weekly boolean DEFAULT false NOT NULL,
  notification_phone text,
  notification_active boolean DEFAULT false NOT NULL
);

-- table/agenda_windows
CREATE TABLE public.agenda_windows (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  kind text NOT NULL,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  reason text,
  created_by uuid NOT NULL
);

-- table/anamnesis_questions
CREATE TABLE public.anamnesis_questions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  question text NOT NULL,
  question_type text,
  sequence integer,
  template_description text,
  template_expertise text,
  template_type text,
  type text,
  options jsonb,
  required boolean DEFAULT false NOT NULL,
  required_options boolean DEFAULT false NOT NULL,
  alert text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/appointment_messages
CREATE TABLE public.appointment_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  channel text NOT NULL,
  event_key text NOT NULL,
  event_type text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_at timestamp with time zone,
  recipient text,
  provider_id text,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sent_at timestamp with time zone
);

-- table/appointments
CREATE TABLE public.appointments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  procedure_name text,
  notes text,
  source text DEFAULT 'manual'::text NOT NULL,
  external_id text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  external_professional_id text,
  professional_name text,
  approval_status text DEFAULT 'approved'::text NOT NULL
);

-- table/audit_events
CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  clinic_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/clinical_records
CREATE TABLE public.clinical_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  appointment_id uuid,
  record_type text DEFAULT 'evolution'::text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  signed_at timestamp with time zone,
  external_source text,
  external_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/clinics
CREATE TABLE public.clinics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/document_signers
CREATE TABLE public.document_signers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  document_id uuid NOT NULL,
  signer_type text NOT NULL,
  signer_user_id uuid,
  signer_name text NOT NULL,
  signer_email text,
  signer_phone text,
  signing_token uuid DEFAULT gen_random_uuid() NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  signature_method text DEFAULT 'electronic_acknowledgement'::text NOT NULL,
  signed_at timestamp with time zone,
  signed_ip inet,
  signed_user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/documents
CREATE TABLE public.documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  patient_name text NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  status text DEFAULT 'pending'::text NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/financial_entries
CREATE TABLE public.financial_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  treatment_plan_id uuid,
  payment_item_id uuid,
  amount numeric(14,2) DEFAULT 0 NOT NULL,
  service_amount numeric(14,2),
  date timestamp with time zone,
  confirmed_at timestamp with time zone,
  post_date timestamp with time zone,
  description text,
  entry_type text,
  direction text,
  is_open boolean,
  is_manual boolean,
  account_external_id text,
  reference_entity text,
  reference_external_id text,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/fiscal_documents
CREATE TABLE public.fiscal_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  treatment_plan_id uuid,
  document_type text DEFAULT 'nfse'::text NOT NULL,
  amount numeric(12,2) NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  provider text,
  provider_reference text,
  verification_code text,
  document_url text,
  issued_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/import_batches
CREATE TABLE public.import_batches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  source text DEFAULT 'clinicorp'::text NOT NULL,
  file_name text,
  status text DEFAULT 'uploaded'::text NOT NULL,
  total_rows integer DEFAULT 0 NOT NULL,
  valid_rows integer DEFAULT 0 NOT NULL,
  error_rows integer DEFAULT 0 NOT NULL,
  imported_rows integer DEFAULT 0 NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/import_rows
CREATE TABLE public.import_rows (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  clinic_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  entity_type text NOT NULL,
  row_number integer NOT NULL,
  source_id text,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  status text DEFAULT 'pending'::text NOT NULL,
  target_table text,
  target_id uuid,
  errors jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/medications
CREATE TABLE public.medications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid,
  display_name text NOT NULL,
  active_ingredient text,
  presentation text,
  source text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/opportunities
CREATE TABLE public.opportunities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  category text NOT NULL,
  priority text DEFAULT 'medium'::text NOT NULL,
  potential_value numeric(12,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  recommended_action text,
  detected_at timestamp with time zone DEFAULT now() NOT NULL,
  last_action_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/patient_anamneses
CREATE TABLE public.patient_anamneses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  anamnesis_date timestamp with time zone,
  is_current boolean DEFAULT false NOT NULL,
  notes text,
  template_description text,
  template_expertise text,
  template_type text,
  answers jsonb DEFAULT '[]'::jsonb NOT NULL,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/patient_documents
CREATE TABLE public.patient_documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text,
  mime_type text,
  document_type text DEFAULT 'other'::text NOT NULL,
  signer_scope text DEFAULT 'professional'::text NOT NULL,
  status text DEFAULT 'uploaded'::text NOT NULL,
  professional_signed_at timestamp with time zone,
  patient_signed_at timestamp with time zone,
  patient_sign_token uuid DEFAULT gen_random_uuid(),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/patient_message_settings
CREATE TABLE public.patient_message_settings (
  clinic_id uuid NOT NULL,
  sender_phone text NOT NULL,
  sender_email text NOT NULL,
  enabled boolean DEFAULT false NOT NULL
);

-- table/patient_timeline
CREATE TABLE public.patient_timeline (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/patients
CREATE TABLE public.patients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text,
  birth_date date,
  payer_type text,
  current_treatment text,
  last_visit_at timestamp with time zone,
  status text DEFAULT 'active'::text NOT NULL,
  risk_score integer DEFAULT 0 NOT NULL,
  potential_value numeric(12,2) DEFAULT 0 NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  email text,
  cpf text,
  preferred_channel text DEFAULT 'whatsapp'::text,
  address jsonb DEFAULT '{}'::jsonb NOT NULL,
  notes text,
  external_source text,
  external_id text,
  consent_at timestamp with time zone,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  social_name text
);

-- table/payment_headers
CREATE TABLE public.payment_headers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  treatment_plan_id uuid,
  description text,
  payment_date timestamp with time zone,
  received_date timestamp with time zone,
  post_date timestamp with time zone,
  installments_count integer,
  payment_confirmed boolean DEFAULT false NOT NULL,
  payment_received boolean DEFAULT false NOT NULL,
  receipt_type text,
  payment_form_external_id text,
  checkout_uuid text,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/payment_items
CREATE TABLE public.payment_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  payment_header_id uuid,
  patient_id uuid,
  amount numeric(14,2),
  original_amount numeric(14,2),
  total_amount numeric(14,2),
  due_date timestamp with time zone,
  payment_date timestamp with time zone,
  received_date timestamp with time zone,
  confirmed_date timestamp with time zone,
  payment_description text,
  payment_type text,
  installment_number integer,
  installments_count integer,
  payment_confirmed boolean DEFAULT false NOT NULL,
  payment_received boolean DEFAULT false NOT NULL,
  canceled boolean DEFAULT false NOT NULL,
  external_status text,
  payer_name text,
  payer_document text,
  payer_email text,
  payer_phone text,
  boleto_url text,
  boleto_digital_line text,
  card_flag text,
  card_type text,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/prescription_items
CREATE TABLE public.prescription_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  prescription_id uuid NOT NULL,
  medication_id uuid,
  medication_name text NOT NULL,
  instructions text,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/prescription_signatures
CREATE TABLE public.prescription_signatures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  prescription_id uuid NOT NULL,
  signer_id uuid,
  signer_name text NOT NULL,
  signature_type text DEFAULT 'internal'::text NOT NULL,
  provider text,
  provider_reference text,
  signed_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/prescriptions
CREATE TABLE public.prescriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  document_type text DEFAULT 'prescription'::text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  author_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/professionals
CREATE TABLE public.professionals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  full_name text NOT NULL,
  cro text,
  email text,
  phone text,
  landline text,
  birth_date date,
  sex text,
  city text,
  status text DEFAULT 'active'::text NOT NULL,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  clinic_id uuid,
  full_name text,
  role text DEFAULT 'staff'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/recovery_actions
CREATE TABLE public.recovery_actions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  opportunity_id uuid,
  action_type text NOT NULL,
  channel text,
  content text,
  status text DEFAULT 'prepared'::text NOT NULL,
  acted_by uuid,
  acted_at timestamp with time zone DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/reminders
CREATE TABLE public.reminders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  appointment_id uuid,
  reminder_type text NOT NULL,
  recipient_type text DEFAULT 'patient'::text NOT NULL,
  channel text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  content text,
  provider_reference text,
  attempts integer DEFAULT 0 NOT NULL,
  last_error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/stock_items
CREATE TABLE public.stock_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  unit text DEFAULT 'un'::text NOT NULL,
  always_needed boolean DEFAULT false NOT NULL,
  minimum_quantity numeric(12,2) DEFAULT 0 NOT NULL,
  quantity numeric(12,2) DEFAULT 0 NOT NULL,
  lot_code text DEFAULT ''::text NOT NULL,
  supplier text,
  purchased_on date,
  expires_on date,
  unit_price numeric(12,2),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  product_code text,
  invoice_key text,
  invoice_item_number integer,
  invoice_source_name text
);

-- table/treatment_operations
CREATE TABLE public.treatment_operations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_name text,
  external_professional_id text,
  description text NOT NULL,
  condition text,
  tooth text,
  surface text,
  amount numeric(14,2),
  created_at_source timestamp with time zone,
  executed_at timestamp with time zone,
  is_executed boolean DEFAULT false NOT NULL,
  notes text,
  next_appointment_notes text,
  external_source text,
  external_id text,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- table/treatment_plan_items
CREATE TABLE public.treatment_plan_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  treatment_plan_id uuid NOT NULL,
  description text NOT NULL,
  tooth text,
  specialty text,
  quantity numeric(10,2) DEFAULT 1 NOT NULL,
  unit_amount numeric(12,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'planned'::text NOT NULL,
  completed_at timestamp with time zone,
  "position" integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- table/treatment_plans
CREATE TABLE public.treatment_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  total_amount numeric(12,2) DEFAULT 0 NOT NULL,
  approved_at timestamp with time zone,
  created_by uuid,
  external_source text,
  external_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  source_payload jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- constraint/accounts_payable_amount_check
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_amount_check CHECK (amount > 0::numeric);

-- constraint/accounts_payable_check
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_check CHECK (paid_at IS NULL OR payment_method IS NOT NULL AND payment_reference IS NOT NULL);

-- constraint/accounts_payable_clinic_id_fkey
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/accounts_payable_created_by_fkey
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

-- constraint/accounts_payable_description_check
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_description_check CHECK (char_length(TRIM(BOTH FROM description)) >= 2 AND char_length(TRIM(BOTH FROM description)) <= 200);

-- constraint/accounts_payable_pkey
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_pkey PRIMARY KEY (id);

-- constraint/agenda_notifications_appointment_id_fkey
ALTER TABLE agenda_notifications ADD CONSTRAINT agenda_notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- constraint/agenda_notifications_clinic_id_fkey
ALTER TABLE agenda_notifications ADD CONSTRAINT agenda_notifications_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/agenda_notifications_pkey
ALTER TABLE agenda_notifications ADD CONSTRAINT agenda_notifications_pkey PRIMARY KEY (id);

-- constraint/agenda_notifications_recipient_id_fkey
ALTER TABLE agenda_notifications ADD CONSTRAINT agenda_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id);

-- constraint/agenda_notifications_status_check
ALTER TABLE agenda_notifications ADD CONSTRAINT agenda_notifications_status_check CHECK (status = ANY (ARRAY['awaiting_connection'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'obsolete'::text]));

-- constraint/agenda_settings_clinic_id_fkey
ALTER TABLE agenda_settings ADD CONSTRAINT agenda_settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/agenda_settings_notification_phone_check
ALTER TABLE agenda_settings ADD CONSTRAINT agenda_settings_notification_phone_check CHECK (notification_phone IS NULL OR notification_phone ~ '^\+55[0-9]{10,11}$'::text);

-- constraint/agenda_settings_owner_id_fkey
ALTER TABLE agenda_settings ADD CONSTRAINT agenda_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id);

-- constraint/agenda_settings_pkey
ALTER TABLE agenda_settings ADD CONSTRAINT agenda_settings_pkey PRIMARY KEY (clinic_id);

-- constraint/agenda_windows_check
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_check CHECK (ends_at > starts_at);

-- constraint/agenda_windows_clinic_id_fkey
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/agenda_windows_created_by_fkey
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

-- constraint/agenda_windows_kind_check
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_kind_check CHECK (kind = ANY (ARRAY['available'::text, 'blocked'::text]));

-- constraint/agenda_windows_pkey
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_pkey PRIMARY KEY (id);

-- constraint/agenda_windows_reason_check
ALTER TABLE agenda_windows ADD CONSTRAINT agenda_windows_reason_check CHECK (length(reason) <= 160);

-- constraint/anamnesis_questions_clinic_id_fkey
ALTER TABLE anamnesis_questions ADD CONSTRAINT anamnesis_questions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/anamnesis_questions_pkey
ALTER TABLE anamnesis_questions ADD CONSTRAINT anamnesis_questions_pkey PRIMARY KEY (id);

-- constraint/appointment_messages_appointment_id_channel_event_key_key
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_appointment_id_channel_event_key_key UNIQUE (appointment_id, channel, event_key);

-- constraint/appointment_messages_appointment_id_fkey
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- constraint/appointment_messages_channel_check
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_channel_check CHECK (channel = ANY (ARRAY['email'::text, 'whatsapp'::text]));

-- constraint/appointment_messages_clinic_id_fkey
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/appointment_messages_event_type_check
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_event_type_check CHECK (event_type = ANY (ARRAY['received'::text, 'confirmed'::text, 'rescheduled'::text]));

-- constraint/appointment_messages_pkey
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_pkey PRIMARY KEY (id);

-- constraint/appointment_messages_status_check
ALTER TABLE appointment_messages ADD CONSTRAINT appointment_messages_status_check CHECK (status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'obsolete'::text]));

-- constraint/appointments_approval_status_check
ALTER TABLE appointments ADD CONSTRAINT appointments_approval_status_check CHECK (approval_status = ANY (ARRAY['approved'::text, 'pending'::text]));

-- constraint/appointments_check
ALTER TABLE appointments ADD CONSTRAINT appointments_check CHECK (ends_at > starts_at);

-- constraint/appointments_clinic_id_fkey
ALTER TABLE appointments ADD CONSTRAINT appointments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/appointments_created_by_fkey
ALTER TABLE appointments ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/appointments_patient_id_fkey
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/appointments_pkey
ALTER TABLE appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

-- constraint/appointments_professional_id_fkey
ALTER TABLE appointments ADD CONSTRAINT appointments_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/appointments_status_check
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'checked_in'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text]));

-- constraint/audit_events_actor_id_fkey
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/audit_events_clinic_id_fkey
ALTER TABLE audit_events ADD CONSTRAINT audit_events_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/audit_events_pkey
ALTER TABLE audit_events ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);

-- constraint/clinical_records_appointment_id_fkey
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;

-- constraint/clinical_records_clinic_id_fkey
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/clinical_records_created_by_fkey
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/clinical_records_patient_id_fkey
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/clinical_records_pkey
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_pkey PRIMARY KEY (id);

-- constraint/clinical_records_record_type_check
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_record_type_check CHECK (record_type = ANY (ARRAY['anamnesis'::text, 'evolution'::text, 'procedure'::text, 'diagnosis'::text, 'observation'::text]));

-- constraint/clinics_pkey
ALTER TABLE clinics ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);

-- constraint/document_signers_clinic_id_fkey
ALTER TABLE document_signers ADD CONSTRAINT document_signers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/document_signers_document_id_fkey
ALTER TABLE document_signers ADD CONSTRAINT document_signers_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

-- constraint/document_signers_pkey
ALTER TABLE document_signers ADD CONSTRAINT document_signers_pkey PRIMARY KEY (id);

-- constraint/document_signers_signer_type_check
ALTER TABLE document_signers ADD CONSTRAINT document_signers_signer_type_check CHECK (signer_type = ANY (ARRAY['professional'::text, 'patient'::text]));

-- constraint/document_signers_signer_user_id_fkey
ALTER TABLE document_signers ADD CONSTRAINT document_signers_signer_user_id_fkey FOREIGN KEY (signer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/document_signers_signing_token_key
ALTER TABLE document_signers ADD CONSTRAINT document_signers_signing_token_key UNIQUE (signing_token);

-- constraint/document_signers_status_check
ALTER TABLE document_signers ADD CONSTRAINT document_signers_status_check CHECK (status = ANY (ARRAY['pending'::text, 'signed'::text, 'cancelled'::text]));

-- constraint/documents_clinic_id_fkey
ALTER TABLE documents ADD CONSTRAINT documents_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/documents_file_path_key
ALTER TABLE documents ADD CONSTRAINT documents_file_path_key UNIQUE (file_path);

-- constraint/documents_patient_id_fkey
ALTER TABLE documents ADD CONSTRAINT documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- constraint/documents_pkey
ALTER TABLE documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

-- constraint/documents_status_check
ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status = ANY (ARRAY['pending'::text, 'signed'::text, 'cancelled'::text]));

-- constraint/documents_uploaded_by_fkey
ALTER TABLE documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/financial_entries_clinic_id_fkey
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/financial_entries_patient_id_fkey
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- constraint/financial_entries_payment_item_id_fkey
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_payment_item_id_fkey FOREIGN KEY (payment_item_id) REFERENCES payment_items(id) ON DELETE SET NULL;

-- constraint/financial_entries_pkey
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_pkey PRIMARY KEY (id);

-- constraint/financial_entries_treatment_plan_id_fkey
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_treatment_plan_id_fkey FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE SET NULL;

-- constraint/fiscal_documents_amount_check
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_amount_check CHECK (amount >= 0::numeric);

-- constraint/fiscal_documents_clinic_id_fkey
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/fiscal_documents_created_by_fkey
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/fiscal_documents_document_type_check
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_document_type_check CHECK (document_type = ANY (ARRAY['nfse'::text, 'receipt'::text]));

-- constraint/fiscal_documents_patient_id_fkey
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- constraint/fiscal_documents_pkey
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_pkey PRIMARY KEY (id);

-- constraint/fiscal_documents_status_check
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_status_check CHECK (status = ANY (ARRAY['draft'::text, 'queued'::text, 'issued'::text, 'cancelled'::text, 'failed'::text]));

-- constraint/fiscal_documents_treatment_plan_id_fkey
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_treatment_plan_id_fkey FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE SET NULL;

-- constraint/import_batches_clinic_id_fkey
ALTER TABLE import_batches ADD CONSTRAINT import_batches_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/import_batches_created_by_fkey
ALTER TABLE import_batches ADD CONSTRAINT import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/import_batches_error_rows_check
ALTER TABLE import_batches ADD CONSTRAINT import_batches_error_rows_check CHECK (error_rows >= 0);

-- constraint/import_batches_imported_rows_check
ALTER TABLE import_batches ADD CONSTRAINT import_batches_imported_rows_check CHECK (imported_rows >= 0);

-- constraint/import_batches_pkey
ALTER TABLE import_batches ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);

-- constraint/import_batches_status_check
ALTER TABLE import_batches ADD CONSTRAINT import_batches_status_check CHECK (status = ANY (ARRAY['uploaded'::text, 'validating'::text, 'ready'::text, 'importing'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text, 'rolled_back'::text]));

-- constraint/import_batches_total_rows_check
ALTER TABLE import_batches ADD CONSTRAINT import_batches_total_rows_check CHECK (total_rows >= 0);

-- constraint/import_batches_valid_rows_check
ALTER TABLE import_batches ADD CONSTRAINT import_batches_valid_rows_check CHECK (valid_rows >= 0);

-- constraint/import_rows_batch_id_entity_type_row_number_key
ALTER TABLE import_rows ADD CONSTRAINT import_rows_batch_id_entity_type_row_number_key UNIQUE (batch_id, entity_type, row_number);

-- constraint/import_rows_batch_id_fkey
ALTER TABLE import_rows ADD CONSTRAINT import_rows_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE;

-- constraint/import_rows_clinic_id_fkey
ALTER TABLE import_rows ADD CONSTRAINT import_rows_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/import_rows_pkey
ALTER TABLE import_rows ADD CONSTRAINT import_rows_pkey PRIMARY KEY (id);

-- constraint/import_rows_row_number_check
ALTER TABLE import_rows ADD CONSTRAINT import_rows_row_number_check CHECK (row_number > 0);

-- constraint/import_rows_status_check
ALTER TABLE import_rows ADD CONSTRAINT import_rows_status_check CHECK (status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text, 'imported'::text, 'skipped'::text, 'rolled_back'::text]));

-- constraint/medications_clinic_id_fkey
ALTER TABLE medications ADD CONSTRAINT medications_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/medications_pkey
ALTER TABLE medications ADD CONSTRAINT medications_pkey PRIMARY KEY (id);

-- constraint/opportunities_category_check
ALTER TABLE opportunities ADD CONSTRAINT opportunities_category_check CHECK (category = ANY (ARRAY['no_return'::text, 'no_show'::text, 'cancelled'::text, 'treatment_interrupted'::text, 'budget_pending'::text, 'cleaning_due'::text, 'other'::text]));

-- constraint/opportunities_clinic_id_fkey
ALTER TABLE opportunities ADD CONSTRAINT opportunities_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/opportunities_patient_id_fkey
ALTER TABLE opportunities ADD CONSTRAINT opportunities_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/opportunities_pkey
ALTER TABLE opportunities ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);

-- constraint/opportunities_priority_check
ALTER TABLE opportunities ADD CONSTRAINT opportunities_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]));

-- constraint/opportunities_status_check
ALTER TABLE opportunities ADD CONSTRAINT opportunities_status_check CHECK (status = ANY (ARRAY['open'::text, 'contacting'::text, 'scheduled'::text, 'recovered'::text, 'lost'::text, 'archived'::text]));

-- constraint/patient_anamneses_clinic_id_fkey
ALTER TABLE patient_anamneses ADD CONSTRAINT patient_anamneses_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/patient_anamneses_patient_id_fkey
ALTER TABLE patient_anamneses ADD CONSTRAINT patient_anamneses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/patient_anamneses_pkey
ALTER TABLE patient_anamneses ADD CONSTRAINT patient_anamneses_pkey PRIMARY KEY (id);

-- constraint/patient_documents_clinic_id_fkey
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/patient_documents_created_by_fkey
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- constraint/patient_documents_patient_id_fkey
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/patient_documents_pkey
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_pkey PRIMARY KEY (id);

-- constraint/patient_documents_signer_scope_check
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_signer_scope_check CHECK (signer_scope = ANY (ARRAY['professional'::text, 'patient'::text, 'both'::text]));

-- constraint/patient_documents_status_check
ALTER TABLE patient_documents ADD CONSTRAINT patient_documents_status_check CHECK (status = ANY (ARRAY['uploaded'::text, 'waiting_professional'::text, 'waiting_patient'::text, 'waiting_both'::text, 'signed'::text, 'cancelled'::text]));

-- constraint/patient_message_settings_clinic_id_fkey
ALTER TABLE patient_message_settings ADD CONSTRAINT patient_message_settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/patient_message_settings_pkey
ALTER TABLE patient_message_settings ADD CONSTRAINT patient_message_settings_pkey PRIMARY KEY (clinic_id);

-- constraint/patient_message_settings_sender_phone_check
ALTER TABLE patient_message_settings ADD CONSTRAINT patient_message_settings_sender_phone_check CHECK (sender_phone ~ '^\+55[0-9]{10,11}$'::text);

-- constraint/patient_timeline_clinic_id_fkey
ALTER TABLE patient_timeline ADD CONSTRAINT patient_timeline_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/patient_timeline_created_by_fkey
ALTER TABLE patient_timeline ADD CONSTRAINT patient_timeline_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- constraint/patient_timeline_event_type_check
ALTER TABLE patient_timeline ADD CONSTRAINT patient_timeline_event_type_check CHECK (event_type = ANY (ARRAY['appointment'::text, 'treatment'::text, 'budget'::text, 'message'::text, 'prescription'::text, 'signature'::text, 'payment'::text, 'document'::text, 'recovery'::text, 'note'::text]));

-- constraint/patient_timeline_patient_id_fkey
ALTER TABLE patient_timeline ADD CONSTRAINT patient_timeline_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/patient_timeline_pkey
ALTER TABLE patient_timeline ADD CONSTRAINT patient_timeline_pkey PRIMARY KEY (id);

-- constraint/patients_clinic_id_fkey
ALTER TABLE patients ADD CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/patients_pkey
ALTER TABLE patients ADD CONSTRAINT patients_pkey PRIMARY KEY (id);

-- constraint/patients_risk_score_check
ALTER TABLE patients ADD CONSTRAINT patients_risk_score_check CHECK (risk_score >= 0 AND risk_score <= 100);

-- constraint/patients_social_name_length
ALTER TABLE patients ADD CONSTRAINT patients_social_name_length CHECK (social_name IS NULL OR char_length(social_name) <= 160);

-- constraint/payment_headers_clinic_id_fkey
ALTER TABLE payment_headers ADD CONSTRAINT payment_headers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/payment_headers_patient_id_fkey
ALTER TABLE payment_headers ADD CONSTRAINT payment_headers_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- constraint/payment_headers_pkey
ALTER TABLE payment_headers ADD CONSTRAINT payment_headers_pkey PRIMARY KEY (id);

-- constraint/payment_headers_treatment_plan_id_fkey
ALTER TABLE payment_headers ADD CONSTRAINT payment_headers_treatment_plan_id_fkey FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE SET NULL;

-- constraint/payment_items_clinic_id_fkey
ALTER TABLE payment_items ADD CONSTRAINT payment_items_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/payment_items_patient_id_fkey
ALTER TABLE payment_items ADD CONSTRAINT payment_items_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

-- constraint/payment_items_payment_header_id_fkey
ALTER TABLE payment_items ADD CONSTRAINT payment_items_payment_header_id_fkey FOREIGN KEY (payment_header_id) REFERENCES payment_headers(id) ON DELETE SET NULL;

-- constraint/payment_items_pkey
ALTER TABLE payment_items ADD CONSTRAINT payment_items_pkey PRIMARY KEY (id);

-- constraint/prescription_items_clinic_id_fkey
ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/prescription_items_medication_id_fkey
ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE SET NULL;

-- constraint/prescription_items_pkey
ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);

-- constraint/prescription_items_prescription_id_fkey
ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

-- constraint/prescription_signatures_clinic_id_fkey
ALTER TABLE prescription_signatures ADD CONSTRAINT prescription_signatures_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/prescription_signatures_pkey
ALTER TABLE prescription_signatures ADD CONSTRAINT prescription_signatures_pkey PRIMARY KEY (id);

-- constraint/prescription_signatures_prescription_id_fkey
ALTER TABLE prescription_signatures ADD CONSTRAINT prescription_signatures_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;

-- constraint/prescription_signatures_signature_type_check
ALTER TABLE prescription_signatures ADD CONSTRAINT prescription_signatures_signature_type_check CHECK (signature_type = ANY (ARRAY['internal'::text, 'external'::text, 'qualified'::text]));

-- constraint/prescription_signatures_signer_id_fkey
ALTER TABLE prescription_signatures ADD CONSTRAINT prescription_signatures_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES auth.users(id);

-- constraint/prescriptions_author_id_fkey
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);

-- constraint/prescriptions_clinic_id_fkey
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/prescriptions_patient_id_fkey
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/prescriptions_pkey
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);

-- constraint/prescriptions_status_check
ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_status_check CHECK (status = ANY (ARRAY['draft'::text, 'pending_signature'::text, 'signed'::text, 'cancelled'::text]));

-- constraint/professionals_clinic_id_fkey
ALTER TABLE professionals ADD CONSTRAINT professionals_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/professionals_pkey
ALTER TABLE professionals ADD CONSTRAINT professionals_pkey PRIMARY KEY (id);

-- constraint/profiles_clinic_id_fkey
ALTER TABLE profiles ADD CONSTRAINT profiles_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/profiles_id_fkey
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- constraint/profiles_pkey
ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- constraint/profiles_role_check
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'dentist'::text, 'reception'::text, 'financial'::text, 'staff'::text]));

-- constraint/recovery_actions_acted_by_fkey
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_acted_by_fkey FOREIGN KEY (acted_by) REFERENCES auth.users(id);

-- constraint/recovery_actions_action_type_check
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_action_type_check CHECK (action_type = ANY (ARRAY['message_prepared'::text, 'message_sent'::text, 'call'::text, 'appointment_offered'::text, 'appointment_scheduled'::text, 'recovered'::text, 'note'::text]));

-- constraint/recovery_actions_clinic_id_fkey
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/recovery_actions_opportunity_id_fkey
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;

-- constraint/recovery_actions_patient_id_fkey
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/recovery_actions_pkey
ALTER TABLE recovery_actions ADD CONSTRAINT recovery_actions_pkey PRIMARY KEY (id);

-- constraint/reminders_appointment_id_fkey
ALTER TABLE reminders ADD CONSTRAINT reminders_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;

-- constraint/reminders_attempts_check
ALTER TABLE reminders ADD CONSTRAINT reminders_attempts_check CHECK (attempts >= 0);

-- constraint/reminders_channel_check
ALTER TABLE reminders ADD CONSTRAINT reminders_channel_check CHECK (channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'in_app'::text]));

-- constraint/reminders_clinic_id_fkey
ALTER TABLE reminders ADD CONSTRAINT reminders_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/reminders_patient_id_fkey
ALTER TABLE reminders ADD CONSTRAINT reminders_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/reminders_pkey
ALTER TABLE reminders ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);

-- constraint/reminders_recipient_type_check
ALTER TABLE reminders ADD CONSTRAINT reminders_recipient_type_check CHECK (recipient_type = ANY (ARRAY['patient'::text, 'professional'::text, 'clinic'::text]));

-- constraint/reminders_reminder_type_check
ALTER TABLE reminders ADD CONSTRAINT reminders_reminder_type_check CHECK (reminder_type = ANY (ARRAY['booking'::text, 'confirmation_24h'::text, 'reminder_1h'::text, 'birthday'::text, 'recall'::text, 'custom'::text]));

-- constraint/reminders_status_check
ALTER TABLE reminders ADD CONSTRAINT reminders_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]));

-- constraint/stock_items_category_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_category_check CHECK (category = ANY (ARRAY['material'::text, 'medication'::text, 'product'::text, 'supply'::text, 'cleaning'::text]));

-- constraint/stock_items_clinic_id_fkey
ALTER TABLE stock_items ADD CONSTRAINT stock_items_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id);

-- constraint/stock_items_clinic_id_name_category_lot_code_key
ALTER TABLE stock_items ADD CONSTRAINT stock_items_clinic_id_name_category_lot_code_key UNIQUE (clinic_id, name, category, lot_code);

-- constraint/stock_items_created_by_fkey
ALTER TABLE stock_items ADD CONSTRAINT stock_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

-- constraint/stock_items_invoice_item_number_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_invoice_item_number_check CHECK (invoice_item_number IS NULL OR invoice_item_number > 0);

-- constraint/stock_items_invoice_line_unique
ALTER TABLE stock_items ADD CONSTRAINT stock_items_invoice_line_unique UNIQUE (clinic_id, invoice_key, invoice_item_number);

-- constraint/stock_items_minimum_quantity_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_minimum_quantity_check CHECK (minimum_quantity >= 0::numeric);

-- constraint/stock_items_name_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_name_check CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 160);

-- constraint/stock_items_pkey
ALTER TABLE stock_items ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);

-- constraint/stock_items_quantity_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_quantity_check CHECK (quantity >= 0::numeric);

-- constraint/stock_items_unit_price_check
ALTER TABLE stock_items ADD CONSTRAINT stock_items_unit_price_check CHECK (unit_price >= 0::numeric);

-- constraint/treatment_operations_clinic_id_fkey
ALTER TABLE treatment_operations ADD CONSTRAINT treatment_operations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/treatment_operations_patient_id_fkey
ALTER TABLE treatment_operations ADD CONSTRAINT treatment_operations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/treatment_operations_pkey
ALTER TABLE treatment_operations ADD CONSTRAINT treatment_operations_pkey PRIMARY KEY (id);

-- constraint/treatment_plan_items_clinic_id_fkey
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/treatment_plan_items_pkey
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_pkey PRIMARY KEY (id);

-- constraint/treatment_plan_items_quantity_check
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_quantity_check CHECK (quantity > 0::numeric);

-- constraint/treatment_plan_items_status_check
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_status_check CHECK (status = ANY (ARRAY['planned'::text, 'authorized'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));

-- constraint/treatment_plan_items_treatment_plan_id_fkey
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_treatment_plan_id_fkey FOREIGN KEY (treatment_plan_id) REFERENCES treatment_plans(id) ON DELETE CASCADE;

-- constraint/treatment_plan_items_unit_amount_check
ALTER TABLE treatment_plan_items ADD CONSTRAINT treatment_plan_items_unit_amount_check CHECK (unit_amount >= 0::numeric);

-- constraint/treatment_plans_clinic_id_fkey
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- constraint/treatment_plans_created_by_fkey
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- constraint/treatment_plans_patient_id_fkey
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

-- constraint/treatment_plans_pkey
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_pkey PRIMARY KEY (id);

-- constraint/treatment_plans_status_check
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_status_check CHECK (status = ANY (ARRAY['draft'::text, 'presented'::text, 'approved'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));

-- constraint/treatment_plans_total_amount_check
ALTER TABLE treatment_plans ADD CONSTRAINT treatment_plans_total_amount_check CHECK (total_amount >= 0::numeric);

-- index/accounts_payable_clinic_due
CREATE INDEX accounts_payable_clinic_due ON public.accounts_payable USING btree (clinic_id, due_on);

-- index/agenda_windows_range
CREATE INDEX agenda_windows_range ON public.agenda_windows USING btree (clinic_id, starts_at, ends_at);

-- index/anamnesis_questions_natural_unique
CREATE UNIQUE INDEX anamnesis_questions_natural_unique ON public.anamnesis_questions USING btree (clinic_id, question, COALESCE(sequence, '-1'::integer), COALESCE(template_description, ''::text), COALESCE(template_expertise, ''::text), COALESCE(template_type, ''::text));

-- index/appointment_messages_pending
CREATE INDEX appointment_messages_pending ON public.appointment_messages USING btree (clinic_id, next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));

-- index/appointments_clinic_start_idx
CREATE INDEX appointments_clinic_start_idx ON public.appointments USING btree (clinic_id, starts_at);

-- index/appointments_created_by_idx
CREATE INDEX appointments_created_by_idx ON public.appointments USING btree (created_by);

-- index/appointments_external_unique
CREATE UNIQUE INDEX appointments_external_unique ON public.appointments USING btree (clinic_id, source, external_id) WHERE (external_id IS NOT NULL);

-- index/appointments_patient_start_idx
CREATE INDEX appointments_patient_start_idx ON public.appointments USING btree (patient_id, starts_at DESC);

-- index/appointments_professional_start_idx
CREATE INDEX appointments_professional_start_idx ON public.appointments USING btree (professional_id, starts_at);

-- index/audit_events_actor_idx
CREATE INDEX audit_events_actor_idx ON public.audit_events USING btree (actor_id);

-- index/audit_events_clinic_date_idx
CREATE INDEX audit_events_clinic_date_idx ON public.audit_events USING btree (clinic_id, occurred_at DESC);

-- index/audit_events_entity_idx
CREATE INDEX audit_events_entity_idx ON public.audit_events USING btree (clinic_id, entity_type, entity_id);

-- index/clinical_odontogram_tooth_unique
CREATE UNIQUE INDEX clinical_odontogram_tooth_unique ON public.clinical_records USING btree (clinic_id, patient_id, external_source, external_id) WHERE (external_source = 'alegrare_odontogram'::text);

-- index/clinical_records_appointment_idx
CREATE INDEX clinical_records_appointment_idx ON public.clinical_records USING btree (appointment_id);

-- index/clinical_records_created_by_idx
CREATE INDEX clinical_records_created_by_idx ON public.clinical_records USING btree (created_by);

-- index/clinical_records_external_unique
CREATE UNIQUE INDEX clinical_records_external_unique ON public.clinical_records USING btree (clinic_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));

-- index/clinical_records_patient_date_idx
CREATE INDEX clinical_records_patient_date_idx ON public.clinical_records USING btree (patient_id, created_at DESC);

-- index/document_signers_clinic_status_idx
CREATE INDEX document_signers_clinic_status_idx ON public.document_signers USING btree (clinic_id, status);

-- index/document_signers_document_idx
CREATE INDEX document_signers_document_idx ON public.document_signers USING btree (document_id);

-- index/document_signers_user_idx
CREATE INDEX document_signers_user_idx ON public.document_signers USING btree (signer_user_id);

-- index/documents_clinic_created_idx
CREATE INDEX documents_clinic_created_idx ON public.documents USING btree (clinic_id, created_at DESC);

-- index/documents_patient_idx
CREATE INDEX documents_patient_idx ON public.documents USING btree (patient_id);

-- index/documents_uploaded_by_idx
CREATE INDEX documents_uploaded_by_idx ON public.documents USING btree (uploaded_by);

-- index/financial_entries_external_unique
CREATE UNIQUE INDEX financial_entries_external_unique ON public.financial_entries USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/financial_entries_patient_date_idx
CREATE INDEX financial_entries_patient_date_idx ON public.financial_entries USING btree (patient_id, date DESC);

-- index/financial_entries_payment_item_idx
CREATE INDEX financial_entries_payment_item_idx ON public.financial_entries USING btree (payment_item_id);

-- index/financial_entries_treatment_plan_idx
CREATE INDEX financial_entries_treatment_plan_idx ON public.financial_entries USING btree (treatment_plan_id);

-- index/fiscal_documents_clinic_date_idx
CREATE INDEX fiscal_documents_clinic_date_idx ON public.fiscal_documents USING btree (clinic_id, created_at DESC);

-- index/fiscal_documents_created_by_idx
CREATE INDEX fiscal_documents_created_by_idx ON public.fiscal_documents USING btree (created_by);

-- index/fiscal_documents_patient_idx
CREATE INDEX fiscal_documents_patient_idx ON public.fiscal_documents USING btree (patient_id);

-- index/fiscal_documents_treatment_plan_idx
CREATE INDEX fiscal_documents_treatment_plan_idx ON public.fiscal_documents USING btree (treatment_plan_id);

-- index/import_batches_clinic_date_idx
CREATE INDEX import_batches_clinic_date_idx ON public.import_batches USING btree (clinic_id, created_at DESC);

-- index/import_batches_created_by_idx
CREATE INDEX import_batches_created_by_idx ON public.import_batches USING btree (created_by);

-- index/import_rows_batch_status_idx
CREATE INDEX import_rows_batch_status_idx ON public.import_rows USING btree (batch_id, status);

-- index/import_rows_source_idx
CREATE INDEX import_rows_source_idx ON public.import_rows USING btree (clinic_id, entity_type, source_id) WHERE (source_id IS NOT NULL);

-- index/medications_clinic_idx
CREATE INDEX medications_clinic_idx ON public.medications USING btree (clinic_id);

-- index/medications_name_trgm_idx
CREATE INDEX medications_name_trgm_idx ON public.medications USING gin (display_name gin_trgm_ops);

-- index/opportunities_clinic_status_idx
CREATE INDEX opportunities_clinic_status_idx ON public.opportunities USING btree (clinic_id, status, priority);

-- index/opportunities_patient_idx
CREATE INDEX opportunities_patient_idx ON public.opportunities USING btree (patient_id);

-- index/patient_anamneses_external_unique
CREATE UNIQUE INDEX patient_anamneses_external_unique ON public.patient_anamneses USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/patient_anamneses_patient_date_idx
CREATE INDEX patient_anamneses_patient_date_idx ON public.patient_anamneses USING btree (patient_id, anamnesis_date DESC);

-- index/patient_documents_clinic_status_idx
CREATE INDEX patient_documents_clinic_status_idx ON public.patient_documents USING btree (clinic_id, status);

-- index/patient_documents_created_by_idx
CREATE INDEX patient_documents_created_by_idx ON public.patient_documents USING btree (created_by);

-- index/patient_documents_patient_idx
CREATE INDEX patient_documents_patient_idx ON public.patient_documents USING btree (patient_id, created_at DESC);

-- index/patient_documents_sign_token_idx
CREATE UNIQUE INDEX patient_documents_sign_token_idx ON public.patient_documents USING btree (patient_sign_token);

-- index/patient_timeline_clinic_patient_idx
CREATE INDEX patient_timeline_clinic_patient_idx ON public.patient_timeline USING btree (clinic_id, patient_id, occurred_at DESC);

-- index/patient_timeline_created_by_idx
CREATE INDEX patient_timeline_created_by_idx ON public.patient_timeline USING btree (created_by);

-- index/patient_timeline_patient_idx
CREATE INDEX patient_timeline_patient_idx ON public.patient_timeline USING btree (patient_id);

-- index/patients_clinic_cpf_unique
CREATE UNIQUE INDEX patients_clinic_cpf_unique ON public.patients USING btree (clinic_id, cpf) WHERE ((cpf IS NOT NULL) AND (cpf <> ''::text));

-- index/patients_clinic_external_unique
CREATE UNIQUE INDEX patients_clinic_external_unique ON public.patients USING btree (clinic_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));

-- index/patients_clinic_idx
CREATE INDEX patients_clinic_idx ON public.patients USING btree (clinic_id);

-- index/patients_clinic_name_idx
CREATE INDEX patients_clinic_name_idx ON public.patients USING btree (clinic_id, full_name);

-- index/patients_external_unique
CREATE UNIQUE INDEX patients_external_unique ON public.patients USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/payment_headers_external_unique
CREATE UNIQUE INDEX payment_headers_external_unique ON public.payment_headers USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/payment_headers_patient_idx
CREATE INDEX payment_headers_patient_idx ON public.payment_headers USING btree (patient_id);

-- index/payment_headers_treatment_plan_idx
CREATE INDEX payment_headers_treatment_plan_idx ON public.payment_headers USING btree (treatment_plan_id);

-- index/payment_items_external_unique
CREATE UNIQUE INDEX payment_items_external_unique ON public.payment_items USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/payment_items_header_idx
CREATE INDEX payment_items_header_idx ON public.payment_items USING btree (payment_header_id);

-- index/payment_items_patient_idx
CREATE INDEX payment_items_patient_idx ON public.payment_items USING btree (patient_id);

-- index/prescription_items_clinic_idx
CREATE INDEX prescription_items_clinic_idx ON public.prescription_items USING btree (clinic_id);

-- index/prescription_items_medication_idx
CREATE INDEX prescription_items_medication_idx ON public.prescription_items USING btree (medication_id);

-- index/prescription_items_prescription_idx
CREATE INDEX prescription_items_prescription_idx ON public.prescription_items USING btree (prescription_id, "position");

-- index/prescription_signatures_clinic_idx
CREATE INDEX prescription_signatures_clinic_idx ON public.prescription_signatures USING btree (clinic_id, signed_at DESC);

-- index/prescription_signatures_prescription_idx
CREATE INDEX prescription_signatures_prescription_idx ON public.prescription_signatures USING btree (prescription_id);

-- index/prescription_signatures_signer_idx
CREATE INDEX prescription_signatures_signer_idx ON public.prescription_signatures USING btree (signer_id);

-- index/prescriptions_author_idx
CREATE INDEX prescriptions_author_idx ON public.prescriptions USING btree (author_id);

-- index/prescriptions_clinic_patient_idx
CREATE INDEX prescriptions_clinic_patient_idx ON public.prescriptions USING btree (clinic_id, patient_id, created_at DESC);

-- index/prescriptions_patient_idx
CREATE INDEX prescriptions_patient_idx ON public.prescriptions USING btree (patient_id);

-- index/professionals_external_unique
CREATE UNIQUE INDEX professionals_external_unique ON public.professionals USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/profiles_clinic_idx
CREATE INDEX profiles_clinic_idx ON public.profiles USING btree (clinic_id);

-- index/recovery_actions_acted_by_idx
CREATE INDEX recovery_actions_acted_by_idx ON public.recovery_actions USING btree (acted_by);

-- index/recovery_actions_clinic_patient_idx
CREATE INDEX recovery_actions_clinic_patient_idx ON public.recovery_actions USING btree (clinic_id, patient_id, acted_at DESC);

-- index/recovery_actions_opportunity_idx
CREATE INDEX recovery_actions_opportunity_idx ON public.recovery_actions USING btree (opportunity_id);

-- index/recovery_actions_patient_idx
CREATE INDEX recovery_actions_patient_idx ON public.recovery_actions USING btree (patient_id);

-- index/reminders_appointment_idx
CREATE INDEX reminders_appointment_idx ON public.reminders USING btree (appointment_id);

-- index/reminders_clinic_patient_idx
CREATE INDEX reminders_clinic_patient_idx ON public.reminders USING btree (clinic_id, patient_id, scheduled_at DESC);

-- index/reminders_dispatch_idx
CREATE INDEX reminders_dispatch_idx ON public.reminders USING btree (status, scheduled_at) WHERE (status = 'pending'::text);

-- index/reminders_patient_idx
CREATE INDEX reminders_patient_idx ON public.reminders USING btree (patient_id);

-- index/stock_items_clinic_expiry
CREATE INDEX stock_items_clinic_expiry ON public.stock_items USING btree (clinic_id, expires_on);

-- index/stock_items_identity_unique
CREATE UNIQUE INDEX stock_items_identity_unique ON public.stock_items USING btree (clinic_id, lower(TRIM(BOTH FROM name)), category, lower(TRIM(BOTH FROM lot_code)));

-- index/treatment_operations_external_unique
CREATE UNIQUE INDEX treatment_operations_external_unique ON public.treatment_operations USING btree (clinic_id, external_source, external_id) WHERE (external_id IS NOT NULL);

-- index/treatment_operations_patient_idx
CREATE INDEX treatment_operations_patient_idx ON public.treatment_operations USING btree (patient_id);

-- index/treatment_plan_items_clinic_idx
CREATE INDEX treatment_plan_items_clinic_idx ON public.treatment_plan_items USING btree (clinic_id);

-- index/treatment_plan_items_plan_idx
CREATE INDEX treatment_plan_items_plan_idx ON public.treatment_plan_items USING btree (treatment_plan_id, "position");

-- index/treatment_plans_created_by_idx
CREATE INDEX treatment_plans_created_by_idx ON public.treatment_plans USING btree (created_by);

-- index/treatment_plans_external_unique
CREATE UNIQUE INDEX treatment_plans_external_unique ON public.treatment_plans USING btree (clinic_id, external_source, external_id) WHERE ((external_source IS NOT NULL) AND (external_id IS NOT NULL));

-- index/treatment_plans_patient_status_idx
CREATE INDEX treatment_plans_patient_status_idx ON public.treatment_plans USING btree (patient_id, status);

-- rls/accounts_payable
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- rls/agenda_notifications
ALTER TABLE public.agenda_notifications ENABLE ROW LEVEL SECURITY;

-- rls/agenda_settings
ALTER TABLE public.agenda_settings ENABLE ROW LEVEL SECURITY;

-- rls/agenda_windows
ALTER TABLE public.agenda_windows ENABLE ROW LEVEL SECURITY;

-- rls/anamnesis_questions
ALTER TABLE public.anamnesis_questions ENABLE ROW LEVEL SECURITY;

-- rls/appointment_messages
ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

-- rls/appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- rls/audit_events
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- rls/clinical_records
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

-- rls/clinics
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- rls/document_signers
ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;

-- rls/documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- rls/financial_entries
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- rls/fiscal_documents
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

-- rls/import_batches
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- rls/import_rows
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

-- rls/medications
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- rls/opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- rls/patient_anamneses
ALTER TABLE public.patient_anamneses ENABLE ROW LEVEL SECURITY;

-- rls/patient_documents
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- rls/patient_message_settings
ALTER TABLE public.patient_message_settings ENABLE ROW LEVEL SECURITY;

-- rls/patient_timeline
ALTER TABLE public.patient_timeline ENABLE ROW LEVEL SECURITY;

-- rls/patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- rls/payment_headers
ALTER TABLE public.payment_headers ENABLE ROW LEVEL SECURITY;

-- rls/payment_items
ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;

-- rls/prescription_items
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- rls/prescription_signatures
ALTER TABLE public.prescription_signatures ENABLE ROW LEVEL SECURITY;

-- rls/prescriptions
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- rls/professionals
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- rls/profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- rls/recovery_actions
ALTER TABLE public.recovery_actions ENABLE ROW LEVEL SECURITY;

-- rls/reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- rls/stock_items
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- rls/treatment_operations
ALTER TABLE public.treatment_operations ENABLE ROW LEVEL SECURITY;

-- rls/treatment_plan_items
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;

-- rls/treatment_plans
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

-- policy/public.accounts_payable.accounts_payable_clinic_insert
CREATE POLICY accounts_payable_clinic_insert ON public.accounts_payable AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (created_by = ( SELECT auth.uid() AS uid))));

-- policy/public.accounts_payable.accounts_payable_clinic_select
CREATE POLICY accounts_payable_clinic_select ON public.accounts_payable AS PERMISSIVE FOR SELECT TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.accounts_payable.accounts_payable_clinic_update
CREATE POLICY accounts_payable_clinic_update ON public.accounts_payable AS PERMISSIVE FOR UPDATE TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.agenda_notifications.agenda_notification_read
CREATE POLICY agenda_notification_read ON public.agenda_notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((recipient_id = ( SELECT auth.uid() AS uid)));

-- policy/public.agenda_settings.agenda_settings_initialize
CREATE POLICY agenda_settings_initialize ON public.agenda_settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (owner_id = ( SELECT auth.uid() AS uid)) AND (notification_active = false)));

-- policy/public.agenda_settings.agenda_settings_read
CREATE POLICY agenda_settings_read ON public.agenda_settings AS PERMISSIVE FOR SELECT TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.agenda_settings.agenda_settings_update
CREATE POLICY agenda_settings_update ON public.agenda_settings AS PERMISSIVE FOR UPDATE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) AND (clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));

-- policy/public.agenda_windows.agenda_windows_delete
CREATE POLICY agenda_windows_delete ON public.agenda_windows AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM agenda_settings s
  WHERE ((s.clinic_id = agenda_windows.clinic_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));

-- policy/public.agenda_windows.agenda_windows_read
CREATE POLICY agenda_windows_read ON public.agenda_windows AS PERMISSIVE FOR SELECT TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.anamnesis_questions.clinic_anamnesis_questions_all
CREATE POLICY clinic_anamnesis_questions_all ON public.anamnesis_questions AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.appointments.clinic_appointments_all
CREATE POLICY clinic_appointments_all ON public.appointments AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.audit_events.clinic_audit_events_insert
CREATE POLICY clinic_audit_events_insert ON public.audit_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)) AND (actor_id = ( SELECT auth.uid() AS uid))));

-- policy/public.audit_events.clinic_audit_events_select
CREATE POLICY clinic_audit_events_select ON public.audit_events AS PERMISSIVE FOR SELECT TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.clinical_records.clinic_clinical_records_all
CREATE POLICY clinic_clinical_records_all ON public.clinical_records AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.clinics.members_view_clinic
CREATE POLICY members_view_clinic ON public.clinics AS PERMISSIVE FOR SELECT TO authenticated USING ((id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.document_signers.clinic_document_signers_all
CREATE POLICY clinic_document_signers_all ON public.document_signers AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.documents.clinic_documents_all
CREATE POLICY clinic_documents_all ON public.documents AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.financial_entries.clinic_financial_entries_all
CREATE POLICY clinic_financial_entries_all ON public.financial_entries AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.fiscal_documents.clinic_fiscal_documents_all
CREATE POLICY clinic_fiscal_documents_all ON public.fiscal_documents AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.import_batches.owner_import_batches_all
CREATE POLICY owner_import_batches_all ON public.import_batches AS PERMISSIVE FOR ALL TO authenticated USING (((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'owner'::text)))))) WITH CHECK (((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'owner'::text))))));

-- policy/public.import_rows.owner_import_rows_all
CREATE POLICY owner_import_rows_all ON public.import_rows AS PERMISSIVE FOR ALL TO authenticated USING (((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'owner'::text)))))) WITH CHECK (((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'owner'::text))))));

-- policy/public.medications.clinic_medications_delete
CREATE POLICY clinic_medications_delete ON public.medications AS PERMISSIVE FOR DELETE TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.medications.clinic_medications_insert
CREATE POLICY clinic_medications_insert ON public.medications AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.medications.clinic_medications_read
CREATE POLICY clinic_medications_read ON public.medications AS PERMISSIVE FOR SELECT TO authenticated USING (((clinic_id IS NULL) OR (clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))));

-- policy/public.medications.clinic_medications_update
CREATE POLICY clinic_medications_update ON public.medications AS PERMISSIVE FOR UPDATE TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.opportunities.clinic_opportunities_all
CREATE POLICY clinic_opportunities_all ON public.opportunities AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.patient_anamneses.clinic_patient_anamneses_all
CREATE POLICY clinic_patient_anamneses_all ON public.patient_anamneses AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.patient_documents.clinic_patient_documents_all
CREATE POLICY clinic_patient_documents_all ON public.patient_documents AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.patient_timeline.clinic_timeline_all
CREATE POLICY clinic_timeline_all ON public.patient_timeline AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.patients.clinic_patients_all
CREATE POLICY clinic_patients_all ON public.patients AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.payment_headers.clinic_payment_headers_all
CREATE POLICY clinic_payment_headers_all ON public.payment_headers AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.payment_items.clinic_payment_items_all
CREATE POLICY clinic_payment_items_all ON public.payment_items AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.prescription_items.clinic_prescription_items_all
CREATE POLICY clinic_prescription_items_all ON public.prescription_items AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.prescription_signatures.clinic_signatures_all
CREATE POLICY clinic_signatures_all ON public.prescription_signatures AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.prescriptions.clinic_prescriptions_all
CREATE POLICY clinic_prescriptions_all ON public.prescriptions AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.professionals.clinic_professionals_all
CREATE POLICY clinic_professionals_all ON public.professionals AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.profiles.users_view_own_profile
CREATE POLICY users_view_own_profile ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));

-- policy/public.recovery_actions.clinic_recovery_actions_all
CREATE POLICY clinic_recovery_actions_all ON public.recovery_actions AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.reminders.clinic_reminders_all
CREATE POLICY clinic_reminders_all ON public.reminders AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.stock_items.stock_items_clinic_insert
CREATE POLICY stock_items_clinic_insert ON public.stock_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (created_by = ( SELECT auth.uid() AS uid))));

-- policy/public.stock_items.stock_items_clinic_select
CREATE POLICY stock_items_clinic_select ON public.stock_items AS PERMISSIVE FOR SELECT TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.stock_items.stock_items_clinic_update
CREATE POLICY stock_items_clinic_update ON public.stock_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((clinic_id = ( SELECT profiles.clinic_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));

-- policy/public.treatment_operations.clinic_treatment_operations_all
CREATE POLICY clinic_treatment_operations_all ON public.treatment_operations AS PERMISSIVE FOR ALL TO public USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.treatment_plan_items.clinic_treatment_plan_items_all
CREATE POLICY clinic_treatment_plan_items_all ON public.treatment_plan_items AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/public.treatment_plans.clinic_treatment_plans_all
CREATE POLICY clinic_treatment_plans_all ON public.treatment_plans AS PERMISSIVE FOR ALL TO authenticated USING ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id))) WITH CHECK ((clinic_id = ( SELECT private.current_clinic_id() AS current_clinic_id)));

-- policy/storage.objects.clinic_documents_storage_delete
CREATE POLICY clinic_documents_storage_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'clinic-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT private.current_clinic_id() AS current_clinic_id))::text)));

-- policy/storage.objects.clinic_documents_storage_insert
CREATE POLICY clinic_documents_storage_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'clinic-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT private.current_clinic_id() AS current_clinic_id))::text)));

-- policy/storage.objects.clinic_documents_storage_select
CREATE POLICY clinic_documents_storage_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'clinic-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT private.current_clinic_id() AS current_clinic_id))::text)));

-- policy/storage.objects.clinic_documents_storage_update
CREATE POLICY clinic_documents_storage_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'clinic-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT private.current_clinic_id() AS current_clinic_id))::text))) WITH CHECK (((bucket_id = 'clinic-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT private.current_clinic_id() AS current_clinic_id))::text)));

-- function/check_agenda_slot(uuid,timestamp with time zone,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.check_agenda_slot(p_clinic_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$


-- function/claim_patient_messages(uuid,uuid,integer)
CREATE OR REPLACE FUNCTION public.claim_patient_messages(p_clinic_id uuid, p_appointment_id uuid, p_limit integer DEFAULT 10)
 RETURNS SETOF appointment_messages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$


-- function/guard_clinic_document_signer()
CREATE OR REPLACE FUNCTION public.guard_clinic_document_signer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$


-- function/refresh_patient_last_visit()
CREATE OR REPLACE FUNCTION public.refresh_patient_last_visit()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$ declare v_clinic uuid; v_count integer; begin v_clinic := private.current_clinic_id(); if v_clinic is null then raise exception 'clinic_not_found'; end if; update public.patients p set last_visit_at = x.last_visit_at, updated_at=now() from (select patient_id,max(starts_at) filter (where starts_at <= now() and status not in ('cancelled','no_show')) last_visit_at from public.appointments where clinic_id=v_clinic group by patient_id) x where p.id=x.patient_id and p.clinic_id=v_clinic and x.last_visit_at is not null; get diagnostics v_count=row_count; return jsonb_build_object('updated',v_count); end; $function$


-- function/rls_auto_enable()
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$


-- function/save_agenda_window(text,timestamp with time zone,timestamp with time zone,text)
CREATE OR REPLACE FUNCTION public.save_agenda_window(p_kind text, p_start timestamp with time zone, p_end timestamp with time zone, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare settings public.agenda_settings; count_existing integer; result_id uuid;
begin
 select * into settings from public.agenda_settings where owner_id=auth.uid();
 if auth.uid() is null or not found then raise exception 'Somente a responsável pode alterar a disponibilidade.'; end if;
 if p_kind not in ('available','blocked') or p_end<=p_start then raise exception 'Confira o tipo e o período.';end if;
 perform pg_advisory_xact_lock(hashtextextended(settings.clinic_id::text,0));
 insert into public.agenda_windows(clinic_id,kind,starts_at,ends_at,reason,created_by) values(settings.clinic_id,p_kind,p_start,p_end,p_reason,auth.uid()) returning id into result_id;
 select count(*) into count_existing from public.appointments where clinic_id=settings.clinic_id and status::text<>'cancelled' and starts_at<p_end and ends_at>p_start;
 return jsonb_build_object('id',result_id,'existing_appointments',case when p_kind='blocked' then count_existing else 0 end);
end $function$


-- trigger/agenda_appointment_delete_guard
CREATE TRIGGER agenda_appointment_delete_guard BEFORE DELETE ON appointments FOR EACH ROW EXECUTE FUNCTION agenda_private.guard_appointment_delete();

-- trigger/agenda_appointment_guard
CREATE TRIGGER agenda_appointment_guard BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION agenda_private.guard_appointment();

-- trigger/agenda_enqueue_notification
CREATE TRIGGER agenda_enqueue_notification AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION agenda_private.enqueue_notification();

-- trigger/agenda_queue_patient_message
CREATE TRIGGER agenda_queue_patient_message AFTER INSERT OR UPDATE OF starts_at, ends_at, approval_status, status, source_payload ON appointments FOR EACH ROW EXECUTE FUNCTION agenda_private.queue_patient_message();

-- trigger/appointments_touch_updated_at
CREATE TRIGGER appointments_touch_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/clinical_records_touch_updated_at
CREATE TRIGGER clinical_records_touch_updated_at BEFORE UPDATE ON clinical_records FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/fiscal_documents_touch_updated_at
CREATE TRIGGER fiscal_documents_touch_updated_at BEFORE UPDATE ON fiscal_documents FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/guard_clinic_document_signer
CREATE TRIGGER guard_clinic_document_signer BEFORE UPDATE ON document_signers FOR EACH ROW EXECUTE FUNCTION guard_clinic_document_signer();

-- trigger/reminders_touch_updated_at
CREATE TRIGGER reminders_touch_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/treatment_plan_items_touch_updated_at
CREATE TRIGGER treatment_plan_items_touch_updated_at BEFORE UPDATE ON treatment_plan_items FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/treatment_plans_touch_updated_at
CREATE TRIGGER treatment_plans_touch_updated_at BEFORE UPDATE ON treatment_plans FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- trigger/trg_sync_document_status
CREATE TRIGGER trg_sync_document_status AFTER INSERT OR UPDATE OF status ON document_signers FOR EACH ROW EXECUTE FUNCTION private.sync_document_status();
