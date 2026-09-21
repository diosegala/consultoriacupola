---
name: Integrações configuradas pelos admins na plataforma
description: Firecrawl, RunRun.it e Google Drive da agência são conectados por admins na tela de Configurações/Integrações, nunca por conector do Lovable
type: constraint
---
Decisão do usuário (21/09/2026): as integrações da unidade de agência (Firecrawl, RunRun.it, Google Drive) são feitas pelo time da agência, então **não** devem ser conectadas por conector do Lovable nem por segredo definido pelo agente.

Como funciona:
- Admins preenchem as credenciais em Configurações → aba "Integrações" (também no fim de /integracoes).
- Guardadas em `public.integracoes_credenciais` (chave, credenciais jsonb, ativo, observacao); RLS só permite `service_role`. A tela nunca recebe o valor de volta — só o final da chave.
- Edge function `integracoes-admin` (admin-only) com ações listar, salvar, testar, alternar e remover; cada salvar dispara um teste real contra o provedor.
- Helper `supabase/functions/_shared/integracoes.ts`: `lerCredenciais(admin, chave)`, `faltaIntegracao(chave)` e `tokenGoogleContaServico(json, escopos)`.
- Qualquer função nova que use essas integrações deve ler por `lerCredenciais` e, se vier null, responder com `faltaIntegracao`.
