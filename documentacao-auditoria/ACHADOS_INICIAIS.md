# Alertas técnicos para Claude verificar

São **resultados de inspeção inicial**, não prova de que todo fluxo esteja comprometido. Data: 2026-10-23.

## Segurança do Supabase
1. **RLS habilitada sem policy (INFO):** `public.appointment_messages` e `public.patient_message_settings`. Pode ser intencional quando a tabela só é manipulada pelo backend com serviço privilegiado; confirmar desenho e necessidade de leitura controlada pela UI. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
2. **Função SECURITY DEFINER acessível a autenticados (WARN):** `public.save_agenda_window(p_kind text, p_start timestamptz, p_end timestamptz, p_reason text)`. Revisar autorização interna por clínica e perfil e se exposição via RPC é desejada: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
3. **Proteção de senhas vazadas desativada (WARN):** avaliar ativação no Supabase Auth. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
4. **Assinatura externa por função sem JWT:** `patient-document-sign`, `verify_jwt=false`. Um endpoint público de assinatura pode ser necessário, mas exigir token robusto, validação, escopo, expiração/revogação, replay protection, idempotência e prevenção de acesso a documento alheio.
5. **Isolamento por clínica / IDOR:** revisar RLS (inclusive views com invoker), endpoints, consultas `clinic_id`, vínculo entre documento/paciente/profissional e escapes via funções privilegiadas.

## Desempenho
- Advisor indica **7 chaves estrangeiras sem índice de suporte** (`accounts_payable.created_by`, `agenda_notifications.appointment_id`, `agenda_notifications.clinic_id`, `agenda_notifications.recipient_id`, `agenda_settings.owner_id`, `agenda_windows.created_by`, `stock_items.created_by`). Considerar medição de consulta e índices precisos: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- Advisor aponta **58 índices sem uso registrado**. Isso **não significa** que sejam inúteis: estatísticas podem ser recentes, baixa carga ou recursos ainda sem tráfego. Não remover automaticamente: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- Frontend `app.js` (cerca de 63 KB), `document-signing.js` (cerca de 46 KB) e vários módulos com responsabilidade potencialmente concentrada. Investigar funções grandes, busca global com paginação e concorrência.

## Integridade funcional
- `stock_items` e `documents` estavam vazios no momento da contagem. Validar fluxo de inclusão e persistência com teste autorizado, sem interpretar vazio como falha isoladamente.
- `appointments` possui milhares de consultas reais importadas; foram historicamente documentados conflitos prévios. Validar regra anti-sobreposição apenas para novas operações e gestão de dados legados.
- `patient_message_settings.enabled` descrito como inicialmente desligado; conferir estado atual em ambiente autenticado **sem alterar**.
- Envio manual via WhatsApp deve abrir conversa com destinatário correto; nenhum clique deve ser rotulado "enviado" se apenas abriu o aplicativo.
- Evitar duplicação financeira e de estoque, inclusive na importação massiva de NF-e.
- Revisar compatibilidade mobile/responsividade do calendário e controles no painel.

## Priorização sugerida
**P0:** perda/vazamento de dados clínicos, assinatura indevida, autorização interclínicas, alteração/remoção errada, agendamento conflitante em concorrência.
**P1:** estoque/validade com alertas persistidos, fluxos de documento/WhatsApp, permissões financeiras, tratamento de erros.
**P2:** clareza UX, pesquisa e performance, automações futuras condicionadas a provedores reais, testes de regressão.

Diferenciar achado comprovado de risco potencial, indicando arquivo/linha, SQL/policy relevante e teste reproduzível.
