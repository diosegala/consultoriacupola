

## Corrigir seletor de data do checklist

### Problema

O campo de data dos itens do checklist usa `<input type="date">` nativo (linha 268-276 do `ProjetoDetalheSheet.tsx`), que tem problemas de compatibilidade dentro de Dialogs do Radix -- o picker nativo pode não abrir ou não disparar o `onChange` corretamente. Além disso, visualmente fica inconsistente com o resto do sistema.

### Solução

Trocar o `<input type="date">` por um **Popover + Calendar** (mesmo padrão usado para a data limite do projeto), garantindo `pointer-events-auto` no Calendar para funcionar dentro do Dialog.

### Alteração

**`src/components/projetos/ProjetoDetalheSheet.tsx`** (linhas 267-276)

Substituir o `<input type="date">` por:
- Um `<Popover>` com `<PopoverTrigger>` mostrando a data formatada ou "Prazo"
- `<PopoverContent>` com `<Calendar mode="single">` e `pointer-events-auto`
- No `onSelect`, chamar `updateCheckItem.mutate()` com a data formatada em `yyyy-MM-dd`
- Botão pequeno (text-[10px]) consistente com o estilo do select de responsável

Nenhuma alteração de banco de dados necessária -- o hook `useUpdateChecklistItem` já suporta `due_date`.

