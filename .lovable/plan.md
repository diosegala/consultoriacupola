

## Reverter seletor de data para data unica

### Problema
O seletor de periodo (range) nao esta funcionando bem -- a cada clique salva imediatamente no banco, sem esperar a selecao completa do intervalo.

### Solucao
Reverter para selecao de data unica (`mode="single"`), que e mais simples e funcional.

### Alteracoes

**`src/components/projetos/ProjetoDetalheSheet.tsx`**
- Remover import de `DateRange` do react-day-picker
- Trocar `handleSaveDateRange` por `handleSaveDueDate` que recebe `Date | undefined` e salva apenas `due_date` (seta `due_date_start` como null)
- Trocar Calendar de `mode="range"` para `mode="single"`, `selected={dueDate}`, `onSelect={handleSaveDueDate}`
- Remover logica de `dateRange`, `dueDateStart`; exibir apenas `dueDate` formatada
- Remover `numberOfMonths={2}` (desnecessario para data unica)
- Label: "Data limite" em vez de "Periodo"

**`src/components/projetos/KanbanCard.tsx`**
- Remover exibicao de periodo; mostrar apenas `due_date` formatada

Nenhuma migracao necessaria -- a coluna `due_date_start` pode permanecer na tabela sem impacto.

