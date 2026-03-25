## Kanban de Projetos de Consultoria com Acesso por Perfil

### Visao geral

Criar um board Kanban estilo Trello onde cada cliente ativo e um card, organizado por etapas do processo de consultoria. Os consultores acessam apenas essa area (+ registrar reunioes), enquanto diretores/admins continuam com acesso total ao sistema.

### Mudancas necessarias

**1. Nova role `consultor` no banco**

Adicionar `consultor` ao enum `app_role`. Isso permite distinguir usuarios consultores dos admins/directors no sistema de permissoes.

Tambem sera necessaria uma tabela de vinculacao `consultor_user` para associar um `user_id` (auth) a um `consultor_id` (tabela consultores), permitindo que o consultor veja apenas seus proprios clientes no kanban.

**2. Nova tabela `projetos_etapas**`

Tabela com as etapas configuráveis do Kanban:

- `id`, `nome`, `ordem`, `ativo`, `created_at`
- Exemplos de etapas iniciais: "Pré-Onboarding", "Onboarding", "Elaboração do Diagnóstico", "Apresentação do Diagnóstico"; "Primeiro Cliente Oculto", "Elaboração de OKRs", "Reuniões de acompanhamento"
- RLS: consultores podem ler, admins podem CRUD

**3. Nova tabela `projetos**`

Registra a posicao de cada cliente no kanban:

- `id`, `cliente_id`, `contrato_id`, `consultor_id`, `etapa_id`, `ordem_na_etapa`, `observacoes`, `created_at`, `updated_at`
- RLS: consultores veem apenas seus projetos, admins veem tudo

**4. Pagina Kanban (`/projetos`)**

- Board com colunas representando cada etapa
- Cards arrastáveis (drag-and-drop) com nome do cliente, tipo de consultoria e indicadores
- Ao mover um card, atualiza `etapa_id` e `ordem_na_etapa`
- Botao no card para abrir detalhes e registrar reuniao/transcricao
- Biblioteca: `@hello-pangea/dnd` (fork mantido do react-beautiful-dnd)

**5. Controle de acesso por role**

- Role `consultor`: ve apenas `/projetos` e pode registrar reunioes
- Role `admin`/`director`: ve tudo (dashboard, clientes, contratos, consultores, projetos, config)
- Sidebar condicional: mostra itens conforme a role do usuario
- AppLayout redireciona consultor para `/projetos` por padrao
- Rotas protegidas: consultores nao acessam `/clientes`, `/contratos`, `/configuracoes`

**6. Registro de reunioes a partir do Kanban**

- No card do projeto, botao "Registrar Reuniao" abre o mesmo dialog `NovaReuniaoDialog` existente
- Consultor cola/importa transcricao
- A analise de IA roda automaticamente (fluxo ja implementado)
- Diretor visualiza os resultados na area de consultores

### Arquivos a criar/modificar


| Arquivo                                    | Acao                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Migracao SQL                               | Adicionar role `consultor`, criar tabelas `projetos_etapas`, `projetos`, `consultor_user` |
| `src/pages/Projetos.tsx`                   | Pagina com board Kanban                                                                   |
| `src/components/projetos/KanbanBoard.tsx`  | Componente do board com drag-and-drop                                                     |
| `src/components/projetos/KanbanCard.tsx`   | Card de cliente                                                                           |
| `src/components/projetos/KanbanColumn.tsx` | Coluna de etapa                                                                           |
| `src/hooks/useProjetos.ts`                 | Hook para CRUD de projetos e etapas                                                       |
| `src/components/layout/Sidebar.tsx`        | Menu condicional por role                                                                 |
| `src/components/layout/AppLayout.tsx`      | Redirect e protecao de rotas por role                                                     |
| `src/contexts/AuthContext.tsx`             | Expor `isConsultor`                                                                       |
| `src/App.tsx`                              | Adicionar rota `/projetos`                                                                |
| `package.json`                             | Adicionar `@hello-pangea/dnd`                                                             |


### Fluxo do consultor

```text
Login → /projetos (Kanban)
  │
  ├── Ve seus clientes como cards nas colunas
  ├── Arrasta card para proxima etapa
  ├── Clica no card → detalhes do projeto
  │     └── Registrar Reuniao → cola transcricao → IA analisa
  └── Sidebar: apenas "Projetos" e "Sair"
```

### Fluxo do diretor/admin

```text
Login → / (Dashboard)
  │
  ├── Acessa tudo: Dashboard, Clientes, Contratos, Consultores, Projetos, Config
  ├── Em /projetos: ve o kanban de TODOS os consultores (com filtro por consultor)
  └── Em /consultores/:id: ve reunioes e analises de IA
```