## Objetivo

Transformar o score de engajamento do cliente (gerado hoje em cada análise de reunião, campo `score_cliente` / `analise_cliente`) em um sinal ativo de risco de rescisão, visível no painel do diretor.

Situação atual verificada: 76 reuniões analisadas, 72 com score de cliente, média 7,74, apenas 2 abaixo de 6. Ou seja, um alerta baseado só em "score baixo" dispararia pouquíssimo — por isso o critério inclui também **queda de tendência**, que é o sinal precoce mais útil.

## Regras do alerta (por cliente ativo)

Avaliado sobre reuniões com análise concluída:

- **Crítico** — última reunião com score < 6,0, ou média das 3 últimas < 6,5.
- **Atenção** — queda ≥ 1,5 ponto entre a média das 3 últimas e a média das 3 anteriores, mesmo com score absoluto bom (ex.: 9,0 → 7,2).
- **Atenção** — 3 reuniões seguidas em queda contínua.
- Reforço de contexto: cliente com contrato terminando em até 90 dias sobe um nível de severidade (risco de não renovação).
- Mínimo de 2 reuniões analisadas para entrar na régua; janela de análise: últimos 180 dias.

## Onde aparece

**1. Novo bloco "Risco de Churn — Engajamento" no Meu Painel** (dentro da seção de gestão, junto do Radar da Equipe)

- Lista de cards ordenada por severidade: nome do cliente, consultora responsável, score atual, seta de tendência (↓ com a variação), nº de reuniões avaliadas e data da última.
- Mini-sparkline da evolução dos últimos scores.
- Ao clicar: abre detalhamento com os critérios que caíram (participação ativa, comprometimento com ações, etc.), os pontos de melhoria da última análise e atalhos para o cliente, para registrar interação e para gerar o Balanço do Período.
- Contadores no topo: X clientes críticos / Y em atenção.

**2. Notificação proativa** — novo tipo `score_cliente_em_queda` no cron `gerar-alertas-proativos`, enviada ao diretor (e à consultora responsável), com deduplicação: no máximo 1 alerta por cliente a cada 14 dias, e auto-resolução quando uma nova reunião subir o score acima do limite.

**3. Coluna no Radar da Equipe** — cada consultora passa a exibir "clientes em risco de engajamento", conectando o indicador ao acompanhamento individual.

## Detalhes técnicos

- Sem nova tabela: o cálculo é derivado de `reunioes.score_cliente` + `analise_cliente`, cruzado com `clientes` (não arquivados, status ativo/aguardando_renovacao) e `contratos` ativos.
- Novo hook `useRiscoEngajamento.ts` com a lógica de tendência (compartilhada em util puro para reuso na edge function).
- Novo componente `src/components/painel/RiscoChurnSection.tsx`, renderizado em `MeuPainel.tsx`.
- `gerar-alertas-proativos/index.ts`: novo bloco de geração + inclusão do tipo na lista de tipos considerados no resumo diário.
- Consultoras parceiras já excluídas dos alertas de gestão (Sidenir e Cristiano) permanecem fora dos lembretes, mas seus clientes continuam contando no bloco de risco (é indicador de cliente, não de liderança) — ajusto se preferir excluí-los também.
