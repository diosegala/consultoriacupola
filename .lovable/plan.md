

## Melhorias no Kanban: Data Limite, Periodo e Reuniao Pre-selecionada

### Problema 1: Data limite nao persiste

A funcao `handleSaveDueDate` salva no banco mas nao invalida o cache do React Query, entao o card nao atualiza. Alem disso, a tabela `projetos` so tem `due_date` (data unica) -- precisa de `due_date_start` para suportar periodo.

### Problema 2: Reuniao sem cliente pre-selecionado

O `NovaReuniaoDialog` recebe apenas `consultorId` mas nao recebe `clienteId`. Quando aberto a partir de um card, o cliente deveria vir pre-preenchido.

### Solucao

**Migracao SQL**
- Adicionar coluna `due_date_start` (date, nullable) na tabela `projetos` para suportar periodo (inicio-fim)

**`ProjetoDetalheSheet.tsx`**
- Apos salvar due date, invalidar queries `['projetos']` e `['projeto_checklist', ...]` via queryClient para o card refletir a mudanca
- Trocar Calendar de `mode="single"` para `mode="range"`, salvando `due_date_start` e `due_date` (fim)
- Exibir o periodo selecionado no botao

**`KanbanCard.tsx`**
- Atualizar para exibir periodo (ex: "15/04 - 30/04") quando ambas as datas existirem

**`NovaReuniaoDialog.tsx`**
- Adicionar prop opcional `clienteId?: string`
- Quando recebido, pre-preencher `formData.cliente_id` com esse valor

**`KanbanBoard.tsx`**
- Passar `clienteId={selectedProjeto?.cliente_id}` para o `NovaReuniaoDialog`

**`useProjetos.ts`**
- Incluir `due_date_start` no tipo `Projeto`

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar `due_date_start` em projetos |
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Invalidar cache + calendar range |
| `src/components/projetos/KanbanCard.tsx` | Exibir periodo |
| `src/components/consultor/NovaReuniaoDialog.tsx` | Aceitar `clienteId` prop |
| `src/components/projetos/KanbanBoard.tsx` | Passar clienteId ao dialog |
| `src/hooks/useProjetos.ts` | Adicionar `due_date_start` ao tipo |

