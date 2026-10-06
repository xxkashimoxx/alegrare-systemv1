# Ativação da disponibilidade da agenda

O frontend já lê `agenda_settings` e `agenda_windows`, e usa `check_agenda_slot` para validar horários. Essas tabelas e funções ainda não estão no projeto Supabase de produção. A migração existente em `agenda-setup.sql` prepara essa estrutura, permissões e gatilhos de inserção/alteração de consultas. Ela **não foi aplicada** nesta entrega.

## Verificação antes da ativação

- O banco tinha 3.680 consultas na auditoria de 2026-10-06. Existem 296 grupos históricos com mesmo início e término e status diferente de cancelado. A migração proposta preserva esses registros e impediria novas sobreposições, mas não reconcilia o histórico.
- O gatilho `guard_appointment` da migração usa `auth.uid()` em inserções e atualizações. Antes de ativar, avaliar o caminho dos imports via service role para evitar bloquear uma reconciliação do Clinicorp.
- Testar com os dois perfis existentes (responsável e dentista): criar, confirmar, remarcar, bloquear horário e impedir conflitos simultâneos. Revisar mensagens ao usuário e rollback.
- Confirmar janelas semanais da Danielle antes de marcar `enforce_weekly=true`.

Até ativação, o painel exibe aviso para conferência manual da disponibilidade. Não anunciar confirmação automática nem envio de mensagens como funcionalidade ativa.
