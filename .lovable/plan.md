

## Exibir nome do usuario nos comentarios

### Problema
Os comentarios mostram apenas a data, sem identificar quem comentou.

### Solucao
Buscar os emails dos usuarios que comentaram via `supabase.auth.admin` nao e possivel no client. A abordagem mais simples: usar o `user_id` de cada comentario para buscar o email via uma query ao edge function `list-auth-users` ja existente, ou fazer um join client-side com os dados ja disponiveis.

Como o hook `useProjetoComentarios` ja retorna `user_id`, e o componente ja tem acesso ao `user` logado, a melhor abordagem e:

1. Criar um estado/cache local com um map de `user_id → email` buscando via edge function `list-auth-users` (ja existe e retorna todos os usuarios)
2. Exibir o email (ou parte dele) ao lado da data em cada comentario

### Alteracoes

**`src/components/projetos/ProjetoDetalheSheet.tsx`**
- Importar `useEffect, useMemo` e o supabase client
- Buscar lista de auth users via `supabase.functions.invoke('list-auth-users')` uma vez quando o dialog abre
- Criar um `Map<string, string>` de `userId → email`
- Na renderizacao de cada comentario, exibir o email (ou nome antes do @) do autor acima/ao lado da data
- Destacar visualmente com um `<span>` em negrito ou com Avatar + iniciais

**Nenhuma alteracao de banco de dados necessaria** -- o `user_id` ja esta salvo em `projeto_comentarios`.

