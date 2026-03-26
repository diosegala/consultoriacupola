

## Replicar funcionalidades do Kanban de referencia

### O que o projeto de referencia tem que este projeto ja tem
- Drag-and-drop com `@hello-pangea/dnd`
- Cards com due date (indicador visual de atraso/proximo)
- Checklist com progresso
- Contagem de comentarios
- Painel lateral (Sheet) com: due date editavel, observacoes, checklist, comentarios, reunioes

### O que o projeto de referencia tem que FALTA neste projeto

| Funcionalidade | Descricao |
|----------------|-----------|
| **Card Modal (Dialog)** | O projeto de referencia usa um Dialog grande (max-w-4xl, layout 2 colunas) em vez de Sheet lateral. Mais espaco para detalhes. |
| **Tags coloridas nos cards** | Sistema de tags com cores customizaveis (12 cores), adicionar/remover tags por card |
| **Barra de progresso visual** | Barra colorida no checklist (nao apenas "2/5") |
| **Multiplas checklists por card** | Cada card pode ter varias checklists nomeadas (ex: "Documentos", "Entregas") |
| **Atribuicao de responsavel por item de checklist** | Cada item pode ter um membro responsavel |
| **Datas por item de checklist** | Data de inicio e prazo por item individual |
| **Busca e filtros no board** | Barra de busca + filtro por membro + filtro por tag |
| **Estilo CSS dos cards** | Classes `.kanban-card` com hover ring, dragging com scale+rotate |
| **Log de atividades** | Historico de acoes no card (quem fez o que e quando) |
| **Eventos/reunioes agendaveis** | Formulario completo com data, hora inicio/fim para agendar eventos dentro do card |

### Plano de implementacao

**Fase 1 -- Melhorias visuais e CSS**
- Adicionar classes `.kanban-card` e `.kanban-card-dragging` no `index.css`
- Refatorar `KanbanCard.tsx` para usar essas classes e melhorar indicadores visuais (badge de due date com fundo colorido)

**Fase 2 -- Tags**
- Migracao SQL: criar tabelas `projeto_tags` (id, nome, cor) e `projeto_tag_vinculo` (projeto_id, tag_id)
- Hook `useProjetoTags` com CRUD
- Exibir tags coloridas nos cards
- Adicionar/remover tags no painel de detalhe

**Fase 3 -- Upgrade do painel de detalhe (Sheet → Dialog)**
- Trocar `ProjetoDetalheSheet` de Sheet para Dialog full (2 colunas: conteudo principal + sidebar com acoes)
- Adicionar barra de progresso visual no checklist
- Permitir multiplas checklists nomeadas por projeto (requer refatoracao da tabela `projeto_checklist` para ter checklist groups)

**Fase 4 -- Filtros no board**
- Criar componente `BoardFilters` com busca por texto + filtro por consultor (ja existe parcialmente) + filtro por tag
- Integrar no `KanbanBoard.tsx`

**Fase 5 -- Atribuicao e datas em itens de checklist**
- Migracao SQL: adicionar colunas `assigned_to`, `start_date`, `due_date` em `projeto_checklist`
- UI de atribuicao de responsavel e datas por item dentro do dialog

### Arquivos principais

| Arquivo | Acao |
|---------|------|
| `src/index.css` | Adicionar classes kanban-card |
| Migracao SQL | Tags, checklist groups, colunas extras em checklist |
| `src/components/projetos/KanbanCard.tsx` | Refatorar visual, adicionar tags |
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Converter para Dialog, layout 2 colunas, multiplas checklists, tags, barra de progresso |
| `src/components/projetos/BoardFilters.tsx` | Criar -- busca + filtros |
| `src/components/projetos/KanbanBoard.tsx` | Integrar filtros |
| `src/hooks/useProjetoTags.ts` | Criar |
| `src/hooks/useProjetoChecklist.ts` | Refatorar para suportar multiplos checklists |

### Nota

Vou implementar por fases para manter o controle. A Fase 1 (visual) e Fase 2 (tags) sao as mais impactantes visualmente. As fases 3-5 adicionam profundidade funcional. Posso executar todas de uma vez ou fase por fase -- o que preferir.

