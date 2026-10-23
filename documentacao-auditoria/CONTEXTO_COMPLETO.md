# Contexto funcional e decisões do Painel Alegrare

**Data de referência:** 23 de outubro de 2026.
**Cliente:** clínica Alegrare Odontologia Especial, operação orientada pela Danielle/Daniela, com foco na recepção e operação clínica.
**Objetivo:** alternativa própria e mais simples que o Clinicorp, com menos cliques, baixa carga cognitiva, ações reais e persistência segura.

## 1. Princípios inegociáveis
- Não sobrescrever telas, fluxos e cadastros existentes sem necessidade; nenhuma versão demonstrativa substitui dados reais.
- Não criar pacientes, lançamentos ou consultas duplicadas.
- `localStorage` não é banco de dados; persistência clínica ocorre no Supabase com RLS.
- Todos os controles visíveis devem possuir comportamento testável: gravar, editar, excluir quando permitido, imprimir, exportar, abrir links etc.
- Interface acessível, simples, com boa legibilidade em celular e desktop.
- Preservar integridade, isolamento por clínica, autorização por papéis e dados sensíveis.
- Quando uma alteração for efetivamente aprovada para implementação, priorizar revisão do backend/frontend e publicação funcional.

## 2. Agenda
- Calendário com seleção e movimentação de consultas; busca rápida de paciente por nome, nome social e telefone.
- Agendar/remarcar/excluir, sinalizar status: confirmação, presença, ausência/falta, não comparecimento, cancelamento, justificativa.
- Bloquear períodos/dias com motivo; definir disponibilidade semanal da profissional; impedir agendamentos conflitantes de forma transacional e confiável.
- Status especiais e ocorrência clínica que impediu procedimento; retorno com data e aviso.
- Dados importados do Clinicorp não podem ser perdidos nem sobrescritos.
- Saída manual `.ics`; sincronização Google Calendar automática ainda é dependência futura.
- Revisar concorrência entre dois atendentes abrindo a mesma agenda.

## 3. Pacientes e busca
- Cadastro e pesquisa global (inclui nome social); acesso rápido ao histórico, dados de contato, documentos e tratamentos.
- Deduplicação e atualização sem gerar cadastros paralelos.
- Filtros/busca consistentes nos diferentes módulos.

## 4. Atendimento, clínica, odontograma e anamnese
- Ficha clínica, prontuário, observações internas, anamnese e odontograma.
- Odontograma para dentes permanentes e decíduos, classificação, faces e identificação.
- Separar informações internas do profissional dos dados exibidos em documento ao paciente.
- Preservar histórico, autoria, data, trilha de alterações e autorização clínica.

## 5. Documentos, termos e assinaturas
- Documento novo ou existente atribuído a paciente real.
- Definir quem assina: profissional, paciente ou ambos; nome exibido ao paciente configurável.
- Botão de compartilhamento manual do documento correto com o WhatsApp do paciente selecionado, sem mandar documento de outro paciente.
- O paciente deve abrir uma página de assinatura, ler documento completo, assinar, enviar à clínica; registro das assinaturas da profissional e do paciente, carimbos de data e estado (pendente/assinado).
- URL de assinatura individual, validação, expiração/revogação e replay devem ser avaliados.
- Bucket e arquivos clínicos privados; link temporário para abertura, sem exposição indevida.

## 6. Prescrições e medicamentos
- Catálogo pesquisável de medicamentos; prescrições com histórico, busca e filtros; impressão/PDF.
- Dados reais, vínculo paciente-clínica, registro e autorização de assinaturas.
- Verificar integridade de mudanças e conteúdo clínico sensível.

## 7. Estoque e insumos
- Cadastro de medicamentos, produtos, materiais, limpeza e demais insumos.
- Quantidade atual, mínimo, zerado, validade, controle de categoria e alertas de vencimento/fim de estoque.
- Importação via NF-e XML, CSV ou DANFE PDF com conferência antes de gravar.
- Nunca duplicar produtos em importação e evitar atualização equivocada de estoque sem histórico.
- A importação e os alertas foram assunto da atualização mais recente; verificar comportamento de ponta a ponta.

## 8. Financeiro e administrativo
- Painéis e buscas com registros reais; vínculo de documento, recebimento e saldo.
- Pagamentos parciais, vencimento, referência e correção com histórico; CSV/Excel e impressão/PDF.
- Evitar confundir documento importado com receita recebida; conciliação bancária/fiscal externa automática não implementada.
- Controle de contas a pagar e permissões de visualização/edição; revisão de RLS.
- O sistema deve manter rastreabilidade e impedir lançamentos repetidos.

## 9. Mensagens e avisos
- WhatsApp manual de confirmação de consulta, no próprio agendamento, com data, hora, paciente e procedimento, para o número cadastrado.
- Mensagens manuais de aniversário.
- Infra para envio automático WhatsApp/e-mail: fila, configurações e Edge Function; porém a contratação/configuração do serviço e a ativação operacional foram postergadas.
- Distinguir claramente interface de envio manual por link de mensagens realmente despachadas por provedor.
- Não habilitar disparos automáticos só porque a Edge Function está publicada.

## 10. Integrações
- Histórico/arquitetura consideram Clinicorp como origem/importação de dados existentes.
- Não pressupor API Clinicorp bidirecional ou conexão pronta para envio automático sem evidência.
- Verificar processos de reconciliação, identificadores externos e deduplicação.

## 11. Estado, certezas e lacunas
- O GitHub contém implementação de módulos e testes; não se deve afirmar que tudo foi validado em produção com conta real.
- É necessário verificar end-to-end com papéis reais de clínica/recepção/profissional (sem copiar dados sensíveis).
- Supabase listado neste pacote é instância real, não mock; contagens agregadas no snapshot da infraestrutura.
- Recursos de envio externo, Google Calendar e integrações fiscais devem permanecer indicados como não ativados enquanto não provados.
