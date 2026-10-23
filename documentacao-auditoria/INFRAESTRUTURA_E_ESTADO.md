# Infraestrutura verificada — Alegrare

## Código e deploy
- Repositório GitHub: `xxkashimoxx/alegrare-systemv1`, branch `main`.
- Commit que alimentou a última publicação de produção: `302f750cc91b8dc00fe2b6156cb292f6df6b4818`.
- Projeto Vercel principal: `painel-alegrare`; projeto ID `prj_2hAsTIAB8P8YuRI0rWdfbLkTGIJ1`.
- URL: https://painel-alegrare.vercel.app/
- Deploy visto: `dpl_JCR3pFW7KCY9BdoxeJhKH7wZC8TZ`; target `production`; estado `READY`; origem GitHub main; sem bloqueio de senha/SSO.
- Projeto Vercel adicional: `alegrare-systemv1`, ID `prj_nif4c2Zw7Bje3opIgIc8TltSsuih`. Encontrado como projeto separado e com proteção SSO para algumas URLs: não confundir com o painel principal.
- Vercel registra `framework: vite` e `Node 24.x`; o repositório apresenta SPA estática em módulos JavaScript e `vercel.json` com `framework: null`, sem comando de build. Revisar discrepância somente se impactar deploy.
- `index.html` carrega FullCalendar via CDN; `supabase-client.js` cria cliente Supabase via esm.sh.
- `supabase-client.js` contém chave **publishable/pública** do Supabase (não equivalente a `service_role`); não criar nem incluir `service_role` no frontend.

## Banco de dados real
- Serviço Supabase: conta conectada `asta`, projeto `danniele - sistema`.
- Ref `efythbvsdbxrsibvkhmc`, região `ca-central-1`, PostgreSQL 17.
- Snapshot de contagens (consulta agregada, **sem extração de linhas clínicas**, 23/10/2026):
  - `patients`: **1.286**.
  - `appointments`: **3.849**.
  - `clinics`: **6**.
  - `profiles`: **2**.
  - `stock_items`: **0**.
  - `documents`: **0**.
- Essas contagens não provam que determinado fluxo esteja correto; confrontar dados realistas, políticas e UI em sessão autenticada.
- Migrações registradas até `20261018122438_add_stock_invoice_import` (18/10/2026). Ver diretório `database/` e snapshot de esquema.

## Funções Supabase encontradas
- `patient-document-sign`: ativa, versão 4, `verify_jwt=false`; é um endpoint que aceita acesso externo, exigindo análise cuidadosa de tokens, escopo, expiração, limite de tentativas e autorização de assinaturas.
- `dispatch-appointment-message`: ativa, versão 4, `verify_jwt=true`. Publicação técnica da função **não comprova** provedores configurados nem mensagem automática ativa.
- Códigos versionados em `supabase/functions/`, mas comparar implementação de produção e repo quando possível.

## Dados e secrets fora do pacote
Sem `.env`, chaves privadas, tokens Meta/Resend, credenciais, backup clínico, armazenamento de arquivos privados, sessões, usuários ou dados identificáveis. O campo de nomes de variáveis, quando citado em documentação, não equivale ao valor da credencial.

## Observação histórica
O README registra entrega conectada ao Supabase e integração operacional parcial. Notas de 06/10 registravam 3.680 consultas; em 23/10 foi observada contagem total de 3.849. Não presumir nenhuma importação adicional específica sem investigar.
