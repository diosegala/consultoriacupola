

## Transformar agentes em interface conversacional com input de contexto

### Problema atual
Os botoes de agente geram documentos automaticamente usando apenas os dados ja salvos no projeto. O usuario precisa poder fornecer suas proprias anotacoes, transcricoes e gravacoes como contexto antes de gerar.

### Solucao

Ao clicar em "Gerar Diagnostico" (ou OKRs, ou Briefing), em vez de disparar a geracao direto, abre um **dialog de input** onde o consultor pode:
- Colar anotacoes de imersao (textarea)
- Colar transcricoes de reunioes (textarea)
- Opcionalmente anexar arquivos (futuro)
- Ver que dados do projeto ja serao incluidos automaticamente (observacoes, checklist, reunioes)
- Clicar em "Gerar" so quando estiver satisfeito com o contexto

### Alteracoes

**`src/components/projetos/ProjetoDetalheSheet.tsx`**
- Substituir o onClick dos botoes de agente: em vez de chamar `gerarDocumento.mutate()` direto, abrir um novo state `agentDialog` com o tipo selecionado
- Novo dialog com:
  - Titulo: "Gerar [Diagnostico/OKRs/Briefing]"
  - Texto explicativo: "Insira as informacoes que o agente deve considerar"
  - Textarea grande para "Anotacoes / Transcricoes" (placeholder contextual por tipo)
  - Indicador de contexto automatico: "Dados do projeto (observacoes, checklist, reunioes) serao incluidos automaticamente"
  - Botao "Gerar" que envia o texto do usuario junto com o tipo

**`src/hooks/useProjetoDocumentos.ts`**
- Alterar mutation para aceitar campo opcional `contexto_usuario: string`

**`supabase/functions/agente-projeto/index.ts`**
- Aceitar campo `contexto_usuario` no body
- Concatenar o contexto fornecido pelo usuario ao contexto automatico do projeto, dando prioridade ao input do usuario no prompt

### Fluxo revisado

1. Consultor abre card do projeto
2. Clica em "Gerar Diagnostico"
3. Abre dialog com textarea para colar anotacoes/transcricoes
4. Consultor cola seu conteudo e clica "Gerar"
5. Edge function combina input do usuario + dados do projeto e envia ao Gemini
6. Resultado exibido no modal de visualizacao

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Dialog de input antes da geracao |
| `src/hooks/useProjetoDocumentos.ts` | Aceitar `contexto_usuario` |
| `supabase/functions/agente-projeto/index.ts` | Processar `contexto_usuario` |

