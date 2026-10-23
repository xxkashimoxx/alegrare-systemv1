# Pedido formal para Claude

Leia **TODO o código e todos os documentos do pacote**. Depois:

1. Monte mapa real da arquitetura (entrada, módulos, armazenamento, funções, migrações, autenticação, proteção e deploy).
2. Faça auditoria de cada módulo: agenda, pacientes, anamnese, odontograma/prontuário, prescrições, documentos/assinaturas, WhatsApp/e-mail, estoque, importações, financeiro e dashboard.
3. Identifique falhas concretas com evidência `arquivo:linha`, explique vulnerabilidades (OWASP Top 10, RLS, autenticação/autorização, LGPD), risco de duplicidade, dados inconsistentes e concorrência.
4. Revise cada botão, pesquisa, edição, cancelamento, gravação, impressão e exportação. Aponte fluxos que só simulam ação ou que não tratam respostas de erro.
5. Execute os testes locais possíveis com acesso aos arquivos; proponha os testes faltantes e indique o que não pode validar por falta de credenciais/sessão.
6. Proponha melhorias muito úteis à recepção, com menos cliques e operação prática, sem sobrecarregar a tela principal.
7. Entregue roteiro de melhorias incremental, com prioridade P0/P1/P2, risco, esforço, plano de rollback, evidência e critérios de aceite.
8. **Não implemente nem publique nada sem separar inicialmente diagnóstico de execução.** Não mudar o banco de produção nem usar dados pessoais em testes.

Formato da resposta:
| Prioridade | Arquivo:linha | Problema | Evidência | Impacto | Correção proposta | Teste de aceite |
|---|---|---|---|---|---|---|

Finalize com as **cinco melhorias de maior retorno** e uma lista de inconsistências e dúvidas que impossibilitam confirmação, sem inventar dados.
