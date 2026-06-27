## Diagnóstico

Confirmei no banco:
- `diosegala@gmail.com` → role `consultor`, `force_password_change = false`, vinculado ao consultor **Denise** (`d3428f5d…`).
- Esse consultor não tem **nenhum projeto** (`count = 0`).

Ou seja: dados estão coerentes, o usuário deveria cair em `/projetos` com um Kanban vazio. A "tela preta" indica um **erro de render não capturado** que está derrubando a árvore React inteira (some até a sidebar). Causas mais prováveis:

1. **Não existe ErrorBoundary no topo da app.** O `ErrorBoundary` atual só envolve o `<Outlet />` dentro do `AppLayout`. Se algo no `AppLayout`, `Sidebar`, `AuthProvider` ou `OraculoFloatingChat` quebra durante o render, nada é capturado e a tela fica preta (bg-background) sem conteúdo.
2. **`AppLayout` usa `window.location.pathname` (não-reativo)** para decidir o redirect do consultor. Em transições isso pode causar redirect em loop entre `/` → `/projetos` → `/` enquanto a árvore reconcilia, e em certos timings o `<Navigate>` é renderizado dentro de um efeito de hidratação que estoura.
3. **`Sidebar.NavLink` lista rotas como `/oraculo` e `/integracoes`** para consultor — `/integracoes` não está nas rotas (existe `/integracoes` ok), mas vale revalidar.
4. **`OraculoFloatingChat` está sempre montado** no `AppLayout`, e seu hook `useOraculoContext` chama `useLocation()` fora de rota — ok, está dentro do Router, então não é isso. Mas se o painel tentar render `OraculoChatPanel` com algum dado faltante, pode quebrar.
5. **`useProjetos` faz embed de `projeto_checklist_responsaveis`** cuja RLS só permite `is_authorized_user`. Para consultor isso vira embed vazio (ok), mas se PostgREST devolver erro, o React Query só guarda — não derruba a UI.

A causa #1 explica perfeitamente o sintoma "tela 100% preta sem sidebar". Sem boundary global, qualquer throw em provider/layout vira tela em branco.

## Plano de auditoria + correção

### 1. ErrorBoundary global (corrige o sintoma e dá visibilidade real do erro)
- Mover/duplicar o `ErrorBoundary` para envolver **toda** a árvore dentro do `<BrowserRouter>` em `src/App.tsx`. Assim, qualquer crash mostra a stack em vez de tela preta — e no próximo report do usuário já vamos ter o erro real.

### 2. Tornar o redirect do consultor reativo
Em `src/components/layout/AppLayout.tsx`:
- Trocar `window.location.pathname` por `useLocation().pathname`.
- Mover a lista de rotas restritas para uma constante fora do componente.
- Em vez de retornar `<Navigate>` no meio do render do layout, fazer a verificação via `useEffect` + `navigate('/projetos', { replace: true })` ou um `<Navigate>` apenas se ainda não estamos em rota permitida — evita re-render em cascata.

### 3. Endurecer o `AuthContext`
- Tratar erro de `fetchUserRole` (atualmente ignora `error`): logar e ainda assim setar `roleLoading=false` para não travar.
- Garantir que se a sessão expirar durante a navegação, o `AppLayout` cai em `/auth` em vez de renderizar sidebar com `user` nulo.

### 4. Defender o `KanbanBoard` e dependências
- `useProjetos`: já tolera array vazio. Adicionar `console.error` no `onError` da query para diagnóstico.
- `useConsultores`: chamado mesmo para consultor (que não usa o filtro). Gate com `enabled: !isConsultor` para evitar request desnecessário e qualquer side effect.
- `KanbanCard`: revisar acessos a `projeto.clientes?.cidade` etc. (já estão com `?.`, ok).

### 5. Audit complementar (rápido, mesma passagem)
- `OraculoFloatingChat`: garantir que não quebra quando `OraculoChatPanel` recebe `conversaId=null`.
- `Sidebar`: confirmar todos os `to` do `consultorMenuItems` existem em `App.tsx` (`/projetos`, `/agenda`, `/oraculo`, `/minhas-tarefas`, `/integracoes` — todos ok).
- `Agenda`, `MinhasTarefas`, `Oraculo`, `MinhasIntegracoes`: validar guard inicial quando `consultor_id` ausente para não jogar exception.
- Revisar `Auth.tsx`: após login, redirecionar para `/projetos` se for consultor (evita o ping-pong via `/`).

### 6. Validação
- Após aplicar, pedir ao usuário para reproduzir e checar:
  - Se a tela preta sumiu (deve aparecer o board vazio).
  - Se o ErrorBoundary capturar algo, ele agora mostrará a mensagem/stack — me envia para correção pontual.

## Detalhes técnicos
- Arquivos editados: `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/ErrorBoundary.tsx` (export reutilizável), `src/contexts/AuthContext.tsx`, `src/components/projetos/KanbanBoard.tsx`, `src/hooks/useProjetos.ts`, `src/pages/Auth.tsx`.
- Sem alterações de schema/migrations.
- Sem mudança de regras de negócio — só estabilidade, captura de erros e correção do redirect não-reativo.
