## Contexto
A aba "Ferramentas" na página do cliente (`/clientes/:id`) não faz sentido por enquante e deve ser omitida da UI, mantendo a possibilidade de reativá-la no futuro.

## Mudanças
1. **`src/pages/ClienteDetalhe.tsx`**
   - Remover o `TabsTrigger` e `TabsContent` da aba "ferramentas".
   - Remover os imports não utilizados (`Wrench` do lucide-react, `FerramentasTab`).
   - Ajustar o texto do diálogo de exclusão se mencionar "Ferramentas configuradas" (remover ou manter como está, já que o dado existe no backend).

## Fora do escopo
- Nenhuma alteração de schema, migração ou exclusão de dados.
- Componente `FerramentasTab` continua existindo no codebase para eventual reativação.