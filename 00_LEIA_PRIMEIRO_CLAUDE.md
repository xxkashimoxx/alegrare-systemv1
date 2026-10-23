# Alegrare — pacote completo de auditoria técnica (23/10/2026)

Este ZIP contém a **cópia integral do código-fonte versionado** em GitHub, no estado da branch `main` em 23/10/2026, mais um conjunto adicional de **documentos de contexto e snapshots técnicos** para revisão por Claude. O snapshot foi preparado na branch `claude-auditoria-2026-10-23` para NÃO alterar a produção.

## Leia nesta ordem
1. `00_LEIA_PRIMEIRO_CLAUDE.md`
2. `CLAUDE.md`
3. `documentacao-auditoria/CONTEXTO_COMPLETO.md`
4. `documentacao-auditoria/INFRAESTRUTURA_E_ESTADO.md`
5. `documentacao-auditoria/SUPABASE_SCHEMA_SNAPSHOT.sql` (snapshot do esquema real, **não** executar)
6. `documentacao-auditoria/ACHADOS_INICIAIS.md`
7. `README.md`, `app.js`, demais arquivos JS/CSS/HTML, SQL em `database/`, funções em `supabase/functions/` e testes em `tests/`.

## Escopo
Auditar interface, fluxos de cadastro, agenda, pacientes, anamnese, prontuário, odontograma, prescrições, documentos e assinaturas, financeiro, estoque/validade, envios, permissões, RLS, LGPD, disponibilidade, integridade de dados, concorrência, performance, cobertura de testes e deploy. Propor melhorias objetivas, com critérios de aceite e ordem de implantação.

## Origem do código
- Repositório: https://github.com/xxkashimoxx/alegrare-systemv1
- `main` de referência (SHA do commit): `302f750cc91b8dc00fe2b6156cb292f6df6b4818`.
- Publicação dessa revisão: https://painel-alegrare.vercel.app/ — Vercel READY.
- Banco: Supabase `efythbvsdbxrsibvkhmc` (somente esquema, funções e indicadores agregados, não registros clínicos).

## O que NÃO foi incluído
- Dados pessoais dos pacientes, documentos médicos individuais, assinaturas privadas, arquivos de storage, credenciais, secrets de serviços, sessão de usuários, backup de dados reais ou configurações secretas. Isso seria impróprio em um repositório/ZIP de auditoria e desnecessário para revisão de código.
- Histórico completo de commits como objetos Git e dependências externas baixadas. O arquivo ZIP do GitHub contém o código da revisão, não a pasta `.git`.
- Validação prática autenticada da interface com os usuários reais. A revisão deve marcar esses pontos como não verificados.

## Regra importante
NÃO aplicar automaticamente patches, migrações, resets, edições de RLS, exclusões ou deploys durante a análise. O objetivo inicial é diagnosticar e propor melhorias. Nunca criar dados falsos em produção nem tratar implementação de código como equivalente a fluxo operacional testado.

## Entregável esperado de Claude
Produzir achados em tabela com severidade, evidência `arquivo:linha`, impacto, solução proposta, risco de regressão e esforço. Separar **bugs comprovados**, **hipóteses que exigem teste** e **melhorias opcionais**. Priorizar os fluxos essenciais para Daniela/Danielle na recepção e os pontos capazes de impedir entrega final.
