# Oráculo da Cupola dentro da plataforma

Disponibilizar para o consultor um chat com a base de conhecimento da Cupola (hoje no projeto "Oraculo da Cupola"), replicado neste projeto para autonomia total.

## 1. Backend (Lovable Cloud)

### Tabela `notion_documents`
Replica o schema usado no Oráculo.

```sql
CREATE TABLE public.notion_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  data_source_id text NOT NULL,
  title text,
  content text,
  url text,
  last_edited_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.notion_documents TO authenticated;
GRANT ALL ON public.notion_documents TO service_role;
ALTER TABLE public.notion_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.notion_documents
  FOR SELECT TO authenticated USING (public.is_authorized_user(auth.uid()));
CREATE INDEX ON public.notion_documents USING gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,'')));
```

### Tabela `oraculo_conversas` / `oraculo_mensagens` (histórico por consultor)
Para que o consultor possa retomar conversas antigas.

```sql
CREATE TABLE public.oraculo_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text,
  contexto_origem jsonb,   -- ex.: { tipo: 'cliente', id: '...', nome: '...' }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.oraculo_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.oraculo_conversas(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- GRANTs + RLS por user_id (auth.uid())
```

### Edge Functions
- `oraculo-sync-notion`: porta a função `sync-notion` do projeto Oráculo (mesmo databaseId `1a035c7b74608022a85fe26026dbb2d9` + futuros databaseIds do método de aluguel). Roda manualmente (botão admin em Configurações) e via cron.
- `oraculo-chat`: porta `chat/index.ts` do Oráculo, com duas adições:
  - Aceita `contexto_pagina` opcional (cliente/projeto/contrato atual) e injeta no system prompt.
  - Persiste a conversa em `oraculo_conversas`/`oraculo_mensagens` quando `conversa_id` é enviado.
  - Mantém streaming SSE, busca por keywords em `notion_documents`, modelo `google/gemini-2.5-flash` via Lovable AI Gateway.

### Secrets necessários
- `NOTION_API_KEY` (será solicitado via add_secret quando for sincronizar).
- `LOVABLE_API_KEY` (já existe).

## 2. Frontend

### Componente global `<OraculoFloatingChat />`
- Botão flutuante (ícone do Cupola) fixo no canto inferior direito, dentro de `AppLayout`, visível em todas as rotas autenticadas.
- Clique abre um `Sheet` lateral à direita (~480px) com:
  - Header com toggle de **"Usar contexto desta página"** (default: ligado quando há contexto detectável; desligável a qualquer momento → conversa pura).
  - Chip mostrando o contexto ativo (ex.: "Cliente: ACME"), com X para remover.
  - Lista de mensagens (reaproveita estilo Markdown atual).
  - Input com envio por Enter.
  - Botão "Abrir conversa completa" → navega para `/oraculo?conversa=<id>`.
  - Botão "Nova conversa".

### Hook `useOraculoContext()`
Detecta a rota atual e monta um objeto de contexto:
- `/clientes/:id` → busca nome do cliente e contrato ativo.
- `/projetos` + projeto selecionado → nome, etapa.
- `/reunioes` ou detalhe → reunião + cliente.
- Outras rotas → sem contexto.

### Página `/oraculo`
- Item no menu (admin + consultor) com ícone `Sparkles`/oráculo.
- Layout duas colunas:
  - Esquerda (260px): lista de conversas do usuário (`oraculo_conversas`), botão "Nova".
  - Direita: mesma UI de chat do flutuante, em tela cheia.
- Permite retomar/renomear/excluir conversas.

### Configurações (admin)
- Aba "Oráculo": botão "Sincronizar base do Notion agora", contador de documentos, data da última sync, lista resumida.

## 3. Comportamento "misto" do contexto
- Toggle por conversa: o contexto da página é capturado **no momento do envio** da mensagem e fica registrado em `contexto_origem` da conversa.
- Em conversas existentes, o usuário pode ligar/desligar a injeção de contexto a qualquer momento via toggle no header do chat.
- Quando desligado: prompt do sistema é o mesmo do Oráculo original.
- Quando ligado: anexa bloco "CONTEXTO DA CONSULTA ATUAL" antes da seção de referências.

## 4. Entregas (ordem)
1. Migration: `notion_documents`, `oraculo_conversas`, `oraculo_mensagens` + RLS/GRANTs.
2. Edge functions `oraculo-sync-notion` e `oraculo-chat`.
3. Solicitar `NOTION_API_KEY` via add_secret.
4. Hook `useOraculoContext`, componente `OraculoFloatingChat`, montagem no `AppLayout`.
5. Página `/oraculo` + rota + item de menu (admin e consultor).
6. Aba Oráculo em Configurações (admin) com botão de sync.
7. Rodar sync inicial e validar respostas.

## Fora do escopo
- Integração de embeddings/vector search (mantemos a busca por keywords + ilike como no Oráculo atual; pode ser evoluído depois).
- Notificações sobre novos documentos sincronizados.
- Compartilhamento de conversas entre consultores.
