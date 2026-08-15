# Corrigir alertas do Meu Painel: reincidência, entidades encerradas e falso sentimento negativo

## Problema 1 — alertas resolvidos voltam no dia seguinte

Hoje a rotina diária (`gerar-alertas-proativos`) checa duplicidade apenas com "existe notificação **não lida** para este cliente/projeto?". Quando você clica em "Marcar como resolvida", a notificação passa a lida e, na execução seguinte, o filtro não encontra nada e cria tudo de novo. O mesmo acontece com o alerta de sentimento negativo criado em `analisar-reuniao`.

Correção:
- Trocar a checagem de "não lida" por uma **janela de silêncio por tipo + entidade**, considerando também notificações já lidas:
  - `sem_contato`, `okr_sem_progresso`, `checklist_parado`: 14 dias
  - `contrato_sem_renovacao`: 21 dias
  - `compromisso_vencido`: 14 dias (por compromisso)
  - `lembrete_gestao` / `briefing_1x1`: 7 dias
  - `sentimento_negativo_cliente`: por reunião (nunca recriar para a mesma reunião)
- Se o alerta continuar válido depois da janela, ele volta — mas espaçado, não no dia seguinte.
- Criar uma função utilitária única para essa checagem, evitando repetir a regra nos 8 blocos.

## Problema 2 — clientes e projetos encerrados/arquivados continuam gerando alertas

Vários blocos não filtram arquivamento e encerramento:
- `checklist_parado` busca projetos sem filtrar `arquivado_em` do projeto, nem status/arquivamento do cliente.
- `contrato_sem_renovacao`, `compromisso_vencido`, `briefing_pre_reuniao` e `sem_contato` não checam `clientes.arquivado_em`.
- No painel, "Alertas do portfólio" lista clientes de qualquer status (inclusive encerrado/arquivado) e contratos sem checar `encerrado_em`.

Correção:
- Na edge function: excluir clientes com `arquivado_em` preenchido ou status `encerrado`; excluir projetos arquivados; exigir contrato ativo com `encerrado_em` nulo.
- No `MeuPainel`: aplicar os mesmos filtros nas consultas de alertas de portfólio.
- Limpeza pontual: marcar como lidas as notificações pendentes que apontam para clientes/projetos já arquivados ou encerrados, deixando o painel limpo desde já.

## Problema 3 — alertas críticos captando insatisfação do dia a dia, não com a consultoria

O prompt de análise do cliente pede "insatisfação, frustração... reclamações recorrentes" sem distinguir se a queixa é **sobre a consultoria** ou sobre o cotidiano da imobiliária (mercado, equipe interna, sistemas, clientes finais). Por isso entram sinais irrelevantes.

Correção em `analisar-reuniao`:
- Reescrever a instrução deixando o critério explícito: só é alerta quando o desconforto for **direcionado à consultoria** — questionamento de valor/ROI do trabalho, insatisfação com a consultora ou com a metodologia, cobrança de resultados prometidos, menção a pausar/cancelar/renegociar contrato, comparação com outra consultoria. Reclamações sobre mercado, equipe interna, corretores, sistemas, clientes ou momento pessoal **não** são alerta.
- Acrescentar ao schema, em cada alerta, os campos `alvo` (`"consultoria"` | `"negocio_do_cliente"`) e `confianca` (0-1).
- Só notificar diretores quando houver ao menos um alerta com `alvo = "consultoria"` e severidade alta, ou média com confiança >= 0,7. Alertas de `negocio_do_cliente` continuam salvos na análise (contexto útil), mas não viram notificação.
- Exibir o alvo no card do painel para leitura rápida.

## Detalhes técnicos

Arquivos afetados:
- `supabase/functions/gerar-alertas-proativos/index.ts` — helper `jaNotificado(userId, tipo, entidadeId, dias)`; filtros de arquivamento/encerramento em todos os blocos.
- `supabase/functions/analisar-reuniao/index.ts` — prompt e schema dos alertas de sentimento; dedup por reunião independente de `lida`; filtro antes de inserir a notificação.
- `src/pages/MeuPainel.tsx` — filtros de status/arquivamento em `useAlertasPortfolio`.
- `src/components/painel/GestaoEquipeSection.tsx` — badge de alvo no card de sentimento.
- Uma migração apenas de limpeza (UPDATE marcando como lidas notificações órfãs de entidades encerradas/arquivadas).

Sem mudança de esquema de tabelas; os campos novos dos alertas vivem dentro do JSON `analise_cliente`/`metadata`.