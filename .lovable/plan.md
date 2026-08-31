# Chat interno em tempo real

Ferramenta de mensagens entre os usuários da plataforma, com conversas 1:1 e grupos, em tempo real via Supabase Realtime.

## O que será entregue

**Página dedicada `/mensagens`**
- Coluna esquerda: lista de conversas ordenadas pela mensagem mais recente, com nome do interlocutor (ou do grupo), prévia da última mensagem, horário e badge de não lidas.
- Botão "Nova conversa": escolher um usuário (1:1) ou vários (grupo, com nome).
- Coluna direita: thread da conversa, mensagens agrupadas por dia, bolhas diferenciadas para mensagens próprias, envio com Enter, indicador "digitando...", ponto verde de presença online.
- Anexos: botão de clipe para imagem/documento; imagens renderizadas inline, demais arquivos como card com nome e link de download.

**Widget flutuante**
- Balão fixo no canto (ao lado do Oráculo) com badge do total de não lidas.
- Abre um painel lateral com a mesma lista/thread em versão compacta e botão para expandir para `/mensagens`.

**Integração**
- Item "Mensagens" na sidebar com contador de não lidas.
- Nova mensagem gera notificação no sino existente (tipo `mensagem_nova`) apenas se o destinatário não estiver com a conversa aberta; a notificação é marcada como lida ao abrir a conversa.

**Acesso**
- Todos os usuários ativos da plataforma podem conversar entre si.
- Cada usuário só enxerga conversas das quais participa; ninguém lê mensagens de conversas alheias.

## Detalhes técnicos

Migration (com GRANTs para `authenticated` e `service_role`, RLS habilitado):
- `chat_conversas`: `tipo` ('direta'|'grupo'), `nome`, `criado_por`, `ultima_mensagem_em`.
- `chat_participantes`: `conversa_id`, `user_id`, `ultima_leitura_em`, `arquivada`.
- `chat_mensagens`: `conversa_id`, `user_id`, `conteudo`, `anexo_url`, `anexo_nome`, `anexo_tipo`, `anexo_tamanho`, `editada_em`, `deletada_em`.
- Função SECURITY DEFINER `is_chat_participante(_conversa_id, _user_id)` para evitar recursão de RLS entre participantes e mensagens.
- Políticas: SELECT/INSERT em mensagens somente para participantes; UPDATE/DELETE (soft delete) só do próprio autor; participantes atualizam apenas a própria linha.
- Trigger em `chat_mensagens` para atualizar `ultima_mensagem_em` da conversa e inserir notificação para os demais participantes.
- Índice único parcial para impedir duas conversas diretas duplicadas entre o mesmo par.
- `ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensagens, chat_conversas, chat_participantes` + `REPLICA IDENTITY FULL`.

Storage: bucket privado `chat-anexos`, caminho `conversa_id/arquivo`, com políticas de leitura/escrita restritas a participantes; download via URL assinada. Limite de 20 MB por arquivo, validado também no cliente.

Frontend:
- `src/hooks/useChat.ts`: lista de conversas, mensagens paginadas (50 por página, scroll infinito para cima), envio, upload de anexo, marcar como lido, contagem de não lidas.
- Realtime em `useEffect` com `supabase.removeChannel` no cleanup: canal `postgres_changes` por conversa para mensagens novas, canal global para a lista, e canal de `presence` + `broadcast` para online/digitando.
- Componentes em `src/components/chat/`: `ChatLayout`, `ConversaList`, `ConversaThread`, `MessageBubble`, `MessageComposer`, `NovaConversaDialog`, `ChatFloatingWidget`.
- Nova rota `/mensagens` em `App.tsx` (dentro do layout autenticado), item na `Sidebar.tsx`, widget montado no `AppLayout.tsx`.
- Lista de usuários disponíveis a partir de `consultores` ativos com vínculo em `consultor_user`.
- Composer mantém o foco após enviar e ao trocar de conversa; envio otimista com estado "enviando".
- Estilo seguindo o design system atual (tokens semânticos, tema escuro, verde Cupola).

## Fora do escopo desta etapa
Reações, respostas encadeadas, busca dentro do histórico, mensagens de voz e chamadas.
