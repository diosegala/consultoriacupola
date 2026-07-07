## Objetivo

No **Meu Painel** do diretor, distinguir **1:1** (desenvolvimento/feedback) de **Weekly** (tarefas da semana), reorganizar a visualização em cards por liderada (não lista aberta) e deixar cada análise mais resumida.

---

## 1. Novo tipo de reunião no backend

Migration em `reunioes_gestao`:
- Estender coluna `tipo` para aceitar: `1on1`, `weekly`, `equipe` (mantendo `individual` como legado para não quebrar registros antigos).
- Backfill: converter registros antigos `individual` para `1on1` como padrão (visto que hoje tudo entra como "1:1").
- Não muda schema — apenas normaliza dados.

## 2. Detecção pelo nome do arquivo (google-drive-sync-diario)

Na função `google-drive-sync-diario`, ao criar `reunioes_gestao`, decidir o tipo pelo nome do arquivo (case-insensitive):

```text
nome contém "1:1" OU "1 a 1" OU "one-on-one"  → tipo = 1on1
nome contém "weekly" OU "semanal de equipe"    → tipo = weekly
2+ liderados detectados                         → tipo = equipe (independente do nome)
caso contrário                                  → tipo = 1on1 (fallback)
```

## 3. Prompts de análise separados (mais resumidos)

Refatorar `analisar-reuniao-gestao` para carregar prompt e schema conforme `reuniao.tipo`.

**Prompt 1:1 (desenvolvimento):**
- 3 scores (0-10): escuta ativa, feedback, desenvolvimento.
- 1 ponto forte, 1 sugestão de melhoria (2-3 frases), até 3 ações combinadas.
- Resumo em até 4 linhas.

**Prompt Weekly (execução):**
- 3 scores (0-10): clareza de prioridades, identificação de bloqueios, follow-up de tarefas anteriores.
- Lista de compromissos da semana (tarefa · responsável · prazo), bloqueios identificados.
- Resumo em até 3 linhas — sem seção de "pontos fortes/desenvolvimento".

**Prompt Equipe:** manter o atual (5 dimensões), mas comprimir para no máximo 5 bullets no resumo.

Contexto DISC continua sendo injetado nos três prompts.

## 4. Novo botão "Reanalisar" no card da reunião

- Botão pequeno no cabeçalho do card da reunião (Meu Painel e onde mais listar), visível para admin/director.
- Ao clicar: define `status_analise = 'pendente'`, chama `analisar-reuniao-gestao` novamente. Toast de confirmação e refresh da lista.
- Sem reanálise em massa — sob demanda por reunião.

## 5. Reorganização visual: cards por liderada + drawer

Substituir a lista atual de "Minhas reuniões de gestão" por:

### 5a. Grid de cards por liderada (compacto)

Um card por consultora que aparece em ao menos uma `reunioes_gestao` do diretor logado:
- Nome + foto/inicial + badge DISC (mesma pill do Radar).
- Contadores: N 1:1 · N Weekly (últimos 90 dias).
- Data da última 1:1 e da última Weekly (com destaque vermelho se atrasada — >14d para 1:1, >7d para Weekly).
- Reuniões de equipe aparecem em um card extra "Equipe" no fim do grid.

### 5b. Drawer / Sheet ao clicar no card

Abre um `Sheet` lateral com:
- Header: nome da liderada + badge DISC + link "Ver perfil completo" (`/consultores/:id`).
- Tabs: **1:1** | **Weekly** (contadores nas tabs).
- Cada tab: lista cronológica reversa de reuniões, cada uma **colapsada** por padrão (Accordion) mostrando só data + status.
- Ao expandir uma reunião: resumo (4 linhas), scores em barras, ações combinadas, sugestão de melhoria, e o botão **Reanalisar**.

## 6. Cadência e alertas

- Ajustar `gerar-alertas-proativos` bloco 4d: alerta "1:1 atrasado" passa a usar `tipo = '1on1'` (e legado `individual`); novo alerta "Weekly atrasada" com janela de 10 dias.
- Briefing `briefing_1x1` continua igual (dispara com base em compromissos, não no tipo).

---

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/migrations/*` — backfill `individual → 1on1`.
- `supabase/functions/google-drive-sync-diario/index.ts` — detecção de tipo pelo nome.
- `supabase/functions/analisar-reuniao-gestao/index.ts` — 3 prompts + 3 schemas por tipo.
- `supabase/functions/gerar-alertas-proativos/index.ts` — cadência Weekly + ajuste 1:1.
- `src/components/painel/GestaoEquipeSection.tsx` — remove lista atual, adiciona grid de cards + Sheet com tabs/accordion + botão Reanalisar.
- Novo hook `useReunioesGestaoPorLiderada` que agrupa por consultora e conta por tipo.
- Novo endpoint interno via `supabase.functions.invoke('analisar-reuniao-gestao', { body: { reuniao_gestao_id } })` para o botão Reanalisar.

**Compatibilidade:**
- Componente `ScoreBar` continua o mesmo; só as chaves de dimensão mudam por tipo.
- Filtragem por consultora usa `participantes[]` (nome) já preenchido pela sync.

**Fora do escopo:**
- Edição manual do tipo (você escolheu detecção pelo nome).
- Reanálise em massa automática (só sob demanda pelo botão).
