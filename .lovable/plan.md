## Integração Google Drive por consultor (OAuth) + sincronização automática

### Respostas absorvidas
1. **Todos os consultores podem conectar** (admin/director também, via mesma tela)
2. **Mapeamento por iniciais/nome**: nova tabela `cliente_aliases` para casar nomes de arquivo do Meet com clientes do sistema
3. **Job automático diário** (cron à noite, ~03:00 BRT) varrendo a pasta de cada consultor conectado
4. **Sim, resolve.** Você cria UM par de credenciais OAuth no seu Google Cloud Console e ele é usado por todos os consultores. Cada consultor apenas autoriza o app (consent screen) com a própria conta Google. Não precisa que cada consultor tenha acesso ao Console.

### Pré-requisitos no Google Cloud Console (você faz uma vez)
1. Criar projeto (ou usar existente) → ativar **Google Drive API**
2. **OAuth consent screen**:
   - Tipo: **External**
   - Scopes: `.../auth/drive.readonly`, `.../auth/userinfo.email`, `openid`
   - Adicionar consultores como **Test users** (até publicar o app) — ou publicar para qualquer Google
3. **Credentials → OAuth Client ID** (Web application):
   - Authorized redirect URI: `https://consultoriacupola.lovable.app/google-callback` e `https://id-preview--7f69d000-e8b3-4da7-8b56-ef124a1e7000.lovable.app/google-callback`
4. Copiar **Client ID** e **Client Secret** → cadastrar como secrets no Lovable Cloud

### O que muda

#### 1. Migração SQL
- Tabela `consultor_google_tokens` (1:1 com consultor): `consultor_id`, `email_google`, `access_token`, `refresh_token`, `expires_at`, `escopo`, `pasta_meet_id` (opcional, descoberta automática), `ativo`
- Tabela `cliente_aliases`: `id`, `cliente_id`, `alias` (texto livre — iniciais ou nome alternativo), `created_at`
- Tabela `reunioes_importadas_log`: `google_file_id` (unique), `consultor_id`, `cliente_id`, `reuniao_id`, `data_importacao` — evita reimportar o mesmo arquivo
- RLS: consultor vê apenas suas próprias linhas; admin vê tudo

#### 2. Secrets
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

#### 3. Edge functions
| Função | Responsabilidade |
|---|---|
| `google-oauth-start` | Gera URL de autorização do Google e retorna ao frontend |
| `google-oauth-callback` | Recebe `code`, troca por tokens, salva em `consultor_google_tokens` |
| `google-drive-list-arquivos` | Lista arquivos da pasta "Meet Recordings" do consultor logado (com refresh automático de token) |
| `google-drive-importar-arquivo` | Baixa conteúdo de um arquivo específico (Google Doc → text/plain), tenta casar com cliente via aliases, cria registro em `reunioes` |
| `google-drive-sync-diario` | Cron noturno: para cada consultor ativo, lista arquivos novos e importa automaticamente (somente os que tiverem match de cliente) |

#### 4. Cron (pg_cron + pg_net)
- Job diário às 03:00 BRT chamando `google-drive-sync-diario`

#### 5. Frontend
| Arquivo | Mudança |
|---|---|
| `src/pages/MinhasIntegracoes.tsx` (nova) | Botão "Conectar Google Drive" + status (conectado/desconectado, email Google, última sincronização) + botão "Sincronizar agora" |
| `src/pages/GoogleCallback.tsx` (nova) | Rota `/google-callback` que recebe o `code` e chama a edge function |
| `src/components/cliente/ClienteFormDialog.tsx` | Seção "Apelidos/Iniciais" — admin cadastra variações de nome do cliente (ex: "ACME", "ACM", "Acme Corp") |
| `src/components/consultor/NovaReuniaoDialog.tsx` | Botão "Importar do Google Drive" → modal com lista de arquivos não importados |
| `src/components/layout/Sidebar.tsx` | Link "Minhas Integrações" |
| `src/App.tsx` | Rotas novas |

### Fluxo de matching de cliente
1. Nome do arquivo do Meet vem como `Reunião com [ACME] - 2026-05-20` ou `Meet ACME 20/05`
2. Sistema extrai conteúdo entre colchetes OU faz busca textual no nome do arquivo
3. Compara contra `clientes.nome` e `cliente_aliases.alias` (case-insensitive)
4. Match único → importa automaticamente; múltiplos matches ou nenhum → fica pendente para revisão manual no botão "Importar do Google Drive"

### Fluxo completo do consultor
1. Acessa "Minhas Integrações" → clica "Conectar Google Drive"
2. Redireciona para Google → autoriza acesso à pasta "Meet Recordings"
3. Volta ao sistema → tokens salvos
4. Todo dia à noite, sistema importa automaticamente reuniões novas com clientes identificados
5. Reuniões importadas aparecem em "Minhas Reuniões" prontas para análise pela IA

### Pontos de atenção
- **Refresh token**: Google só envia refresh_token na primeira autorização — usar `access_type=offline&prompt=consent`
- **Pasta "Meet Recordings"**: descoberta via Drive API buscando `name='Meet Recordings' and mimeType='application/vnd.google-apps.folder'`
- **Formato do arquivo**: Meet salva como Google Doc (transcrição); usamos `files.export?mimeType=text/plain`
- **Tokens criptografados**: ficam no banco com RLS estrita; só edge functions com service_role acessam

### Confirmação antes de começar
Após sua aprovação, vou:
1. Criar migração SQL
2. Pedir os 2 secrets (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) — você só cadastra depois de criar a credencial no Google Cloud Console
3. Implementar edge functions + frontend
4. Configurar cron diário
