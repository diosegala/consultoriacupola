# Painel do Diretor + Agente de Gestão

Escopo grande. Vou dividir em 6 partes que espelham o pedido, com um checkpoint entre elas para você validar direção antes de eu seguir.

## Parte 1 — Rota e navegação
- `/meu-painel` liberada para todos os roles (remover de `RESTRICTED_FOR_CONSULTOR` se estiver; garantir em `AppLayout`).
- Sidebar admin/director: "Meu Painel" (LayoutDashboard) como primeiro item, acima de Dashboard.
- Redirect pós-login para admin/director → `/meu-painel` (ajustar `AuthContext`/`Auth.tsx`).

## Parte 2 — Seção "Meus Clientes" (quando admin tem consultorId)
- Reaproveitar componentes do `MeuPainel` atual (próximas reuniões, alertas portfólio, tarefas do dia, métricas do mês), passando `consultorId` do próprio diretor.
- Extrair as seções em subcomponentes reutilizáveis se ainda não estiverem.

## Parte 3 — Seção "Gestão da Equipe" (admin/director only)
Quatro blocos:
- **A. Radar da equipe**: card por consultora com clientes ativos, reuniões 14d, score médio (últimas 5), tendência vs período anterior, próxima reunião, badges de alerta. Clique → `/consultores/:id/relatorio`.
- **B. Alertas críticos**: notificações tipo `sentimento_negativo_cliente` (Parte 5). Cada item com resumo, link para análise da reunião, botão "Agendar conversa com [consultora]" que abre `EventoFormDialog` pré-preenchido.
- **C. Minhas reuniões de gestão**: lista de `reunioes_gestao` do diretor com resumo, 5 scores como barras, sugestão de melhoria destacada, compromissos. Estado vazio orientando sobre importação do Drive.
- **D. Lembretes de gestão**: notificações tipo `lembrete_gestao` geradas pelo cron (Parte 6).

## Parte 4 — Agente de reuniões de gestão
- Migração:
  - Tabela `reunioes_gestao` (id, diretor_id, tipo enum individual/equipe, participantes text[], data_reuniao, transcricao, resumo_ia, analise_ia jsonb, status_analise, created_at). RLS: diretor/admin vê o próprio; grants padrão.
- Extensão de `google-drive-sync-diario`:
  - Após tentar match com cliente, se falhar, tentar match com nome de consultora (tabela `consultores`). Se contiver nome de consultora e nenhum cliente → inserir em `reunioes_gestao` (tipo=individual se 1 consultora, equipe se ≥2). Se contiver ambos → fluxo normal (reunião de cliente).
  - Log em `reunioes_importadas_log` com tipo distinto.
- Edge function `analisar-reuniao-gestao`: prompt específico com as 5 dimensões pedidas, retorna JSON. Grava `resumo_ia`, `analise_ia`, extrai compromissos para tabela `compromissos` (responsavel = nome do participante).
- Trigger: reutilizar padrão de `analisar-reuniao` — após insert em `reunioes_gestao` com status pendente, chamar a função (via UI ou cron).

## Parte 5 — Detecção de sentimento em reuniões de cliente
- Modificar prompt de `analisar-reuniao` para incluir `alertas_sentimento` no JSON.
- Após salvar análise, se array não vazio: `INSERT` em `notificacoes` com tipo `sentimento_negativo_cliente`, destinatário = diretor(es) (todos os users com role `admin` ou `director` que tenham consultor vinculado; fallback: todos admins). Metadata com cliente_nome, consultora_nome, reuniao_id, alertas.

## Parte 6 — Cron de lembretes de gestão
Estender `gerar-alertas-proativos` (não criar função nova para simplificar deploy):
- 1:1 sem contato: para cada consultora, se `MAX(data_reuniao)` de `reunioes_gestao` tipo individual > 14 dias → notificação `lembrete_gestao` para o diretor.
- Equipe sem reunião: última `equipe` > 21 dias → lembrete.
- Briefing 1:1 (próximos 2 dias): buscar eventos no Google Calendar do diretor (via `gcal-list-events` interno) contendo nome da consultora → gerar briefing com portfólio, score, alertas, compromissos pendentes dela + pauta sugerida por IA. Salvar como notificação `briefing_1x1` com metadata rica; Bloco C mostra com destaque "Prepare-se para amanhã".
- Pauta de equipe: se reunião de equipe próxima, gerar pauta com temas transversais + alertas pendentes.

## Detalhes técnicos
- **Detecção de "diretor"**: qualquer user com role `admin`. Se houver múltiplos, cada um recebe notificações individualmente.
- **Nomes de consultora para match no Drive**: normalizar (lower, sem acentos), whole-word match como já feito para clientes.
- **Score de tendência**: comparar média das 5 últimas reuniões vs 5 anteriores; ↑ se +0.5, ↓ se -0.5, senão estável.
- **RLS `reunioes_gestao`**: SELECT/INSERT/UPDATE onde `diretor_id = get_consultor_id_for_user(auth.uid())` OU `has_role(auth.uid(), 'admin')`.
- **Grants**: `GRANT SELECT,INSERT,UPDATE,DELETE ON public.reunioes_gestao TO authenticated; GRANT ALL TO service_role`.
- Novos tipos de notificação (`sentimento_negativo_cliente`, `lembrete_gestao`, `briefing_1x1`) tratados no `NotificationBell` e no Bloco D/C.

## Arquivos afetados (estimativa)
Novos:
- `supabase/migrations/…_reunioes_gestao.sql`
- `supabase/functions/analisar-reuniao-gestao/index.ts`
- `src/hooks/useReunioesGestao.ts`
- `src/hooks/useEquipeRadar.ts`
- `src/components/painel/RadarEquipe.tsx`
- `src/components/painel/AlertasCriticos.tsx`
- `src/components/painel/ReunioesGestao.tsx`
- `src/components/painel/LembretesGestao.tsx`

Editados:
- `src/pages/MeuPainel.tsx` (reestrutura em seções condicionais)
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/Auth.tsx` / `src/contexts/AuthContext.tsx` (redirect)
- `supabase/functions/google-drive-sync-diario/index.ts`
- `supabase/functions/analisar-reuniao/index.ts`
- `supabase/functions/gerar-alertas-proativos/index.ts`
- `src/integrations/supabase/types.ts`

## Checkpoint
Depois de entregar Partes 1–3 (painel funcional com dados que já existem + tabela `reunioes_gestao` vazia), pauso para você validar antes de eu seguir com o agente de análise de gestão, detecção de sentimento e cron. Ok?
