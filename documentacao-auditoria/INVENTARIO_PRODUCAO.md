# Inventário do ambiente ativo — 2026-10-23

Documento técnico para comparação entre código e infraestrutura, somente leitura.

## Frontend e deploy
- A Vercel confirmou a versão produção de `painel-alegrare` como **READY**.
- O commit GitHub publicado no deploy é `302f750cc91b8dc00fe2b6156cb292f6df6b4818` (`main`).
- Esta ramificação de auditoria adiciona documentação e snapshot SQL, mas preserva o código publicado.

## Banco de dados
- Supabase ref: `efythbvsdbxrsibvkhmc`, Postgres 17, região `ca-central-1`.
- Esquema SQL completo capturado no arquivo `SUPABASE_SCHEMA_SNAPSHOT.sql` a partir dos catálogos do banco (412 definições: 36 tabelas, 186 constraints, 87 índices adicionais, 36 tabelas com RLS habilitada, 49 policies incluindo Storage, 6 funções e 12 triggers). Esse arquivo NÃO é um dump diretamente restaurável.
- Bucket `clinic-documents`: **privado**, limite de 20 MiB por arquivo, MIME: PDF, PNG, JPEG e DOCX. Conteúdo clínico **não exportado**.
- Dados agregados (sem registros pessoais): 1.286 pacientes, 3.849 consultas, 6 clínicas e 2 perfis; estoque e documentos na tabela `documents` sem linhas em 23/10/2026.
- Migrações aplicadas reconhecidas no histórico Supabase: **27** registros:

```text
20260831204504 sprint1_intelligence
20260831204527 secure_rls_auto_enable_function
20260831204551 sprint1_fk_indexes
20260901125241 simplify_prescriptions_and_patient_signatures
20260901131507 real_document_upload_and_patient_signing
20260901131859 move_pg_trgm_to_extensions
20260902164550 core_clinical_operations
20260902164617 database_advisor_fixes
20260903203713 clinicorp_full_import_schema
20260903204021 temporary_clinicorp_import_receiver
20260903205433 clinicorp_private_cipher_staging
20260903212506 temporary_clinicorp_core_import_rpc
20260903212722 temporary_clinicorp_core_chunks
20260903213219 refresh_patient_last_visit_rpc_and_cleanup_temp_import
20260903213349 harden_clinicorp_import_cleanup
20260903213411 clinicorp_import_performance_indexes
20260904105800 prevent_duplicate_clinics_on_user_creation
20260904105859 restrict_profile_and_import_administration
20261006003856 clinical_odontogram_tooth_unique
20261006013018 activate_alegrare_agenda_availability_v2
20261006014415 guard_alegrare_document_signatures
20261006030513 enable_safe_appointment_deletion
20261006031605 add_patient_social_name_alegrare
20261006043652 operations_stock_payables_alegrare
20261006151636 queue_alegrare_patient_appointment_messages
20261010161206 expand_stock_item_categories
20261018122438 add_stock_invoice_import
```

## Edge Functions instaladas em produção e paridade com GitHub
- `patient-document-sign`: ACTIVE, versão 4, `verify_jwt=false`. **Conteúdo do `index.ts` conferido byte a byte como idêntico ao código versionado em `main`**.
- `dispatch-appointment-message`: ACTIVE, versão 4, `verify_jwt=true`. **Conteúdo do `index.ts` conferido byte a byte como idêntico ao código versionado em `main`**.
- O fato de a função de mensagens estar publicada não significa que Meta/Resend ou envios automáticos estejam prontos.

## Limites explícitos do backup para auditoria
Este pacote é completo quanto ao código versionado e fornece retrato técnico do banco ativo, mas NÃO substitui um backup operacional do Supabase: não contém objetos privados de Storage, linhas de tabelas, usuários Auth, credenciais, variáveis de ambiente, ACLs e metadados fora do escopo indicado, nem um dump de recuperação ponto-a-ponto. Nada disso é necessário para a auditoria estática solicitada ao Claude. Para restauração integral do sistema, obter um dump criptografado em processo privado apropriado.
