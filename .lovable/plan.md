

## Modulo de Gestao de Consultores com Analise de Reunioes por IA

### Visao geral

Criar um sistema completo para registrar reunioes dos consultores, armazenar transcricoes e usar IA para analisar a qualidade do atendimento, gerando um score por consultor.

### Sobre a integracao com Google Drive

A integracao automatica com Google Drive requer uma configuracao OAuth customizada (nao ha conector pronto disponivel). Proponho comecar com **upload manual ou colagem de transcricoes** para ja ter o sistema funcionando, e numa segunda fase implementar a integracao com Google Drive via OAuth. Isso permite voce ja comecar a usar e avaliar o sistema.

### Fase 1 — Estrutura de dados e UI (esta implementacao)

**Novas tabelas no banco:**

1. **`reunioes`** — registro de cada reuniao
   - `id`, `consultor_id`, `cliente_id`, `data_reuniao`, `duracao_minutos`
   - `transcricao` (text, conteudo da transcricao)
   - `resumo_ia` (text, resumo gerado pela IA)
   - `score_ia` (numeric, 0-10)
   - `analise_ia` (jsonb, detalhamento da analise)
   - `google_meet_link` (text, opcional)
   - `created_at`, `updated_at`
   - RLS com `is_authorized_user()`

2. **`scores_consultor`** — score agregado por consultor (view materializada ou tabela)
   - `consultor_id`, `score_medio`, `total_reunioes_analisadas`, `ultima_atualizacao`

**Novas paginas e componentes:**

1. **Pagina de detalhe do consultor** (`/consultores/:id`)
   - Cards com metricas: clientes ativos, MRR, score medio, total de reunioes
   - Lista de reunioes com data, cliente, score e status da analise
   - Botao "Nova Reuniao" para registrar e colar/enviar transcricao

2. **Dialog de nova reuniao**
   - Selecao de cliente, data, duracao
   - Campo de texto grande para colar a transcricao OU upload de arquivo .txt/.md
   - Ao salvar, dispara analise automatica pela IA

3. **Visualizador de reuniao**
   - Transcricao completa
   - Resumo gerado pela IA
   - Score com breakdown (empatia, clareza, proatividade, dominio tecnico, etc.)

4. **Coluna de Score na tabela de consultores** (pagina existente)

**Edge function `analisar-reuniao`:**
- Recebe a transcricao
- Usa Lovable AI (Gemini) para gerar:
  - Resumo da reuniao
  - Score de 0 a 10 com criterios: empatia, clareza na comunicacao, proatividade, dominio tecnico, orientacao para resultados
  - Pontos fortes e pontos de melhoria
- Salva resultado na tabela `reunioes`

**Arquivos a criar/modificar:**

| Arquivo | Acao |
|---------|------|
| `src/pages/ConsultorDetalhe.tsx` | Criar pagina de detalhe |
| `src/components/consultor/ReunioesList.tsx` | Lista de reunioes |
| `src/components/consultor/NovaReuniaoDialog.tsx` | Dialog para registrar reuniao |
| `src/components/consultor/ReuniaoAnalise.tsx` | Visualizador de analise |
| `src/hooks/useReunioes.ts` | Hook para CRUD de reunioes |
| `src/pages/Consultores.tsx` | Adicionar link para detalhe e coluna de score |
| `src/App.tsx` | Adicionar rota `/consultores/:id` |
| `supabase/functions/analisar-reuniao/index.ts` | Edge function com IA |
| Migracao SQL | Criar tabelas `reunioes` |

### Fase 2 — Integracao Google Drive (futura)

- OAuth com Google para acessar arquivos do Drive
- Busca automatica de transcricoes do Gemini (formato padrao do Google Meet)
- Sincronizacao periodica ou por demanda

### Criterios de analise da IA (configuravel)

O agente avaliara cada transcricao nos seguintes eixos:
- **Empatia e escuta ativa** — o consultor demonstra interesse genuino?
- **Clareza na comunicacao** — explica conceitos de forma acessivel?
- **Proatividade** — traz sugestoes e antecipa problemas?
- **Dominio tecnico** — demonstra conhecimento da area?
- **Orientacao para resultados** — foca em acoes concretas e proximos passos?

Cada eixo recebe nota de 0-10, e o score final e a media ponderada.

