# Diagramar e gerar peças de redes sociais

## Objetivo
Completar a etapa visual do fluxo de redes da Agência sem depender de Firecrawl, Google Drive ou RunRun.it. A pessoa escreve a peça, gera opções de imagem, aprova uma delas, ajusta a composição e baixa os arquivos finais.

## Experiência na página de redes
- Após o texto ficar pronto, cada tema ganha a ação **Criar arte**.
- A geração da imagem usa a ficha visual da conta como regra e os materiais anexados como referência complementar.
- Serão mostradas opções de imagem para aprovação antes da diagramação; nenhuma entra automaticamente na peça.
- O editor permitirá ajustar o texto, escolher a imagem aprovada, controlar enquadramento e alternar entre composições adequadas a card ou carrossel.
- A visualização terá os formatos **feed vertical 4:5**, **quadrado 1:1** e **stories 9:16**.
- Cada slide poderá ser baixado em PNG; carrosséis também poderão ser baixados em ZIP com arquivos numerados.
- Versões geradas e aprovadas ficarão salvas na conta para continuar a edição depois.

## Identidade visual da conta
- Adicionar à conta campos para cores, fontes, logotipo e orientações visuais.
- Exibir esses campos na ficha da conta para manutenção pelo time.
- Ao criar uma arte, combinar esses valores com referências visuais já anexadas, dando prioridade ao cadastro explícito.
- Se a identidade estiver incompleta, o editor usa uma composição neutra e sinaliza os campos ausentes, sem inventar uma marca definitiva.

## Geração e armazenamento
- Usar Lovable AI para gerar imagens sem texto, com o contexto do tema e da conta; o texto será aplicado pelo editor para preservar legibilidade.
- Salvar as opções e artes finais em um bucket privado, organizadas por conta, tema e versão.
- Registrar no banco o pedido usado, formato, imagem aprovada, composição, textos editados, versão e estado de aprovação.
- Incluir o consumo da geração de imagens no painel já existente, marcado como Agência e ligado à conta e ao usuário.

## Segurança e confiabilidade
- Manter geração, credenciais e gravação no servidor.
- Restringir leitura e alteração das peças às pessoas da Agência que já podem acessar a conta.
- Preservar mensagens claras de bloqueio, créditos, moderação ou falha da geração; não aprovar nem substituir resultados automaticamente.
- Não incluir nesta entrega publicação em redes, Firecrawl, Drive ou RunRun.it.

## Verificação
- Validar card único e carrossel nos três formatos.
- Confirmar aprovação de imagem, edição, histórico, retorno à edição e downloads PNG/ZIP.
- Testar permissões do bucket e das tabelas, registro de custo, estados vazios e falhas da IA.
- Conferir a página em desktop e celular sem alterar o restante da Agência ou da Consultoria.

## Detalhes técnicos
- Evoluir `agencia.redes_conteudo_temas` e criar uma tabela de versões/arquivos visuais, com políticas equivalentes ao acesso da conta.
- Criar bucket privado específico para peças e políticas por `cliente_id` no primeiro segmento do caminho.
- Ampliar `agencia-redes` com geração de imagem pelo modelo padrão `openai/gpt-image-2.5-sunburst`, streaming e armazenamento do PNG final.
- Criar componentes focados para seleção de imagem, editor de composição, prévias por formato e exportação; manter o fluxo mensal atual intacto.
- Usar renderização no navegador para compor texto/logotipo sobre a imagem aprovada e gerar PNGs; montar o ZIP somente quando solicitado.
