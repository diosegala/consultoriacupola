---
name: Ciclo de feedback e anti-truncamento dos agentes
description: Como os agentes de IA evitam truncamento e aprendem com feedback da equipe (diretrizes e exemplos aprovados)
type: feature
---
**Anti-truncamento** (`agente-projeto`): `max_tokens` 16.000, marcador `<!-- FIM_DOCUMENTO -->` na última linha, até 3 continuações encadeadas (Claude e OpenAI), documentos incompletos ficam com `projeto_documentos.truncado = true` e ganham botão "Continuar geração" (envia `continuar_documento_id`, que atualiza o documento em vez de criar novo). Prompt inclui orçamento de extensão (8-12 páginas).

**Ciclo de feedback**:
- `agente_feedbacks`: nota 1-5 + marcadores + comentário, registrada pelo consultor no painel de cada agente (`DocumentoFeedback`).
- `projeto_documentos.aprovado_como_exemplo` / `conteudo_revisado`: admin marca versão de referência; a mais recente entra no prompt como exemplo (nunca reaproveitar dados).
- `agente_diretrizes`: edge function `consolidar-feedback-agentes` (admin) transforma feedbacks não consolidados em diretrizes `rascunho`; admin aprova em Configurações > Agentes IA; diretrizes `ativa` (até 5 mais recentes) são injetadas no system prompt.
