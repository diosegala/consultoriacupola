

## Adicionar OpenAI como provedor alternativo nos agentes

### Contexto
GPTs customizados não possuem API externa. A solução é usar a API Chat Completions da OpenAI com as mesmas instruções e documentos modelo que o usuário já configurou no builder de GPTs.

### O que muda

#### 1. Migração SQL — novo campo `provedor` na tabela `agente_prompts`
- Adicionar coluna `provedor text NOT NULL DEFAULT 'gemini'`
- Valores aceitos: `gemini`, `openai`

#### 2. Edge function `agente-projeto/index.ts`
- Ler o campo `provedor` do prompt
- Se `openai`: chamar `https://api.openai.com/v1/chat/completions` com modelo `gpt-4o` usando a chave `OPENAI_API_KEY`
- Se `gemini`: manter comportamento atual
- Fallback entre provedores se um falhar

#### 3. Secret `OPENAI_API_KEY`
- Solicitar ao usuário sua API key da OpenAI (não é a mesma do ChatGPT Plus — é obtida em platform.openai.com)

#### 4. UI — Configurações > Agentes IA
- Adicionar um seletor (Select) em cada card de agente: "Provedor de IA" com opções Gemini / OpenAI
- O seletor é salvo junto com o prompt

### Fluxo do usuário
1. Acesse Configurações > Agentes IA
2. No agente "Diagnóstico", selecione "OpenAI" como provedor
3. Cole as instruções do seu GPT no campo Prompt
4. Cole documentos de referência no campo Documento Modelo
5. Salve — a partir de agora o agente usa a OpenAI

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | `ALTER TABLE agente_prompts ADD COLUMN provedor text NOT NULL DEFAULT 'gemini'` |
| `supabase/functions/agente-projeto/index.ts` | Branch condicional Gemini vs OpenAI |
| `src/hooks/useAgentePrompts.ts` | Incluir campo `provedor` |
| `src/pages/Configuracoes.tsx` | Select de provedor por agente |

