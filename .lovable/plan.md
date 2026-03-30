

## Agentes de IA no Kanban de Projetos

### O que sera feito

Criar 3 agentes de IA acessiveis dentro do card de detalhe do projeto (ProjetoDetalheSheet), cada um com um botao dedicado. Os agentes usam a API do Google Gemini via edge function com a chave do usuario.

**Agentes:**
1. **Gerar Diagnostico** -- produz diagnostico do cliente com base nas observacoes/anotacoes de imersao do projeto
2. **Gerar OKRs** -- cria objetivos e resultados-chave para o cliente
3. **Gerar Briefing Cliente Oculto** -- produz briefing para a equipe de backoffice iniciar o cliente oculto

### Arquitetura

```text
ProjetoDetalheSheet
  └─ Botoes "Diagnostico" / "OKRs" / "Briefing"
       │
       ▼
  supabase.functions.invoke('agente-projeto', { tipo, contexto })
       │
       ▼
  Edge Function "agente-projeto"
       │  (prompts especificos por tipo)
       ▼
  Google Gemini API (chave do usuario)
       │
       ▼
  Retorna documento gerado → salvo na tabela projeto_documentos
```

### Alteracoes

#### 1. Secret: GOOGLE_GEMINI_API_KEY
- Solicitar ao usuario a chave da API do Google via `add_secret`

#### 2. Banco de dados (migracao)
Nova tabela `projeto_documentos`:
- `id` uuid PK
- `projeto_id` uuid NOT NULL
- `tipo` text NOT NULL (diagnostico, okrs, briefing_cliente_oculto)
- `conteudo` text NOT NULL (markdown gerado pela IA)
- `created_at` timestamptz
- `created_by` uuid (user_id)
- RLS: mesmas politicas dos projetos (authorized_user OR consultor do projeto)

#### 3. Edge function `agente-projeto/index.ts` (nova)
- Recebe `{ tipo, projeto_id }`
- Busca contexto do projeto: observacoes, cliente (nome, cidade, uf), reunioes, checklist
- Seleciona prompt especializado por tipo:
  - **diagnostico**: analisa anotacoes de imersao, identifica problemas, oportunidades, prioridades
  - **okrs**: gera objetivos e key results baseados no contexto do cliente
  - **briefing_cliente_oculto**: gera briefing estruturado para equipe de backoffice
- Chama Google Gemini API (`generativelanguage.googleapis.com`) com a GOOGLE_GEMINI_API_KEY
- Salva resultado em `projeto_documentos`
- Retorna o conteudo gerado

#### 4. Hook `useProjetoDocumentos.ts` (novo)
- `useProjetoDocumentos(projetoId)` -- lista documentos do projeto
- `useGerarDocumento()` -- mutation que invoca a edge function

#### 5. UI: `ProjetoDetalheSheet.tsx`
- Adicionar secao "Agentes IA" com 3 botoes (icones: FileText, Target, ClipboardList)
- Ao clicar, chama a edge function e mostra loading
- Resultado exibido em um dialog/modal com o conteudo em markdown renderizado
- Lista de documentos ja gerados abaixo dos botoes, com data e tipo
- Botao para re-gerar (sobrescreve ou cria novo)

### Fluxo do usuario

1. Abre o card do projeto no Kanban
2. Ve secao "Agentes IA" com 3 botoes
3. Clica em "Gerar Diagnostico" → loading → resultado aparece em modal
4. Documento fica salvo e acessivel na lista do card
5. Pode gerar novamente ou gerar outros tipos

### Arquivos

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `projeto_documentos` com RLS |
| `supabase/functions/agente-projeto/index.ts` | Criar -- edge function com 3 prompts |
| `src/hooks/useProjetoDocumentos.ts` | Criar -- hook para documentos |
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Editar -- adicionar botoes e modal de resultado |

