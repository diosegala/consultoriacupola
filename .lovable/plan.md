

## Gerenciar Prompts dos Agentes via Configurações (admin only)

### Abordagem

Mover os prompts dos 3 agentes (hoje hardcoded na edge function) para uma tabela no banco. A página Configurações ganha uma nova aba "Agentes IA" (visível apenas para admin) com 3 textareas editáveis — um por agente. A edge function passa a buscar os prompts do banco antes de chamar o Gemini.

### Alterações

#### 1. Migração SQL — tabela `agente_prompts`
- `id` uuid PK
- `tipo` text UNIQUE NOT NULL (diagnostico, okrs, briefing_cliente_oculto)
- `prompt` text NOT NULL
- `updated_at` timestamptz DEFAULT now()
- RLS: SELECT/UPDATE apenas para admin (`has_role(auth.uid(), 'admin')`)
- Seed inicial com os 3 prompts atuais via INSERT

#### 2. Edge function `agente-projeto/index.ts`
- Remover o objeto `PROMPTS` hardcoded
- Buscar o prompt da tabela `agente_prompts` filtrando por `tipo` (usando service role client)
- Fallback: se não encontrar no banco, usar prompt padrão inline

#### 3. Hook `useAgentePrompts.ts` (novo)
- `useAgentePrompts()` — lista os 3 prompts
- `useUpdateAgentePrompt()` — mutation para atualizar o texto de um prompt

#### 4. Página `Configuracoes.tsx`
- Nova aba "Agentes IA" (condicional: `isAdmin`)
- 3 cards, cada um com label (Diagnóstico / OKRs / Briefing Cliente Oculto) e um textarea grande com o prompt atual
- Botão "Salvar" por card que chama o mutation de update
- Toast de confirmação

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `agente_prompts` + seed com prompts atuais |
| `supabase/functions/agente-projeto/index.ts` | Buscar prompt do banco em vez de hardcoded |
| `src/hooks/useAgentePrompts.ts` | Criar — CRUD dos prompts |
| `src/pages/Configuracoes.tsx` | Nova aba "Agentes IA" com textareas editáveis |

