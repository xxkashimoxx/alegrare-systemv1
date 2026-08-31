# Painel Alegrare

Painel administrativo e clínico da Alegrare Odontologia Especial.

## Sprint 1 de diferenciação

- Central de Oportunidades
- Dashboard inteligente
- Timeline completa do paciente
- Prescrições e fluxo de assinatura
- Recuperação de pacientes

## Identidade visual

Baseada no Manual de Identidade da Alegrare: azul institucional `#2680B3`, azul luminoso `#089FD9`, laranja `#DC853D`, amarelo `#EAB43F` e grafite `#263038`.

## Execução local

O projeto é uma SPA estática, sem etapa de build obrigatória.

```bash
python -m http.server 4173
```

Abra `http://localhost:4173`.

## Dados

A versão de demonstração usa dados locais persistidos no navegador para permitir apresentação imediata. O esquema preparado para Supabase está em `supabase/migrations` e será usado na conexão de produção com Auth/RLS.
