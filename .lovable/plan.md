# Endurecer RLS por papel (admin / diretor / consultor)

## Contexto

Hoje quase tudo usa `is_authorized_user(uid)` — que retorna `true` para qualquer usuário com role. Ou seja: consultor tem, no banco, o mesmo poder que admin em `clientes`, `contratos`, `atendimentos`, `ferramentas_cliente`, `encerramentos`, `pausas_contrato`, `onboarding`, `consultores`, `crms`, `cliente_aliases`. A restrição hoje é só de frontend.

Vou reescrever as políticas para refletir o modelo real da consultoria.

## Regras aprovadas

- **Admin**: tudo.
- **Diretor**: leitura e edição globais; pode excluir cadastros; gerencia configs.
- **Consultor**: apenas a própria carteira, **ler e editar**, sem criar cliente/contrato e sem excluir nada crítico.

## Helpers no banco

Uma nova função `security definer` para expressar "admin ou diretor":

```sql
create or replace function public.is_admin_or_director(_uid uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select public.has_role(_uid,'admin') or public.has_role(_uid,'director') $$;
```

`is_authorized_user` continua existindo (é usada em muitas policies de leitura onde o consultor precisa ler), mas onde ela hoje libera escrita/exclusão indevida, será substituída.

## Matriz de acesso por tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| clientes | admin+diretor: todos; consultor: própria carteira | admin+diretor | admin+diretor OR consultor da carteira | admin+diretor |
| contratos | idem clientes (via cliente) | admin+diretor | admin+diretor OR consultor da carteira | admin+diretor |
| atendimentos, onboarding, ferramentas_cliente, encerramentos, pausas_contrato, viagens_contrato | idem (via cliente/contrato) | admin+diretor OR consultor da carteira | idem | admin+diretor |
| consultores | autenticados leem | admin+diretor | admin+diretor OR próprio consultor (campos limitados via trigger) | admin+diretor |
| cliente_aliases | via cliente | via cliente | via cliente | admin+diretor |
| crms | autenticados leem | admin+diretor | admin+diretor | admin+diretor |
| checklist_templates, tipos_consultoria, questionarios_template, projetos_etapas, projeto_tags | autenticados leem | admin+diretor | admin+diretor | admin+diretor |
| agente_prompts, oraculo_knowledge, oraculo_settings | admin+diretor leem/escrevem (oraculo_knowledge leitura permanece p/ autenticados pois é consumido pelo chat) | admin+diretor | admin+diretor | admin+diretor |
| notion_documents | admin+diretor | edge function (service_role) | edge function | admin+diretor |
| ai_usage_logs, insights_agregados, auditoria_status_cliente, webhook_logs, parse_erros_log, reunioes_importadas_log, oportunidades_produto | admin+diretor leem; escrita via edge function/service_role; usuário lê os próprios quando aplicável (já é o caso hoje) | — | — | admin |
| consultor_user, user_roles | mantém regras atuais (admin gerencia; user vê própria) | admin | admin | admin |
| consultor_google_tokens, perfis_comportamentais, cruzamentos_disc | mantém (já corretas: próprio consultor + admin/diretor) | — | — | — |
| notificacoes, todo_pessoal, oraculo_conversas/mensagens, agentes_ia_rascunhos, interacoes_tempo | mantém (escopo por `user_id`) | — | — | — |
| reunioes, reunioes_gestao, transcricoes_sumarios | revisar para: admin+diretor tudo; consultor só onde é o consultor da reunião | — | — | admin+diretor |
| projetos, projeto_checklist, projeto_checklist_responsaveis, projeto_comentarios, projeto_documentos, projeto_tag_vinculo, compromissos, interacoes_cliente, cliente_arquivos, questionarios | políticas atuais já são por carteira; só remover `is_authorized_user` de DELETE onde consultor não deve apagar (documentos/checklist mantém autor pode apagar o próprio; cliente_arquivos mantém regra atual) | — | — | admin+diretor para exclusões amplas |

## Frontend

Nenhuma mudança funcional pedida. As guardas de rota atuais continuam. Ajustes eventuais só se um botão passar a receber 403 — nesse caso escondemos via `useUserRoles` (`isAdmin || isDirector`). Vou revisar rapidamente páginas que hoje mostram botão "excluir" para consultor e esconder quando não for admin/diretor: `Clientes`, `Contratos`, `ContratoTab`, `ClienteDialogs`, `FerramentasTab`, `AtendimentoDialogs`, `OnboardingTab`, `PausaContratoDialog`, `EncerramentosDialog`.

## Edge functions

As functions que rodam com `service_role` (webhooks, crons, imports) já contornam RLS — sem mudança. As que rodam com JWT do usuário (`create-user`, `list-auth-users`, `importar-documento-agente`, `oraculo-*`) já verificam admin/diretor no início; vou reconferir e adicionar a checagem onde estiver faltando.

## Entregas

1. **Migração 1 — helpers e reescrita RLS** (arquivo único):
   - Cria `is_admin_or_director`.
   - Para cada tabela da matriz: `DROP POLICY` das políticas atuais problemáticas + `CREATE POLICY` novas. Nada de dados alterado.
2. **Ajustes de frontend**: esconder ações destrutivas para consultor (usa `useUserRoles`).
3. **Revisão das edge functions sensíveis**: garantir checagem de role no topo.
4. **Rodar `supabase--linter`** ao final e endereçar avisos.

## Riscos / validação

- Risco: quebrar telas onde o consultor legitimamente edita cliente da carteira — mitigado mantendo UPDATE por carteira.
- Risco: consultor perder acesso a listagens agregadas — os SELECTs continuam permissivos para autenticados nas tabelas onde a UI já filtra (ex.: `consultores`, templates).
- Validação: após aplicar, logar como consultor no preview e conferir que fluxos essenciais (registrar interação, editar cliente da carteira, marcar checklist) continuam funcionando, e que "excluir cliente/contrato" retorna erro.
