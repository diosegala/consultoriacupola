## Objetivo

Tornar a plataforma o "hub" do consultor adicionando uma visualização do Google Calendar dele dentro do app, reduzindo a necessidade de abrir outras abas.

## O que é possível (e o que não é) com embed do Google Calendar

O Google **não permite** embedar a interface completa e interativa do Google Calendar (calendar.google.com) dentro de um iframe de outro domínio — eles bloqueiam via `X-Frame-Options: SAMEORIGIN`. Isso significa que **não dá para "logar" no Google e usar a UI nativa do Agenda inteira dentro da nossa plataforma** (criar evento, responder convite, arrastar, etc., com a mesma UX do calendar.google.com).

O que **dá** para fazer, em ordem de fidelidade:

### Opção A — Embed público read-only (iframe oficial do Google)

- Usa o iframe oficial `calendar.google.com/calendar/embed?src=...`.
- Mostra os eventos em visual de mês/semana/agenda.
- **Limitações graves para o caso de uso**: o calendário precisa estar público OU o consultor precisa estar logado na mesma conta Google no navegador (não dá para "vincular" via OAuth). Não permite criar evento, responder invite ou ver detalhes privados.
- **Conclusão**: não atende o pedido (responder invites, agendar).

### Opção B — Cliente de agenda próprio dentro do app (recomendado)

Construir uma "mini agenda" nossa, usando a Google Calendar API com o OAuth que cada consultora **já conecta hoje** em `MinhasIntegracoes` (a infra `google-oauth-start` / `google-oauth-callback` e a tabela `consultor_google_tokens` já existem — hoje cobre só Drive). Estendemos os scopes para incluir Calendar e construímos a UI.

Funcionalidades:

- Visão semana / dia / agenda (lista) dos calendários da conta Cupola da consultora.
- Mostrar eventos com horário, título, participantes, link do Meet.
- Criar novo evento (título, data/hora, descrição, convidados, gerar link do Meet automaticamente).
- Editar / excluir evento criado por ela.
- Responder convites: aceitar / recusar / talvez (atualizando `responseStatus` do attendee via API).
- Abrir o evento no Google Calendar em nova aba como "fallback" para edições avançadas.

Vantagem: roda 100% dentro da plataforma, integra com clientes/projetos no futuro (ex.: "agendar reunião com cliente X" já preenche convidado). Desvantagem: é UI nossa, não idêntica à do Google.

### Opção C — Híbrido

Mostrar a lista/grade de eventos em UI nossa (Opção B) e, para ações pesadas (configurar recorrência complexa, etc.), botão "Abrir no Google Calendar" em nova aba.

## Recomendação

**Opção B**, com botão de fallback "Abrir no Google Calendar" (Opção C de fato). É o único caminho que entrega "agendar reuniões e responder invites de dentro da plataforma".

## Escopo proposto (fase 1)

1. **Ampliar OAuth existente**
  - Adicionar scopes `https://www.googleapis.com/auth/calendar.events` e `https://www.googleapis.com/auth/calendar.readonly` em `google-oauth-start`.
  - Avisar consultoras já conectadas que precisam reconectar (badge/alerta em `MinhasIntegracoes`) para concederem o novo scope.
2. **Nova página `/agenda**` (item no Sidebar, visível para consultor/diretor/admin)
  - Visões: Semana (default), Dia, Lista (próximos 30 dias).
  - Componente de calendário (usar `react-big-calendar` ou montar grid simples com Tailwind — definir na implementação).
  - Filtro por calendário (primary, secundários da conta).
3. **Edge functions novas**
  - `gcal-list-events` (range start/end, lista calendars do usuário, retorna eventos).
  - `gcal-create-event` (título, início, fim, descrição, convidados, criar Meet via `conferenceData`).
  - `gcal-update-event` (editar).
  - `gcal-delete-event`.
  - `gcal-respond-invite` (PATCH no attendee `responseStatus`).
  - Todas reutilizam refresh token de `consultor_google_tokens` (lógica de refresh já existe nas funções de Drive — extrair helper compartilhado).
4. **UI de criação/edição de evento**
  - Dialog com formulário (título, datas, descrição, convidados por e-mail, toggle "criar link do Meet").
  - Em eventos existentes: botões Aceitar / Recusar / Talvez quando o usuário é attendee.
  - Link "Abrir no Google Calendar" para casos não cobertos.
5. **Integração com plataforma (fase 1 leve)**
  - Botão "Agendar reunião" no detalhe do cliente que abre o dialog de criação já com o e-mail do cliente como convidado (se houver). Pode ficar para fase 2 se preferir.

## Fora de escopo (fase 1)

- Drag & drop de eventos.
- Recorrência complexa (oferecer "Abrir no Google" para isso).
- Notificações push de novos invites dentro da plataforma.
- Sincronização bidirecional automática com tabelas internas de reuniões/projetos.

## Detalhes técnicos

- **Auth**: reaproveita `consultor_google_tokens` + fluxo OAuth atual. Refresh token via `https://oauth2.googleapis.com/token` quando `expires_at` < now.
- **API base**: `https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`.
- **Meet**: ao criar evento, enviar `conferenceData.createRequest` + query `conferenceDataVersion=1`.
- **Cores/UI**: dark theme padrão da Cupola, eventos em #B0F90A para "meus", neutros para convites pendentes, vermelho para conflitos.
- **Permissões**: cada consultora vê só a própria agenda (token é dela). Diretor/admin não vê agenda de terceiros nesta fase.

## Perguntas antes de implementar

1. Confirma **Opção B** (cliente próprio) ao invés do iframe read-only? Confirmo
2. Quer o item no sidebar como **"Agenda"** próprio, ou dentro de `/minhas-tarefas` como aba?  
Agenda próprio no sidebar
3. Na fase 1, basta a consultora ver/criar/responder na **própria conta** dela, certo? (Sem visão consolidada de equipe.) Sim.
4. Atalho "Agendar reunião com cliente" a partir do detalhe do cliente entra na fase 1 ou fica para depois? Entra na fase 1.