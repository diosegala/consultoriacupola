## Escopo

Estender o módulo de Projetos com: múltiplos responsáveis por item, to-do pessoal privado, visibilidade de prazos/responsáveis no card do Kanban e nova página "Minhas tarefas".

## 1. Múltiplos responsáveis no checklist

### Schema
- Nova tabela `projeto_checklist_responsaveis`:
  - `checklist_item_id` (FK → `projeto_checklist.id`, ON DELETE CASCADE)
  - `consultor_id` (FK → `consultores.id`, ON DELETE CASCADE)
  - UNIQUE (`checklist_item_id`, `consultor_id`)
  - RLS via `is_authorized_user(auth.uid())` para `authenticated`.
- Manter `projeto_checklist.assigned_to` por compatibilidade (não usar mais na UI; migração popula a nova tabela se houver valor).

### UI (`ProjetoDetalheSheet.tsx`)
- Trocar o `<select>` único por um picker multi-select (popover com lista de consultores ativos, checkbox).
- Mostrar avatares/iniciais empilhadas no item; clicar abre o picker.
- Novo hook `useChecklistResponsaveis` com `add/remove/list`.

## 2. To-do pessoal privado

### Schema
- Nova tabela `todo_pessoal`:
  - `user_id` (uuid, NOT NULL — `auth.users.id`)
  - `projeto_id` (FK → `projetos.id`, ON DELETE CASCADE, NULLABLE — permite tarefas avulsas)
  - `titulo` (text)
  - `concluido` (bool)
  - `due_date` (date, nullable)
  - `ordem` (int)
- RLS: cada usuário só vê/edita as próprias linhas (`auth.uid() = user_id`).

### UI
- Nova aba/seção "Minhas tarefas" dentro do `ProjetoDetalheSheet` (visível só pro usuário logado, mostrando só as do projeto atual).
- Mesma UX do checklist (input + lista + checkbox + prazo), sem responsáveis.
- Hook `useTodoPessoal(projeto_id?)`.

## 3. Visibilidade no card do Kanban (`KanbanCard.tsx`)

- Pequeno bloco no rodapé do card mostrando:
  - `X/Y` itens concluídos (já existe? validar) + ícone de relógio com contagem de itens **vencidos** ou **a vencer ≤ 3 dias** (cor de alerta).
  - Avatares empilhados (até 3) dos consultores responsáveis por itens **abertos** + "+N" se exceder.
- Uma query única por card (`useProjetoChecklist`) já cobre — adicionar agregação local.

## 4. Página "Minhas tarefas" global

### Rota
- `/minhas-tarefas` (acessível pela sidebar; abrir só para usuários autenticados).

### Conteúdo
- Duas seções com tabs:
  1. **Itens de checklist atribuídos a mim** (juntando `projeto_checklist_responsaveis` onde o `consultor_id` = consultor do usuário logado, via `get_consultor_id_for_user`).
  2. **Meu to-do pessoal** (todos os `todo_pessoal` do usuário, em todos os projetos + avulsos).
- Filtros: status (aberto/concluído), prazo (vencidos, hoje, próximos 7 dias, sem prazo), projeto.
- Cada linha mostra: título, projeto/cliente vinculado, prazo, badge de status. Clicar leva ao projeto (abre o `ProjetoDetalheSheet`) ou marca como concluído inline.

### Hooks
- `useMinhasTarefas()` agrega ambas as fontes para o usuário logado.

## Migração (resumo)

```text
projeto_checklist_responsaveis (nova)
  -> popular com (id, assigned_to) onde assigned_to IS NOT NULL

todo_pessoal (nova)
```

GRANTs + RLS conforme padrão do projeto (`is_authorized_user` para tabelas compartilhadas, `auth.uid() = user_id` para o to-do pessoal).

## Fora de escopo

- Não mexer no fluxo de criação de projeto, etapas, agentes de IA.
- Não criar notificações/emails para vencimentos (consistente com a regra "system-only notifications").
- Não tocar em `assigned_to` legado além da migração inicial.
