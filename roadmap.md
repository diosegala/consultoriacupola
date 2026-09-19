# Roadmap — Integração CupolaOS (agência) na plataforma de Consultoria

Plano aprovado em .lovable/plan/trazer-o-cupolaos-agência-de-marketing-para-dentro-da-plataf-2026-09-18.md

## Fases
- [x] Fase 1 — Fundação: schema `agencia` (60 tabelas) + RLS (129 políticas) + GRANTs + buckets (conhecimento, retratos) + seed (12 espaços, 3 squads, 21 pessoas, 26 agentes, 7 fontes, 1 produto) + schema exposto via PostgREST
- [~] Fase 2 — Frontend: seção "Agência" no menu (Contas, Agentes, Time) com rotas /agencia/*, acesso liberado a quem tem ficha ativa em agencia.pessoas, GRANTs para authenticated no schema agencia. Falta: criação/edição de contas, projetos, blog/redes, admin e gestão
- [~] Fase 3 — Servidor e IA: [feito] motor de conversa dos agentes da agência (edge function `agencia-conversar`, gateway Lovable, modelo openai/gpt-6-astra), tela /agencia/agentes/:slug, registro de uso etiquetado por unidade/agente/cliente/pessoa e aba "Inteligência Artificial" em Configurações. [falta] demais rotas do worker (blog, redes, ficha, diagramar, áudio, RSS) e integrações (Firecrawl, Drive, RunRun.it). Original: worker → edge functions; aba "Inteligência Artificial" em Configurações (modelo por provedor + painel de uso/custo por unidade, agente, cliente, usuário); integrações (Firecrawl, Drive, RunRun.it, RSS)
- [ ] Fase 4 — Migração de dados e usuários (bloqueada: aguardando dump do banco de produção do CupolaOS + acesso ao Storage — pedir ao Giuliano)
- [ ] Fase 5 — Validação com Giuliano e publicação (corte)

## Decisões registradas
- Tudo da agência vive no schema `agencia` (isolamento total da consultoria).
- Chave de IA única (gateway Lovable já usado pela consultoria); custo medido por unidade/agente/cliente/usuário.
- Usuários da agência usam nosso login; `pessoas` deles vira `agencia.pessoas`.
- Trabalho inteiro em dev; produção só recebe na publicação.
