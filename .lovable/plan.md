## Diagnóstico do fluxo atual

- **`/consultores/:id`** tem o card "Reuniões" como ponto principal de entrada: botão "Nova Reunião", lista com todas as reuniões daquele consultor (todos os clientes), visualização da análise e ações de re-analisar / excluir.
- **`/clientes/:id` → Desempenho** mostra apenas o score do cliente (engajamento), sem listar reuniões nem permitir gerenciá-las.
- A sincronização do Drive já cria as reuniões automaticamente vinculadas ao cliente certo, então o "Nova Reunião" no consultor virou exceção.

O resultado é que as reuniões ficam dispersas pelo consultor, enquanto o que faz sentido para a operação é vê-las **dentro do cliente** (cada cliente é o "fio do bordado") e o consultor virar uma visão agregada/relatório.

## Redesenho proposto

### 1. Nova aba "Reuniões" em `/clientes/:id`
Posicionar entre **Atendimento** e **Ferramentas** uma aba "Reuniões" (ícone `Video`). Vira o lugar canônico para ver/gerenciar as transcrições:

- Lista cronológica (mais recentes primeiro) de todas as reuniões do cliente.
- Por linha: data, consultor responsável (badge), duração, score IA (consultor) + score cliente, status da análise.
- Botão `+ Adicionar reunião manualmente` no topo (reaproveita `NovaReuniaoDialog`, mas com `cliente_id` travado e seletor de consultor).
- Indicador "via Google Drive" quando a reunião tem registro em `reunioes_importadas_log` com `status='importado'` (badge discreto).
- Ao clicar em uma reunião → abre o `ReuniaoAnalise` (modal existente) mostrando transcrição, resumo IA, análise consultor e análise cliente lado a lado.
- Ações por reunião: **Re-analisar** (apenas admin/diretor), **Excluir** (apenas admin/diretor), **Ver transcrição completa**.

A aba **Desempenho** continua existindo mas focada só nos gráficos agregados de engajamento (não duplica a lista).

### 2. `/consultores/:id` vira visão agregada
O card "Reuniões" atual perde a edição. Vira:

- Tabela compacta de **últimas N reuniões** (read-only), agrupada por cliente, com link direto para `/clientes/:cliente_id` → aba Reuniões.
- Botão "Nova Reunião" sai daqui (a entrada de reuniões manual passa a ser pelo cliente).
- Mantém as métricas (score médio, total analisadas, MRR, clientes ativos) e o botão "Gerar Relatório".
- Adiciona link "Ver todas reuniões deste consultor" que leva a uma página filtrada (ou simplesmente expande a tabela).

### 3. Permissões da análise (rodar/re-rodar)
Hoje qualquer usuário com sessão chama `useAnalisarReuniao`. Vamos:

- Esconder o botão **Re-analisar** para consultores comuns na nova aba Reuniões do cliente (e na visão do consultor).
- Manter o gatilho automático: ao inserir a reunião (manual ou via sync do Drive), continua disparando análise IA assim como hoje.
- Diretor/admin pode re-analisar manualmente quando quiser revisar o score.

### 4. Origem da reunião visível
Para diferenciar reuniões importadas vs. manuais, exibir no item da lista:

- "Importada do Drive em dd/mm" — quando `reunioes_importadas_log.reuniao_id = reuniao.id`.
- "Adicionada manualmente por <nome>" — quando não houver log correspondente. Não precisa de mudança de schema, basta um lookup leve.

### 5. Hooks novos / ajustados
- `useReunioesByCliente(clienteId)` — espelha `useReunioesByConsultor`, traz `consultores(nome)` e o flag `origem` via join leve com `reunioes_importadas_log` (consulta paralela e mapeia no client).
- `useReunioesByConsultor` deixa de ser ponto de edição — só leitura, agora pode ser limitado a últimos 30 dias / paginar.
- `useAnalisarReuniao` ganha checagem de role no UI consumer (não no hook, para evitar acoplamento).

### 6. Arquivos afetados
- `src/pages/ClienteDetalhe.tsx` — adicionar TabsTrigger + TabsContent "Reuniões".
- **Novo** `src/components/cliente/ReunioesClienteTab.tsx` — lista + ações + dialog manual.
- `src/components/consultor/NovaReuniaoDialog.tsx` — aceitar `clienteId` opcional travado.
- `src/pages/ConsultorDetalhe.tsx` — remover botão "Nova Reunião", encolher tabela para read-only com link por cliente.
- `src/components/consultor/ReunioesList.tsx` — virar variante read-only (ou criar `ReunioesListReadOnly`) e remover botões de excluir/re-analisar para não-admins.
- `src/hooks/useReunioes.ts` — adicionar `useReunioesByCliente` e helper de origem.

### Fora do escopo
- Não mexer no schema de `reunioes` nem em `analisar-reuniao` edge function.
- Não mudar o fluxo de sincronização do Drive (já redesenhado na frente anterior).
- Sem refazer o relatório consolidado do consultor (continua igual).

### Pergunta aberta
Quando o consultor (não diretor) entrar em `/clientes/:id` → Reuniões, ele deve **ver** as transcrições e análises das reuniões dele mesmo? Assumindo que **sim** (visualização aberta para o consultor responsável; restrição é só para re-analisar/excluir). Se você quiser que consultor não veja o score IA dele no cliente, me avise antes de implementar.
