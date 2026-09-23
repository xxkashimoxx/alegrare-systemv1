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
