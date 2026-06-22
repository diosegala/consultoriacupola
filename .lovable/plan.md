## Objetivo

Após sincronizar (manual ou noturna), o consultor precisa ver claramente **quais transcrições foram trazidas, quais foram puladas e por quê**. Hoje a página `/minhas-integracoes` só mostra "última sincronização: data/hora" e um toast genérico.

## Mudanças

### 1. Retorno da sincronização manual
`google-drive-sync-diario` já retorna `{ resultados: [{ importados, pulados, erros }] }`. O hook `useSyncDiarioManual` vai propagar esse retorno e a página vai exibir os contadores no toast (ex.: "3 importadas, 2 sem cliente, 0 erros") em vez do texto genérico atual.

### 2. Painel "Últimas transcrições encontradas"
Novo card abaixo do card "Google Drive" em `MinhasIntegracoes.tsx`, listando os últimos 20 registros de `reunioes_importadas_log` do consultor logado, ordenado por `data_importacao desc`:

| Coluna | Conteúdo |
|---|---|
| Arquivo | `nome_arquivo` (truncado, tooltip com nome completo) |
| Cliente | nome do cliente vinculado (via `cliente_id`) ou "—" |
| Importada em | `data_importacao` formatada `dd/MM HH:mm` |
| Status | badge: **Importada** (verde), **Sem cliente** (amarelo, com hint "cadastre apelido"), **Erro** (vermelho, tooltip com `erro`) |
| Ação | quando `status='importado'` e `reuniao_id` existe → link "Ver reunião" para `/consultores/{consultor_id}` (aba reuniões); quando `sem_match` → botão "Vincular cliente" que abre um pequeno dialog para escolher cliente e reimportar (chama `google-drive-importar-arquivo` com `file_id` armazenado). |

Filtro simples no topo do card: tabs **Todas / Importadas / Sem cliente / Erros** + botão refresh.

### 3. Indicador resumido no card de conexão
No bloco "Conectado", logo abaixo de "Última sincronização", adicionar três mini-stats da última sync (lidos do log filtrando por `data_importacao >= ultima_sincronizacao`):
- ✅ X importadas
- ⚠ Y sem cliente
- ✖ Z erros

### 4. Hooks novos
- `useReunioesImportadasLog(consultorId, { status?, limit })` em `useGoogleDrive.ts` — query React Query do log com join opcional ao nome do cliente (carregar `clientes` via outra query e mapear no client, padrão usado em outros hooks do projeto).
- Atualizar `useSyncDiarioManual` para invalidar também `['reunioes-importadas-log']`.

### Out of scope
- Não mexer em `google-drive-sync-diario` (já loga tudo certo).
- Não mexer no fluxo do dialog `ImportarDriveDialog` (página separada).
- Sem notificações por e-mail.
