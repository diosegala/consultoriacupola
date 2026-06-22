## Problema

Hoje o webhook `pipedrive-webhook` só evita duplicidade quando o `pipedrive_deal_id` do deal já existe em `clientes`. Quando o consultor renova um contrato manualmente, o cliente continua o mesmo (sem novo `deal_id`), e ao marcar o deal como Ganho no CRM o webhook cria **um cliente e um contrato duplicados**.

## Solução

Antes de criar cliente/contrato novos, o webhook verifica se já existe um cliente ativo com o mesmo nome de organização. Se existir, apenas vincula o `pipedrive_deal_id` ao cliente existente e encerra — não cria nada novo.

### Regra de match
- Nome a comparar: `org_id.name` do deal (fallback para `title`), normalizado (trim + lowercase + colapso de espaços).
- Comparação também contra `cliente_aliases` (já existe a tabela), com a mesma normalização.
- Cliente precisa ter pelo menos um `contrato` com `ativo = true` (qualquer data — sem janela de tempo).
- Empate (mais de um cliente bate): não vincula automaticamente, marca log como pendente com mensagem explicando, e devolve 200 para o Pipedrive não reenviar.

### Comportamento
1. Match único encontrado com contrato ativo:
   - Se o cliente já tem `pipedrive_deal_id`: log "deal divergente — cliente já vinculado a outro deal", não sobrescreve.
   - Se está vazio: faz `UPDATE clientes SET pipedrive_deal_id = <novo> WHERE id = <match>`.
   - Marca `webhook_logs` como processado, ligado ao `cliente_id` existente.
   - Resposta 200 com mensagem "Renovação detectada — deal vinculado ao cliente existente".
2. Nenhum match: fluxo atual (cria cliente + contrato + onboarding + atendimento + ferramentas).
3. Match ambíguo (>1): log com erro descritivo, sem criar nada.

### Onde mexer
- `supabase/functions/pipedrive-webhook/index.ts`:
  - Nova função `findExistingClienteByName(supabase, nome)` que faz duas queries (`clientes` por nome normalizado + `cliente_aliases`) e filtra por contrato ativo.
  - Inserir a checagem logo após o atual bloco "4. Check for duplicates" (passo 4.5), antes do `extractContratoData` / `INSERT cliente`.
  - Reaproveitar helpers `updateLogProcessed` / `updateLogError`.

Sem mudanças de schema, sem mudanças de UI, sem mudanças no fluxo de renovação manual.

## Validação
- Inspecionar `webhook_logs` recentes para confirmar que os casos de renovação cairiam no novo branch.
- Teste manual: simular payload de deal won cuja organização bate com um cliente ativo → esperar 200 + `pipedrive_deal_id` atualizado, sem novo contrato.
