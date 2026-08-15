# Corrigir recarregamento da página ao trocar de aba

## O que está acontecendo

Ao voltar para a aba do navegador, o app parece "recarregar" e demora. São duas causas somadas:

1. **O app volta para a tela de carregamento (esqueleto).** Quando a aba recupera o foco, o Supabase reemite um evento de sessão. O `AuthContext` trata esse evento como um novo login: ele liga o `roleLoading` e refaz a consulta do papel do usuário. Enquanto isso, o layout principal (`AppLayout`) troca a página inteira por um esqueleto de carregamento — daí a sensação de reload e a perda do estado da tela.

2. **Todas as consultas são refeitas ao mesmo tempo.** O React Query está sem configuração (`new QueryClient()`), então usa os padrões: revalidar tudo no foco da janela e considerar todo dado obsoleto imediatamente. Em páginas pesadas (Meu Painel, Clientes, Contratos) isso dispara dezenas de requisições simultâneas ao voltar para a aba — o que explica a lentidão.

## Correções propostas

### 1. AuthContext deixa de reprocessar sessão repetida
- Guardar o `user.id` atual e, no `onAuthStateChange`, só refazer a busca do papel quando o usuário realmente mudar (login diferente ou logout).
- Eventos de revalidação (`TOKEN_REFRESHED`, `USER_UPDATED`, `SIGNED_IN` do mesmo usuário, `INITIAL_SESSION`) apenas atualizam sessão/usuário, sem tocar em `loading`/`roleLoading`.
- Resultado: nada de esqueleto ao voltar para a aba; o estado da página permanece.

### 2. AppLayout só mostra esqueleto no carregamento inicial
- Exibir o esqueleto apenas enquanto ainda não há usuário/papel resolvido pela primeira vez. Depois disso, revalidações acontecem em segundo plano sem desmontar a tela.

### 3. Configurar o React Query com padrões saudáveis
Em `src/App.tsx`:
- `refetchOnWindowFocus: false`
- `staleTime: 60s` (dados continuam válidos por 1 minuto)
- `gcTime: 5 min`, `retry: 1`, `refetchOnReconnect: true`
Assim, voltar para a aba não dispara uma enxurrada de requisições; a atualização acontece nas ações do usuário e após 1 minuto de inatividade.

## Verificação
Abrir uma página pesada (ex.: Meu Painel), trocar de aba, voltar e confirmar via navegador que: não aparece o esqueleto, o estado da tela permanece e não há rajada de requisições novas na aba de rede.

## Fora de escopo
Nenhuma mudança em regras de negócio, RLS ou edge functions.
