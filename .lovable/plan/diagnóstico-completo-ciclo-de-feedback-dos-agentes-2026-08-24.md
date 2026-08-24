# Diagnóstico completo + ciclo de feedback dos agentes

Dois problemas: (1) o diagnóstico para no meio de uma frase; (2) não há como o agente aprender com o que os consultores corrigem.

## Parte 1 — Diagnóstico que nunca termina truncado

O que existe hoje na função `agente-projeto`: limite de 8.000 tokens de saída e uma rotina de continuação que só funciona uma vez — a partir da segunda tentativa a sequência de mensagens fica inválida e a continuação é abandonada silenciosamente, deixando o texto pela metade. No caminho OpenAI não existe continuação nenhuma.

Correções:

1. **Corrigir a continuação encadeada** (bug real da montagem das mensagens), permitindo até 3 continuações em vez de 2, para Claude e também para o caminho OpenAI.
2. **Elevar o teto por chamada** para 16.000 tokens de saída (dentro do suportado pelo modelo), suficiente para a maior parte de um documento de 8-12 páginas em uma só passada.
3. **Detector de término**: antes de salvar, verificar se o texto terminou de fato — última linha completa, sem frase cortada, e todas as seções previstas presentes. Se faltar, dispara continuação direcionada ("faltam as seções X e Y").
4. **Aviso honesto na tela**: se mesmo após as continuações o documento parecer incompleto, o card mostra um aviso "documento pode estar incompleto" com botão **Continuar geração**, em vez de entregar como se estivesse pronto.
5. **Prompt com orçamento de extensão**: instruir explicitamente o alvo de 8-12 páginas, a lista de seções obrigatórias e a ordem, priorizando concluir todas as seções em vez de aprofundar demais as primeiras (principal causa prática do corte).

## Parte 2 — Ciclo de feedback e melhoria contínua

Três camadas, na ordem em que serão construídas.

### A. Nota + comentário no documento
Ao lado de cada documento gerado (diagnóstico, OKRs, briefing, balanço), o consultor avalia de 1 a 5 e escreve o que faltou ou sobrou, com marcadores rápidos (genérico demais, faltou dado do cliente, tom errado, seção incompleta, estrutura fora do padrão).

### B. Versão aprovada como exemplo
O consultor pode colar/marcar a versão final revisada e sinalizar **"esta é a versão aprovada"**. Documentos aprovados viram exemplos de referência: nas próximas gerações do mesmo tipo de agente, o exemplo mais recente aprovado entra no contexto como padrão de qualidade (formato, profundidade, tom) — sem copiar conteúdo do outro cliente.

### C. Diretrizes aprendidas (com aprovação do admin)
Uma rotina consolida periodicamente os feedbacks acumulados por tipo de agente e propõe um bloco curto de **"diretrizes aprendidas"** (ex.: "sempre quantificar o diagnóstico com números do questionário"). O admin vê a proposta em Configurações, edita e aprova; só então ela passa a ser anexada ao prompt do agente. Nada muda o prompt automaticamente.

Painel de admin em Configurações mostra por agente: nota média, evolução, marcadores mais frequentes, feedbacks recentes e as diretrizes ativas (editáveis/desativáveis).

## Detalhes técnicos

- **Banco**: nova tabela `agente_feedbacks` (documento_id, tipo_agente, nota 1-5, marcadores text[], comentario, user_id) e `agente_diretrizes` (tipo_agente, conteudo, status rascunho/ativa, versão, aprovado_por). Coluna `aprovado_como_exemplo boolean` + `conteudo_revisado text` em `projeto_documentos`. GRANTs explícitos + RLS: consultor lê/escreve o próprio feedback; admin/diretor leem tudo; diretrizes só admin escreve.
- **`agente-projeto`**: corrigir loop de continuação (não sobrescrever o histórico de mensagens), `max_tokens` 16000, validador de completude por seções, continuações direcionadas, injeção do exemplo aprovado mais recente e das diretrizes ativas no prompt; retornar `truncado: boolean` no payload.
- **Nova função `consolidar-feedback-agentes`** (admin): lê feedbacks desde a última consolidação, gera proposta de diretrizes via Claude e grava como rascunho.
- **Front**: bloco de avaliação nos cards de `AgentesTab.tsx`, banner de documento incompleto com botão Continuar, e nova aba "Agentes IA" em Configurações com métricas, feedbacks e gestão de diretrizes.
