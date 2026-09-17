# Entrar com o Google e dispensar a conexão manual

Sim, é possível. Hoje existem duas coisas separadas: o login por e-mail/senha e a conexão com o Google feita na página "Minhas Integrações". Dá para unir as duas: a pessoa clica em "Entrar com Google", autoriza uma única vez o acesso às reuniões (Drive), à agenda e às planilhas, e o sistema já guarda essa autorização sozinho. Ninguém mais precisa passar pela página de integrações.

## Como fica para o usuário

1. Na tela de acesso aparece o botão "Entrar com Google" (o acesso por e-mail e senha continua existindo).
2. Na primeira vez, o Google mostra a tela de permissões (reuniões no Drive, agenda, planilhas e documentos).
3. Depois de autorizar, a pessoa entra no sistema e a integração já está ativa — a sincronização diária das atas passa a funcionar sem nenhum passo extra.
4. Em "Minhas Integrações" a página continua existindo, mas só para mostrar o status (conta conectada, pasta das reuniões, última sincronização) e para reconectar caso a autorização expire ou seja revogada.

## Pontos de atenção

- Só entram pessoas já cadastradas: o login com Google será aceito apenas se o e-mail da conta Google corresponder a um usuário existente e vinculado a um consultor. Contas desconhecidas são recusadas com mensagem clara.
- A autorização de longo prazo (a que permite a sincronização automática rodar de madrugada) só é entregue pelo Google na primeira autorização. Quem já está conectado hoje não precisa fazer nada; para os demais, o primeiro login com Google resolve.
- Quem preferir continuar com e-mail e senha pode seguir usando, e nesse caso ainda usará o botão de conectar o Google na página de integrações.
- É preciso ajustar as configurações do projeto no Google (endereço de retorno da autenticação) e ativar o provedor Google no backend — faço isso e indico o que precisa ser colado no console do Google.

## Detalhes técnicos

- Ativar o provedor Google no Supabase Auth com o mesmo `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` já usados pelas edge functions; adicionar o redirect `https://<projeto>.supabase.co/auth/v1/callback` no console do Google.
- `Auth.tsx`: botão "Entrar com Google" chamando `signInWithOAuth({ provider: 'google' })` com `scopes` iguais aos de `google-oauth-start` (drive.readonly, documents, spreadsheets, calendar.events, calendar.readonly, userinfo.email) e `queryParams: { access_type: 'offline', prompt: 'consent' }` para obter o refresh token.
- Nova edge function `google-auth-sync-tokens`: recebe `provider_token` e `provider_refresh_token` da sessão logo após o retorno do OAuth, valida o usuário pelo JWT, resolve `consultor_user`, detecta a pasta Meet e faz upsert em `consultor_google_tokens` (mesma lógica de `google-oauth-callback`, sem troca de `code`).
- Chamada dessa função num handler pós-login (`onAuthStateChange` com `SIGNED_IN` + presença de `provider_refresh_token`) — o refresh token só aparece nessa primeira sessão, então precisa ser enviado imediatamente.
- Bloqueio de contas não cadastradas: trigger/verificação no primeiro login que faz `signOut` e mostra erro quando não há `consultor_user` para o `user_id` (ou e-mail não corresponde a consultor ativo).
- `google-oauth-start` / `google-oauth-callback` / `GoogleCallback.tsx` permanecem como caminho de reconexão manual.
- `MinhasIntegracoes.tsx`: o cartão de conexão passa a exibir "conectado via login Google" quando a origem for o login, mantendo o botão de reconectar.
