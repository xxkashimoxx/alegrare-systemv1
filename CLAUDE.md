# Instruções para revisão do Painel Alegrare

Você está revisando o sistema **Alegrare — Odontologia Especial** como revisor técnico independente. Leia o contexto antes de propor mudanças.

- Parta do código versionado presente no ZIP, sem substituir fluxos funcionais ou produzir mockups sem backend.
- Valide se cada botão executa uma ação verdadeira, persiste no Supabase, apresenta feedback e lida com erro/duplicidade.
- O sistema é uma SPA **HTML/CSS/JavaScript por módulos ES** usando Supabase JS via CDN e Edge Functions em Deno. Não presuma React/Vite apenas porque o projeto Vercel indica framework Vite.
- Dê atenção prioritária à agenda e horários bloqueados, às assinaturas/documentos compartilhados por link, ao isolamento de dados por clínica, à autorização de funções privilegiadas e ao controle de estoque.
- Não faça export de dados clínicos, nem registre tokens, chaves ou dados pessoais em relatórios.
- Valide a premissa de integração: WhatsApp/e-mail têm estruturas de fila e funções, porém a ativação real dos provedores não está confirmada; não afirmar que o disparo automático está operacional.
- Leia `documentacao-auditoria/ACHADOS_INICIAIS.md` como pistas a verificar, não como bugs automaticamente comprovados.
- Não usar SQL do snapshot para recriar o banco: ele é um inventário técnico de objetos e pode não ser reexecutável.
- Entregue propostas em ordem de urgência e mostre patches/diffs apenas quando seguros e claramente justificados.

Pergunta central: **o que falta para que o Alegrare seja confiável, simples, rápido e utilizável no dia a dia pela Danielle e recepção sem perder dados ou criar fluxos falsos?**
