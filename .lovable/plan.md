## Problema
O OAuth callback localiza a pasta "Meet Recordings" via `name='Meet Recordings'`, sem filtrar por proprietário. Se o usuário tem acesso a uma pasta "Meet Recordings" compartilhada por outro consultor, ela pode ser escolhida no lugar da pasta pessoal. Além disso, a UI atual apenas diz "Localizada" — sem mostrar qual pasta foi detectada.

## Mudanças

### 1. Backend
- **Migração** `consultor_google_tokens`: adicionar colunas
  - `pasta_meet_nome text`
  - `pasta_meet_link text` (webViewLink do Drive)
  - `pasta_meet_owner_email text`
- **`supabase/functions/google-oauth-callback/index.ts`**:
  - Buscar pasta com filtro `'me' in owners` + `name='Meet Recordings'`.
  - Pedir campos `id,name,webViewLink,owners(emailAddress)`.
  - Persistir `pasta_meet_nome`, `pasta_meet_link`, `pasta_meet_owner_email`.
- **Nova edge function `google-drive-detectar-pasta`** (autenticada, callable pelo consultor dono): refresh access token, re-roda a busca por pasta `Meet Recordings` (com `'me' in owners`) e atualiza o registro. Permite re-detectar sem precisar refazer o OAuth.

### 2. Frontend
- **`useGoogleDrive.ts`**:
  - Estender `select` do `useGoogleConnection` com os novos campos.
  - Novo hook `useDetectarPastaMeet()` chamando a nova function; invalida `google-connection` no sucesso.
- **`MinhasIntegracoes.tsx`** — bloco "Pasta Meet Recordings" passa a mostrar:
  - Nome da pasta + link "Abrir no Drive" (ícone `ExternalLink`).
  - Email do proprietário; se diferente de `email_google`, exibir badge de aviso "Pasta de outro usuário — verifique".
  - Botão "Detectar novamente" que chama o novo hook (loading state).
  - Mensagem explicativa: "A detecção busca pastas que pertencem à sua conta Google."

## Detalhes técnicos
- Query Drive: `q="name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners"`. Caso retorne 0 resultados, fallback para a query antiga (sem `'me' in owners`) preservando o comportamento de detectar pastas compartilhadas, mas marcando `pasta_meet_owner_email` para exibir aviso.
- Types do Supabase serão atualizados na próxima geração; até lá, casts pontuais nos hooks.

## Fora do escopo
- Permitir selecionar pasta manual ou mudar o nome buscado.
- Mudanças na sincronização em si.