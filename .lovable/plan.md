

## Diagnósticos Modelo para os Agentes de IA

### O que será feito

Adicionar na aba "Agentes IA" da página Configurações a possibilidade de cadastrar **documentos modelo** (exemplos de diagnósticos, OKRs ou briefings já produzidos) que serão anexados automaticamente ao prompt do agente como referência de estilo e conteúdo.

### Como funciona

Cada agente (Diagnóstico, OKRs, Briefing) ganha uma segunda textarea abaixo do prompt, com o label **"Documento Modelo (opcional)"**. O admin cola ali um exemplo real de diagnóstico/OKR/briefing. Quando o consultor gera um documento, a edge function inclui esse modelo no prompt como seção de referência.

### Alterações

#### 1. Migração SQL — nova coluna `documento_modelo`
- Adicionar `documento_modelo text` (nullable) na tabela `agente_prompts`

#### 2. Edge function `agente-projeto/index.ts`
- Buscar também o campo `documento_modelo` junto com `prompt`
- Se existir, adicionar ao prompt: `## Documento Modelo de Referência\n{documento_modelo}\n\nUse o documento acima como referência de estilo, tom e estrutura.`

#### 3. Hook `useAgentePrompts.ts`
- Atualizar interface `AgentePrompt` com `documento_modelo?: string`
- Atualizar mutation para aceitar `documento_modelo`

#### 4. Página `Configuracoes.tsx`
- Abaixo de cada textarea de prompt, adicionar segunda textarea com label "Documento Modelo (opcional)" e placeholder "Cole aqui um exemplo de documento já produzido para servir de referência..."
- O botão "Salvar" salva prompt + documento_modelo juntos

### Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | `ALTER TABLE agente_prompts ADD COLUMN documento_modelo text` |
| `supabase/functions/agente-projeto/index.ts` | Incluir documento_modelo no prompt |
| `src/hooks/useAgentePrompts.ts` | Atualizar tipo e mutation |
| `src/pages/Configuracoes.tsx` | Segunda textarea por agente |

