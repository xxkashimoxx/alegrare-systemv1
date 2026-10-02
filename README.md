# Painel Alegrare

Painel administrativo da Alegrare Odontologia Especial.

## Versão publicada

A aplicação usa a versão conectada ao Supabase, com:

- autenticação real;
- vínculo do usuário à clínica;
- pacientes e agendamentos reais;
- prescrições;
- documentos privados e assinaturas;
- notas fiscais;
- persistência no Supabase com RLS.

A aplicação não usa dados fictícios nem `localStorage` como banco de dados.

## Execução local

É uma SPA estática, sem etapa de build obrigatória:

```bash
python -m http.server 4173
```

Abra `http://localhost:4173`.

## Infraestrutura

- Vercel: painel-alegrare.vercel.app
- Supabase: projeto efythbvsdbxrsibvkhmc
- GitHub: xxkashimoxx/alegrare-systemv1

## Buscas e financeiro

- Medicamentos: consulta ao catálogo ativo completo por nome, princípio ativo e apresentação, com até 20 sugestões por busca.
- Prescrições: busca em todo o histórico por paciente, telefone, título, orientações e medicamento; filtros de situação; visualização e impressão/PDF.
- Documentos: busca no histórico por paciente, telefone, título e nome do arquivo; abertura via URL temporária do bucket privado.
- Financeiro: usa fiscal_documents e metadata.finance, sem novas tabelas. Os totais abrangem todas as páginas do período selecionado. O período usa emissão, ou cadastro quando a emissão não está informada. Recebimentos são vinculados aos documentos selecionados, não um extrato bancário por data de pagamento.
- Documentos importados sem conciliação não são tratados como receita recebida nem como contas a receber. O acompanhamento deve ser iniciado explicitamente.
- Recebimentos parciais, referência do comprovante, saldo, vencimento, correção com histórico, CSV para Excel e relatório imprimível/PDF. A correção é contábil interna e não efetua uma devolução bancária.
- O envio de WhatsApp/SMS foi adiado a pedido do usuário; nenhum serviço foi contratado ou ativado.

### Verificação

```bash
node tests/agenda-rules.test.mjs
node tests/finance-search.test.mjs
node tests/record-queries.test.mjs
```

Os testes usam dados fictícios e consultas simuladas. A verificação autenticada em produção depende de uma sessão válida no painel. Despesas, integração fiscal municipal e conciliação bancária automática não estão conectadas.
