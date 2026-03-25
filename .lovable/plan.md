

## Etapa 1: Cards enriquecidos + Painel lateral no Kanban

### Banco de dados

Nova migracão com 2 tabelas:

**`projeto_comentarios`**: `id`, `projeto_id` (FK projetos ON DELETE CASCADE), `user_id` (uuid), `texto` (text), `created_at`
- RLS: autenticados podem ler/inserir (is_authorized_user OR consultor do projeto)

**`projeto_checklist`**: `id`, `projeto_id` (FK projetos ON DELETE CASCADE), `titulo` (text), `concluido` (boolean default false), `ordem` (integer default 0), `created_at`
- RLS: autenticados podem CRUD (is_authorized_user OR consultor do projeto)

Adicionar coluna `due_date` (date, nullable) na tabela `projetos`.

### Alteracoes no card (`KanbanCard.tsx`)

- Mostrar `due_date` com icone de calendario (vermelho se vencido, amarelo se proximos 3 dias)
- Mostrar contagem de reunioes, comentarios e checklist (ex: "2/5 tarefas")
- Ao clicar no card (nao no botao de reuniao), abre painel lateral

### Painel lateral (`ProjetoDetalheSheet.tsx`)

Sheet (shadcn) que abre pela direita com:

1. **Cabecalho**: nome do cliente, consultor, etapa atual, due date editavel
2. **Observacoes**: textarea editavel
3. **Checklist**: lista de itens com checkbox, campo para adicionar novo, reordenavel
4. **Comentarios**: lista cronologica com campo para novo comentario
5. **Reunioes**: lista de reunioes do cliente/consultor com scores e botao "Nova Reuniao"

### Hooks novos

- `useProjetoComentarios(projetoId)` -- CRUD comentarios
- `useProjetoChecklist(projetoId)` -- CRUD checklist
- `useReunioesByProjeto(clienteId, consultorId)` -- lista reunioes filtradas

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabelas + add due_date |
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Criar -- painel lateral |
| `src/hooks/useProjetoComentarios.ts` | Criar |
| `src/hooks/useProjetoChecklist.ts` | Criar |
| `src/components/projetos/KanbanCard.tsx` | Editar -- indicadores + onClick |
| `src/components/projetos/KanbanBoard.tsx` | Editar -- state do sheet |
| `src/hooks/useProjetos.ts` | Editar -- incluir due_date no tipo e select de reunioes count |

---

## Etapa 2: Remover cadastro aberto da pagina de login

- Remover a aba "Cadastrar" e o `TabsList` do `Auth.tsx`
- Manter apenas o formulario de login e o link "Esqueci minha senha"

---

## Etapa 3: Pagina de redefinicao de senha + troca obrigatoria no primeiro acesso

### Validacao de senha

Schema atualizado: minimo 8 caracteres + pelo menos 1 caractere especial. Aplicado em:
- `Auth.tsx` (login validation)
- `Configuracoes.tsx` (alterar senha)
- Nova pagina `/reset-password`

### Pagina `/reset-password`

- Rota publica em `App.tsx`
- Detecta `type=recovery` no hash da URL
- Formulario: nova senha + confirmar, com validacao (8+ chars, caractere especial)
- Chama `supabase.auth.updateUser({ password })`
- Redireciona para `/auth` apos sucesso

### Corrigir redirect do "Esqueci minha senha"

Em `Auth.tsx`, alterar `redirectTo` de `/auth` para `/reset-password`.

### Troca obrigatoria no primeiro acesso

O admin cria o usuario com senha temporaria via `supabase.auth.admin.createUser` (edge function). Para forcar a troca:

- Adicionar campo `force_password_change` (boolean, default false) na tabela `user_roles`
- Quando admin cria usuario, insere com `force_password_change = true`
- No `AppLayout.tsx`, verificar se o usuario logado tem `force_password_change = true` — se sim, redirecionar para `/trocar-senha`
- Pagina `/trocar-senha` (rota protegida): formulario de nova senha, ao salvar atualiza a senha via `updateUser` e seta `force_password_change = false`
- Edge function `create-user` para admin criar usuarios com senha temporaria

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Add `force_password_change` em user_roles |
| `src/pages/ResetPassword.tsx` | Criar |
| `src/pages/TrocarSenha.tsx` | Criar -- troca obrigatoria |
| `supabase/functions/create-user/index.ts` | Criar -- admin cria usuario |
| `src/pages/Auth.tsx` | Editar -- remover signup, fix redirect, validacao |
| `src/pages/Configuracoes.tsx` | Editar -- validacao senha |
| `src/components/layout/AppLayout.tsx` | Editar -- check force_password_change |
| `src/App.tsx` | Editar -- add rotas |
| `src/contexts/AuthContext.tsx` | Editar -- expor forcePasswordChange |

---

Executarei etapa por etapa, sinalizando ao concluir cada uma para voce aprovar antes de avancar.

