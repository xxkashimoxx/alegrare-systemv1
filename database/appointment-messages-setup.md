# Confirmações de consulta: ativação dos provedores

A migração `appointment-messages.sql` cria uma fila por consulta e por canal. O formulário exige que a equipe confirme a autorização do paciente. Consultas importadas ou anteriores à migração não entram na fila. A função `dispatch-appointment-message` é chamada após a gravação e após a aprovação/remarcação; o botão **Ver situação dos envios** mostra o resultado.

O cadastro de remetente do Alegrare é `+5521994133062` e `daniellecoelho@alegrare.com`. A opção `patient_message_settings.enabled` começa em `false` até a validação dos dois canais.

1. Verifique o domínio `alegrare.com` no Resend, autorize `daniellecoelho@alegrare.com` como remetente e configure o segredo `RESEND_API_KEY` na Edge Function.
2. Conecte o número `+5521994133062` à API oficial do WhatsApp Business. Configure na Edge Function `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_SENDER_E164=+5521994133062`, `WHATSAPP_GRAPH_VERSION` e `WHATSAPP_TEMPLATE_NAME`. O modelo aprovado em `pt_BR` deve ter **quatro variáveis de texto no corpo**, nesta ordem: nome, data, hora e situação da consulta.
3. Faça testes com uma consulta de teste e contatos de teste autorizados. Confira os dois canais no botão de situação, o registro no provedor e a capacidade de resposta pelo e-mail da clínica.
4. Só então habilite `patient_message_settings.enabled=true` para a clínica Alegrare. Se um canal deixar de funcionar, desabilite a configuração até corrigir as credenciais.

As chaves ficam exclusivamente nos segredos do Supabase. O navegador nunca recebe tokens dos provedores. O e-mail usa uma chave de idempotência por aviso; o WhatsApp não oferece a mesma garantia em caso de resposta ambígua da rede, por isso confira registros do provedor antes de reenviar uma falha incerta. As linhas com falha ficam na fila para uma nova tentativa iniciada pelo painel; não há envio retroativo em lote configurado.
