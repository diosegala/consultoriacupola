# Integração WhatsApp Business (API oficial da Meta)

Sim, é possível — com a WhatsApp Cloud API oficial. O plano abaixo cobre inbox completo (enviar + receber), um número por consultora, e um agente de IA que transforma as conversas em conhecimento.

## Pré-requisito externo (fora do código)

Antes de qualquer coisa funcionar de verdade, é preciso:
1. Meta Business Manager verificado (documentos da empresa; costuma levar de 1 a 5 dias).
2. Criar a WhatsApp Business Account (WABA) e cadastrar um número por consultora (cada número precisa de verificação por SMS/ligação e não pode estar ativo no app WhatsApp comum).
3. Gerar o token de sistema permanente e o token de verificação do webhook.

Enquanto isso não existe, dá para construir e testar tudo com o número de teste gratuito que a Meta fornece.

## Fase 1 — Base de dados e webhook de recebimento

- Tabelas novas: números de WhatsApp por consultora, conversas (uma por cliente/contato) e mensagens (direção, texto, mídia, status de entrega, timestamps).
- Edge function pública `whatsapp-webhook`: valida a assinatura da Meta, recebe mensagens e atualizações de status, associa o contato ao cliente pelo telefone (ou deixa como "não identificado" para vínculo manual) e grava a mensagem.
- RLS no mesmo padrão atual: consultora vê só as conversas da sua carteira; admin e diretor veem tudo.

## Fase 2 — Inbox na plataforma

- Nova página "WhatsApp": lista de conversas à esquerda, thread à direita, com envio de mensagem.
- Edge function `whatsapp-enviar`: envia pelo número da consultora logada.
- Regra da Meta que precisa aparecer na UI: fora da janela de 24h após a última mensagem do cliente, só é possível enviar template aprovado. A tela mostra o contador da janela e oferece a lista de templates quando ela expira.
- Realtime para as mensagens chegarem sem recarregar.
- Aba WhatsApp também dentro do detalhe do cliente, mostrando o histórico daquele cliente.

## Fase 3 — Agente de IA sobre as conversas

Um job (cron diário + gatilho ao fim de cada conversa) que processa as mensagens novas e:
- **Busca semântica**: gera embeddings dos trechos de conversa e grava no mesmo formato usado hoje pelas transcrições, para que a Pesquisa de Reuniões passe a responder também com base no WhatsApp (com a fonte identificada como conversa).
- **Compromissos**: extrai prazos e promessas ditos no chat e cria registros em `compromissos`, exatamente como já é feito com as transcrições de reunião.
- **Risco de churn**: calcula sentimento e responsividade (tempo de resposta do cliente, silêncio prolongado) e alimenta os alertas de engajamento existentes.

## Detalhes técnicos

- Webhook precisa ser `verify_jwt = false` no `config.toml` e validar o `X-Hub-Signature-256` com o app secret.
- Segredos novos: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_SYSTEM_TOKEN`, `WHATSAPP_WABA_ID`.
- Mídias (áudio, imagem, PDF) são baixadas pelo media id e guardadas em um bucket privado; áudios podem ser transcritos e entram na mesma indexação.
- Reaproveitamos `reunioes_chunks`/`buscar_trechos_reunioes` adicionando uma coluna de origem, em vez de criar um segundo mecanismo de busca.
- Custo Meta: cobrança por conversa iniciada pela empresa; conversas iniciadas pelo cliente nas primeiras 24h são gratuitas.

## Ordem sugerida

Fase 1 e 2 entregam valor imediato (histórico + envio). A Fase 3 depende de ter volume de mensagens gravadas, então faz sentido só depois de algumas semanas de uso.
