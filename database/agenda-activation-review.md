# Ativação da disponibilidade da agenda — 2026-10-06

A migração `agenda-setup.sql` foi aplicada no projeto Supabase `efythbvsdbxrsibvkhmc` como `activate_alegrare_agenda_availability_v2`. Foram confirmados `agenda_settings`, `agenda_windows`, `agenda_notifications` e os dois gatilhos de agendamento. As 3.680 consultas anteriores permaneceram no banco.

- A clínica recebeu uma linha em `agenda_settings` com a profissional responsável já vinculada, `weekly={}` e `enforce_weekly=false`. Nenhum horário de atendimento foi presumido. A Danielle pode cadastrar a disponibilidade no painel antes de ativar a regra semanal.
- Novas inserções e remarcações via usuário autenticado são validadas no banco contra bloqueios e sobreposições. Os imports autorizados com `service_role` preservam os dados de origem para reconciliação.
- A auditoria anterior identificou 296 grupos de consultas históricas com mesmo início/fim e status não cancelado. Esses registros não foram alterados; a proteção vale para novas alterações de horário.
- Envio automático de mensagens e sincronização do Google Calendar dependem de provedor e credenciais ainda não configurados. O arquivo `.ics` por consulta permanece como opção manual.

## Verificação operacional pendente

Entrar com os perfis reais da responsável e da recepção; registrar janelas semanais; criar, confirmar, remarcar e bloquear um horário; testar conflito simultâneo; conferir RLS. Depois, habilitar `enforce_weekly=true` pela interface da responsável. Não inventar janelas para cumprir o teste.
