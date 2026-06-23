---
name: Tarefas e responsáveis em projetos
description: Múltiplos responsáveis por item de checklist, to-do pessoal privado por usuário e página global "Minhas tarefas"
type: feature
---
- Checklist de projeto suporta múltiplos consultores responsáveis por item via tabela `projeto_checklist_responsaveis` (M:N). Campo legado `projeto_checklist.assigned_to` mantido por compatibilidade, mas não é mais usado pela UI.
- Cada usuário tem to-do pessoal privado em `todo_pessoal` (RLS por `auth.uid()`). Pode ser vinculado a um projeto ou avulso.
- Admin/diretor podem atribuir tarefas a consultoras via `todo_pessoal.assigned_by`. A responsável só pode marcar como concluída (trigger bloqueia edição de título/prazo); apenas o gestor que atribuiu pode editar/excluir. Aparecem no "To-do pessoal" da responsável com badge "Atribuída por gestor" e em uma aba "Atribuídas por mim" (visível só para gestores) em `/minhas-tarefas`.
- Card do Kanban exibe contagem de itens de checklist vencidos e a vencer em ≤3 dias, além de avatares (iniciais) dos responsáveis de itens em aberto.
- Página `/minhas-tarefas` (admin e consultor) agrega itens de checklist atribuídos ao consultor do usuário logado (via `consultor_user`) + todo pessoal, com filtros de status, prazo e busca.