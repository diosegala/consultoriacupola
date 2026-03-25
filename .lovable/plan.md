

## Vincular Consultores a Usuarios + Criar Projetos pela UI

### Visao geral

Duas funcionalidades novas na pagina `/projetos`:

1. **Vincular consultores a usuarios** -- admin pode associar um usuario auth a um consultor (tabela `consultor_user`) diretamente da pagina de Projetos
2. **Criar projetos (cards)** para clientes ativos -- botao "Novo Projeto" abre dialog com selecao de cliente, consultor e etapa inicial. Consultores so veem seus clientes; admins veem todos.

### Mudancas

**1. Dialog "Novo Projeto" (`src/components/projetos/NovoProjetoDialog.tsx`)**

- Campos: cliente (select filtrado), consultor (select, pre-selecionado se consultor logado), contrato (auto-detectado do cliente ativo), etapa inicial (select das etapas)
- Para consultores: lista apenas clientes com `consultor_id` igual ao do consultor logado, e consultor fica fixo
- Para admins: lista todos os clientes ativos, permite selecionar qualquer consultor
- Filtra clientes que ja tem projeto criado (evitar duplicatas)
- Usa `useCreateProjeto` existente

**2. Dialog "Vincular Consultor a Usuario" (`src/components/projetos/VincularConsultorDialog.tsx`)**

- Visivel apenas para admins
- Seleciona um consultor (da tabela `consultores`) e um usuario (da lista de auth users)
- Ao salvar, insere na tabela `consultor_user` e tambem adiciona a role `consultor` em `user_roles` se o usuario ainda nao tiver role
- Mostra lista de vinculos existentes com opcao de remover

**3. Atualizar KanbanBoard (`src/components/projetos/KanbanBoard.tsx`)**

- Adicionar botao "Novo Projeto" no header (ao lado do filtro de consultor)
- Adicionar botao "Vincular Consultores" (apenas para admin)
- Para consultores: buscar o `consultor_id` do usuario logado via hook para filtrar automaticamente

**4. Hook para consultor_user (`src/hooks/useConsultorUser.ts`)**

- `useConsultorUsers()` -- lista todos os vinculos (admin)
- `useMyConsultorId()` -- retorna o consultor_id do usuario logado
- `useCreateConsultorUser()` -- insere vinculo
- `useDeleteConsultorUser()` -- remove vinculo

**5. Ajuste no useProjetos**

- `useProjetos`: quando `isConsultor`, filtrar pelo `consultor_id` do usuario logado (usando `useMyConsultorId`)

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/projetos/NovoProjetoDialog.tsx` | Criar -- dialog para criar projeto/card |
| `src/components/projetos/VincularConsultorDialog.tsx` | Criar -- dialog para vincular consultor a usuario |
| `src/hooks/useConsultorUser.ts` | Criar -- hooks para CRUD de consultor_user |
| `src/components/projetos/KanbanBoard.tsx` | Editar -- adicionar botoes e integrar dialogs |
| `src/hooks/useProjetos.ts` | Editar -- filtro automatico para consultores |

### Detalhes tecnicos

- Nao precisa de migracao SQL -- as tabelas `consultor_user`, `projetos`, `projetos_etapas` e a role `consultor` ja existem
- RLS ja esta configurada corretamente para todos os casos
- A query de clientes disponiveis para criar projeto: buscar clientes ativos que ainda nao tem registro na tabela `projetos`
- O `useAuthUsers` existente ja busca a lista de usuarios via edge function `list-auth-users`

