insert into agencia.espacos (id, tipo, nome, cor, bu_id) values
  ('pessoal', 'pessoal', 'Pessoal', '#B0F90A', null),
  ('agencia', 'bu', 'Agência', '#8A8FD0', null),
  ('educacao', 'bu', 'Educação', '#5FA8C4', null),
  ('marketing', 'bu', 'Marketing', '#C9A227', null),
  ('consultoria', 'bu', 'Consultoria', '#C47A9C', null),
  ('geral', 'area', 'Geral', '#8A9990', 'agencia'),
  ('design', 'area', 'Design', '#70A979', 'agencia'),
  ('conteudo', 'area', 'Conteúdo', '#5FA8C4', 'agencia'),
  ('midia', 'area', 'Mídia', '#C9A227', 'agencia'),
  ('atendimento', 'area', 'Atendimento', '#C47A9C', 'agencia'),
  ('branding', 'area', 'Branding', '#C08457', 'agencia'),
  ('sites', 'area', 'Sites e Nutrição', '#7E8AA8', 'agencia')
on conflict (id) do update set
  tipo = excluded.tipo, nome = excluded.nome, cor = excluded.cor, bu_id = excluded.bu_id;
insert into agencia.squads (id, nome, cor, bu_id) values
  ('leadney', 'Leadney Spears', '#C47A9C', 'agencia'),
  ('rita', 'Rita Leads', '#5FA8C4', 'agencia'),
  ('michael', 'Carreta Furasquad', '#C9A227', 'agencia')
on conflict (id) do update set
  nome = excluded.nome, cor = excluded.cor, bu_id = excluded.bu_id;
insert into agencia.pessoas (id, nome, email, iniciais, funcao, area_id, papel, ativa, espaco_de_trabalho_liberado, site, bio) values
  ('giuliano', 'Giuliano Ferraz', 'giuliano.ferraz@cupola.com.br', 'GF', 'Coordenador de Design', 'design', 'admin', true, true, null, null),
  ('camila', 'Camila Gasparini', 'camila.gasparini@cupola.com.br', 'CG', 'Gerente da Agência', 'agencia', 'admin', true, false, null, null),
  ('samara', 'Samara Camargo', 'samara.camargo@cupola.com.br', 'SC', 'Gerente de Branding', 'branding', 'gestor', true, false, null, null),
  ('aline', 'Aline Borges', 'aline.borges@cupola.com.br', 'AB', 'Coordenadora de Sites e Nutrição de Leads', 'sites', 'gestor', true, true, null, null),
  ('erick', 'Erick Santana', 'erick.santana@cupola.com.br', 'ES', 'Coordenador de Conteúdo', 'conteudo', 'gestor', true, false, null, null),
  ('mariana', 'Mariana Corazza', 'mariana.corazza@cupola.com.br', 'MC', 'Coordenadora de Atendimento', 'atendimento', 'gestor', true, false, null, null),
  ('suellen', 'Suellen Moreira', 'suellen.moreira@cupola.com.br', 'SM', 'Gerente de Relacionamento', 'atendimento', 'gestor', true, false, null, null),
  ('robson', 'Robson Rosa', 'robson.rosa@cupola.com.br', 'RR', 'Analista Especialista de Mídia', 'midia', 'analista', true, false, null, null),
  ('aline-santos', 'Aline Santos', 'aline.santos@cupola.com.br', 'AS', 'Atendimento', 'atendimento', 'analista', true, false, null, null),
  ('matheus-pinheiro', 'Matheus Pinheiro', 'matheus.pinheiro@cupola.com.br', 'MP', 'Atendimento', 'atendimento', 'analista', true, false, null, null),
  ('gabrielle-xavier', 'Gabrielle Xavier', 'gabrielle.xavier@cupola.com.br', 'GX', 'Analista Junior de Design', 'design', 'analista', true, false, null, null),
  ('guilherme-faria', 'Guilherme Faria', 'guilherme.faria@cupola.com.br', 'GF', 'Relacionamento', 'atendimento', 'analista', true, false, null, null),
  ('mateus-toignal', 'Mateus Toignal', 'mateus.toignal@cupola.com.br', 'MT', 'Sites', 'sites', 'analista', true, false, null, null),
  ('julia-benatti', 'Julia Benatti', 'julia.benatti@cupola.com.br', 'JB', 'Sites', 'sites', 'analista', true, false, null, null),
  ('julia-lazzarotto', 'Julia Lazzarotto', 'julia.lazzarotto@cupola.com.br', 'JL', 'Sites', 'sites', 'analista', true, false, null, null),
  ('elainy-carmona', 'Elaíny Carmona', 'elainy.carmona@cupola.com.br', 'EC', 'Sites', 'sites', 'analista', true, false, null, null),
  ('ana-sousa', 'Ana Sousa', 'ana.sousa@cupola.com.br', 'AS', 'Conteúdo', 'conteudo', 'analista', true, false, null, null),
  ('kamila-freitas', 'Kamila Freitas', 'kamila.freitas@cupola.com.br', 'KF', 'Conteúdo', 'conteudo', 'analista', true, false, null, null),
  ('tauan-domingues', 'Tauan Domingues', 'tauan.domingues@cupola.com.br', 'TD', 'Conteúdo', 'conteudo', 'analista', true, false, null, null),
  ('dieniffer-jesus', 'Dieniffer Jesus', 'dieniffer.jesus@cupola.com.br', 'DJ', 'Conteúdo', 'conteudo', 'analista', true, false, null, null),
  ('joao-gobbi', 'João Gobbi', 'joao.gobbi@cupola.com.br', 'JG', 'Conteúdo', 'conteudo', 'analista', true, false, null, null)
on conflict (id) do update set
  nome = excluded.nome, email = excluded.email, iniciais = excluded.iniciais,
  funcao = excluded.funcao, area_id = excluded.area_id, papel = excluded.papel,
  ativa = excluded.ativa,
  espaco_de_trabalho_liberado = excluded.espaco_de_trabalho_liberado,
  site = coalesce(excluded.site, pessoas.site),
  bio  = coalesce(excluded.bio,  pessoas.bio);
update agencia.pessoas set lider_id = 'samara' where id = 'giuliano';
update agencia.pessoas set lider_id = 'camila' where id = 'samara';
update agencia.pessoas set lider_id = 'camila' where id = 'aline';
update agencia.pessoas set lider_id = 'samara' where id = 'erick';
update agencia.pessoas set lider_id = 'suellen' where id = 'mariana';
update agencia.pessoas set lider_id = 'camila' where id = 'suellen';
update agencia.pessoas set lider_id = 'camila' where id = 'robson';
update agencia.pessoas set lider_id = 'mariana' where id = 'aline-santos';
update agencia.pessoas set lider_id = 'mariana' where id = 'matheus-pinheiro';
update agencia.pessoas set lider_id = 'giuliano' where id = 'gabrielle-xavier';
update agencia.pessoas set lider_id = 'suellen' where id = 'guilherme-faria';
update agencia.pessoas set lider_id = 'aline' where id = 'mateus-toignal';
update agencia.pessoas set lider_id = 'aline' where id = 'julia-benatti';
update agencia.pessoas set lider_id = 'aline' where id = 'julia-lazzarotto';
update agencia.pessoas set lider_id = 'aline' where id = 'elainy-carmona';
update agencia.pessoas set lider_id = 'erick' where id = 'ana-sousa';
update agencia.pessoas set lider_id = 'erick' where id = 'kamila-freitas';
update agencia.pessoas set lider_id = 'erick' where id = 'tauan-domingues';
update agencia.pessoas set lider_id = 'erick' where id = 'dieniffer-jesus';
update agencia.pessoas set lider_id = 'erick' where id = 'joao-gobbi';
insert into agencia.pessoa_squads (pessoa_id, squad_id) values
  ('giuliano', 'leadney'), ('giuliano', 'rita'), ('giuliano', 'michael'),
  ('camila', 'leadney'), ('camila', 'rita'), ('camila', 'michael'),
  ('samara', 'leadney'), ('samara', 'rita'), ('samara', 'michael'),
  ('aline', 'leadney'), ('aline', 'rita'), ('aline', 'michael'),
  ('erick', 'leadney'), ('erick', 'rita'), ('erick', 'michael'),
  ('mariana', 'rita'), ('mariana', 'michael'),
  ('suellen', 'leadney'), ('robson', 'leadney'), ('gabrielle-xavier', 'leadney'),
  ('guilherme-faria', 'leadney'), ('mateus-toignal', 'leadney'),
  ('julia-benatti', 'leadney'), ('julia-lazzarotto', 'leadney'), ('kamila-freitas', 'leadney')
on conflict do nothing;
insert into agencia.agentes (id, slug, nome, resumo, descricao, glifo, espaco_id, destaque, beta, oculto, por_conta, url_externa, rota_interna, cliente_id, ordem, atalhos) values
  ('vitrine-pantera', 'vitrine-pantera', 'Vitrine Pantera', 'Cola os links dos imóveis e devolve o carrossel pronto, nas duas medidas.', 'Lê a página de cada imóvel no site da Pantera, monta o carrossel de quatro peças — a primeira com tipo, bairro, preço e características, duas de foto e o encerramento da campanha — e exporta em PNG para card e story. A arte muda sozinha entre venda e locação.', 'imagem', 'design', false, false, false, false, null, '/vitrine-pantera', 'pantera-imoveis', 3, '{}'),
  ('cards-porta8', 'cards-porta8', 'Cards Terceiros · Porta 8', 'Cola os links dos imóveis e devolve as sete peças prontas, no card e no story.', 'Lê a página de cada imóvel no site da Porta8 e monta as peças: quatro no card 1×1 — a primeira com tipo, bairro, preço e características, duas de foto sangrada e o encerramento — e três no story, com a lâmina do meio levando duas fotos. As mesmas três fotos servem aos dois formatos, e a arte muda sozinha entre venda e locação. Exporta em PNG, numerado pela ordem em que os links foram colados.', 'grade', 'design', false, false, false, false, null, '/cards-porta8', 'porta-8', 4, '{}'),
  ('carrossel-goes', 'carrossel-goes', 'Carrossel de Locação Góes', 'Cola os links dos imóveis e devolve as oito peças prontas, no card e no story.', 'Lê a página de cada imóvel no catálogo da Góes Imóveis e monta as peças: cinco no card 1×1 — a capa com tipo, preço e localização, o título com a frase e o código, quartos e metragem, três características e o encerramento — e três no story, que reaproveitam as mesmas cinco fotos. Só locação: não existe arte de venda, e o anúncio sem valor de aluguel é recusado. O título é montado a partir do anúncio; só a frase é escrita pela IA. Exporta em PNG, numerado pela ordem em que os links foram colados.', 'grade', 'design', false, false, false, false, null, '/carrossel-goes', 'goes-imoveis', 5, '{}'),
  ('formato-story', 'formato-story', 'Gerador de Formato Story', 'Sobe as peças de feed prontas e devolve os Stories, no formato exato da agência.', 'Recebe as artes de feed já aprovadas e devolve cada uma como Story 1440×2650. Para cada peça se escolhe o método: expandir a imagem, esticar só a borda, ou cortar e fechar com uma faixa da marca. A revisão fica registrada, e o corte final nunca é esquecido.', 'confere', 'design', false, false, true, false, null, '/formato-story', null, 5, '{}'),
  ('redes-jba', 'redes-jba', 'Redes JBA', 'Em construção.', 'A instrução deste agente ainda vai ser escrita.', 'linhas', 'design', false, false, true, false, null, null, 'jba', null, '{}'),
  ('imagens-planejamento', 'imagens-planejamento', 'Imagens Planejamento', 'Em construção.', 'A instrução deste agente ainda vai ser escrita.', 'livro', 'design', false, false, true, false, null, null, null, null, '{}'),
  ('shooting', 'shooting', 'Shooting', 'Em construção.', 'A instrução deste agente ainda vai ser escrita.', 'imagem', 'design', false, false, true, false, null, null, null, null, '{}'),
  ('conteudo-para-redes', 'conteudo-para-redes', 'Conteúdo de Redes', 'O mês de posts de uma conta, do briefing ao retorno do cliente.', 'O agente do time de Conteúdo, que morava fora do CupolaOS e voltou para casa. Quem escreve monta o briefing do mês — objetivo, datas comemorativas e palavras-chave —, a IA propõe vinte temas com a justificativa de cada um, e o que for escolhido vira legenda, texto de arte e stories, em card ou carrossel. Tudo é editável, e o que o cliente respondeu fica registrado no post a que ele respondeu. O perfil da conta não se digita: vem da ficha, a mesma que o Criador de Blog lê.', 'linhas', 'conteudo', false, false, false, true, null, '/redes-conteudo', null, 0, '{}'),
  ('linha-editorial', 'linha-editorial', 'Linha Editorial', 'Define sobre o que a conta fala, com que voz e em que proporção.', 'Cruza posicionamento, público e o que o mercado está discutindo, e devolve os pilares de conteúdo com proporção sugerida por canal — o documento que evita o feed virar colcha de retalhos.', 'orbita', 'conteudo', false, false, true, false, null, null, null, null, array['Pilares de conteúdo da Incorpore', 'Revisar a proporção do último trimestre']),
  ('materiais-e-documentos', 'materiais-e-documentos', 'Materiais e Documentos', 'Escreve material rico: e-book, guia, one-pager, apresentação escrita.', 'Pega o que já existe — pesquisa, ata, dado de mercado — e transforma em documento fechado, com sumário, argumento e chamada para ação no fim.', 'livro', 'conteudo', false, false, true, false, null, null, null, null, array['Guia do comprador de primeiro imóvel', 'One-pager do empreendimento']),
  ('design-system-web', 'design-system-web', 'Design System Web', 'A biblioteca de interface do site: componentes, estados e comportamento.', 'Traduz a linha gráfica para a web — grid, breakpoints, estados de componente, comportamento de formulário. É o irmão do Design System, do lado de quem constrói a página.', 'grade', 'sites', false, false, true, false, null, null, null, null, array['Componentes da landing do Aurora', 'Padrão de formulário e validação']),
  ('landing-pages', 'landing-pages', 'Landing Pages', 'Estrutura a página de conversão: seções, argumento e formulário.', 'Monta a landing na ordem em que o argumento convence — promessa, prova, objeção, chamada — já pensando no que o formulário precisa capturar para a nutrição depois.', 'confere', 'sites', false, false, true, false, null, null, null, null, array['Landing de lançamento do Aurora', 'Página de captação para plantão']),
  ('arquitetura-de-site', 'arquitetura-de-site', 'Arquitetura de Site', 'Desenha o site inteiro: páginas, hierarquia e o que cada uma precisa entregar.', 'Define o mapa do site e o conteúdo mínimo de cada página, com a lógica de navegação e o que precisa estar a um clique da home. Serve tanto para site novo quanto para reforma.', 'orbita', 'sites', false, false, true, false, null, null, null, null, array['Mapa do site da Biguaçu', 'Reorganizar a área de empreendimentos']),
  ('fluxos-de-nutricao', 'fluxos-de-nutricao', 'Fluxos de Nutrição', 'Monta a régua de e-mails por segmento, com gatilho, espera e saída.', 'Escreve a sequência para cada segmento de lead — quem baixou material, quem visitou o plantão, quem sumiu — com o gatilho de entrada, o intervalo entre mensagens e a condição de saída. Sem condição de saída, régua vira perseguição.', 'relogio', 'sites', false, false, true, false, null, null, null, null, array['Régua para quem baixou o guia', 'Reengajar lead parado há 60 dias']),
  ('criador-de-briefing', 'criador-de-briefing', 'Briefing', 'Transforma conversa solta com o cliente em briefing que a equipe consegue executar.', 'Recebe a ata ou o áudio da reunião e devolve o briefing estruturado: objetivo, público, entregáveis, prazo e o que ficou pendente de decisão. O que não foi dito aparece como pergunta, não como suposição.', 'confere', 'atendimento', false, false, true, false, null, null, null, null, array['Briefing da campanha de lançamento', 'O que ficou pendente na última reunião']),
  ('esteira-de-tarefas', 'esteira-de-tarefas', 'Esteira de Tarefas', 'Quebra o briefing aprovado na sequência de tarefas, com responsável e prazo.', 'Pega o escopo e devolve a esteira na ordem de dependência — o que trava o quê — com estimativa de horas por etapa. É o formato que entra no Runrun.it quando a integração existir.', 'terminal', 'atendimento', false, false, true, false, null, null, null, null, array['Esteira da campanha de setembro', 'Quebrar o escopo do site em etapas']),
  ('roteiro-de-onboarding', 'roteiro-de-onboarding', 'Roteiro de Onboarding', 'O passo a passo dos primeiros 30 dias de uma conta nova.', 'Monta o roteiro de entrada do cliente: o que perguntar na primeira reunião, o que coletar, o que entregar em cada semana e quando a conta passa a rodar no ritmo normal.', 'relogio', 'atendimento', false, false, true, false, null, null, null, null, array['Onboarding da conta nova', 'Checklist da primeira reunião']),
  ('cupolaos', 'cupolaos', 'CupolaOS', 'O mercado imobiliário e a casa — para o que ainda não tem agente próprio.', 'Você conhece o mercado imobiliário por dentro: incorporação, lançamento, corretagem, produto, região, concorrência e o jeito da CUPOLA trabalhar. Atende o que aparecer, e quando o pedido for claramente de uma área com agente próprio, diz qual é em vez de tentar substituí-lo.', 'linhas', 'geral', false, false, false, false, null, null, null, null, '{}'),
  ('script-drive', 'script-drive', 'Script Drive', 'Cria pastas no Google Drive. Abre fora do CupolaOS.', 'Rotina do Google Apps Script da CUPOLA, hospedada fora daqui.', 'linhas', 'geral', false, false, false, false, 'https://script.google.com/a/macros/cupola.com.br/s/AKfycbzuADlk0AIApYR9OnzSLoEsGZvbaqMGfFylXPZTp98-fhwdG6VO4cJAzVI-1_iasOyx/exec', null, null, null, '{}'),
  ('linha-grafica', 'linha-grafica', 'Linha Gráfica', 'Lê o manual da marca e responde o que pode e o que não pode.', 'Conhece os manuais de marca dos clientes e da própria CUPOLA, e responde dúvidas de aplicação com a regra na mão.', 'grade', 'branding', false, false, true, false, null, null, null, null, array['O verde da CUPOLA pode ir em texto corrido?', 'Qual a área de respiro do logo da Incorpore?']),
  ('criador-de-post-news', 'criador-de-post-news', 'Criador de Blog', 'Escreve o post de blog em nove passos, com a redatora editando entre um e outro.', 'O agente do time de Sites e Nutrição, que morava fora do CupolaOS e voltou para casa. A pessoa escreve o briefing, a palavra-chave e as fontes; a IA propõe a estrutura de títulos, a introdução, o desenvolvimento, a FAQ, o encerramento com CTA e os metadados de SEO. Entre um passo e outro tudo é editável, e o texto final volta do Google Docs colado no passo 9. O perfil do cliente não se digita: vem da ficha da conta.', 'linhas', 'sites', false, false, false, true, null, '/criador-de-blog', null, 1, '{}'),
  ('redes-sociais', 'redes-sociais', 'Redes JBA Design', 'Sobe o planejamento em .md e ele devolve o mês diagramado, com as fotos geradas.', 'O planejamento do mês entra como um arquivo .md e sai como peça pronta. A IA quebra o texto em linhas de arte e escreve o pedido da foto com a área de leitura já reservada; o motor de imagem gera duas opções por peça; e a tipografia, o gradiente e o logo são compostos aqui, no pixel, com a fonte e a paleta da marca. Ajustar texto, posição, corpo e véu não custa crédito — só a foto custa.', 'mosaico', 'design', false, false, false, true, null, '/redes-sociais', null, 0, '{}'),
  ('posts-imoveis-terceiros', 'posts-imoveis-terceiros', 'Posts Imóveis de terceiros', 'Monta os cards de post para imóvel de terceiro. Abre fora do CupolaOS.', 'Ferramenta do time de Design, hospedada fora daqui.', 'grade', 'design', false, false, true, false, 'https://gerador-de-cards.lovable.app', null, null, null, '{}'),
  ('dia-f-franciosi', 'dia-f-franciosi', 'Dia F Franciosi', 'Cola os links dos imóveis e devolve os cards prontos, nos três formatos.', 'Ferramenta da campanha Dia F da Franciosi. Lê a página de cada imóvel, preenche tipologia, bairro, preço e características na arte aprovada, e exporta em PNG para feed, story e quadrado.', 'filme', 'design', false, false, false, false, null, '/cards-dia-f', 'franciosi-imoveis', 1, '{}'),
  ('franciosi-padrao', 'franciosi-padrao', 'Anúncios Franciosi', 'Cola os links em duas listas — alto e médio padrão — e devolve o feed e o story.', 'Lê a página de cada imóvel no site da Franciosi e monta as peças de venda: o feed em mosaico de três fotos e o story com as três empilhadas. A arte muda com o padrão do imóvel, e quem decide é a lista em que o link foi colado — não há nada no anúncio que separe um do outro. Exporta em PNG, numerado pela ordem dos links.', 'mosaico', 'design', false, false, false, false, null, '/franciosi-padrao', 'franciosi-imoveis', 2, '{}'),
  ('espaco-de-trabalho', 'espaco-de-trabalho', 'Espaço de trabalho', 'Executa comandos e edita arquivos no ambiente da equipe.', 'Agente autônomo com acesso a terminal e arquivos. Em teste, liberado pessoa a pessoa pela administração.', 'terminal', 'design', false, true, true, false, null, null, null, null, array['Organizar a pasta de entregas de agosto', 'Renomear os arquivos no padrão da agência'])
on conflict (id) do update set
  slug = excluded.slug, resumo = excluded.resumo,
  descricao = excluded.descricao, glifo = excluded.glifo,
  espaco_id = excluded.espaco_id, destaque = excluded.destaque,
  beta = excluded.beta, oculto = excluded.oculto, por_conta = excluded.por_conta,
  url_externa = excluded.url_externa,
  rota_interna = excluded.rota_interna, cliente_id = excluded.cliente_id,
  ordem = excluded.ordem,
  atalhos = excluded.atalhos;
update agencia.agentes set nome = 'Conteúdo de Redes' where id = 'conteudo-para-redes';
insert into agencia.acessos_agente (agente_id, espaco_id) values
  ('criador-de-post-news', 'sites'),
  ('fluxos-de-nutricao', 'sites'),
  ('criador-de-briefing', 'atendimento'),
  ('dia-f-franciosi', 'conteudo'),
  ('dia-f-franciosi', 'atendimento'),
  ('cards-porta8', 'conteudo'),
  ('cards-porta8', 'atendimento'),
  ('carrossel-goes', 'conteudo'),
  ('carrossel-goes', 'atendimento'),
  ('vitrine-pantera', 'conteudo'),
  ('vitrine-pantera', 'atendimento'),
  ('franciosi-padrao', 'conteudo'),
  ('franciosi-padrao', 'atendimento'),
  ('redes-sociais', 'conteudo'),
  ('redes-sociais', 'atendimento')
on conflict (agente_id, espaco_id) do nothing;
insert into agencia.fontes_mercado (id, nome, descricao, cadencia, automatica, da_casa, url, feed, regioes_padrao, temas_padrao) values
  ('imobi-report', 'Imobi Report', 'Newsletter diária da CUPOLA sobre o mercado imobiliário brasileiro. Fonte primária desta camada — sai todo dia útil e já vem curada.', 'diaria', true, true, 'https://imobireport.com.br/', 'https://imobireport.com.br/feed/', array['Nacional'], array['mercado imobiliário']),
  ('portal-loft', 'Portal Loft', 'Conteúdo do Loft para corretor e imobiliária: operação, comissão, CRM e o que muda na rotina de venda.', 'semanal', true, false, 'https://portal.loft.com.br/', 'https://portal.loft.com.br/feed/', array['Nacional'], array['operação imobiliária']),
  ('secovi-pr', 'SECOVI-PR', 'Sindicato da habitação do Paraná. Dado e posição setorial da praça onde a JBA opera.', 'eventual', true, false, 'https://secovipr.com.br/', 'https://secovipr.com.br/feed/', array['PR'], array['setor imobiliário']),
  ('brain', 'Brain Inteligência Estratégica', 'Parceria de dados. Estudos de demanda, absorção e perfil de comprador, com recorte por praça.', 'mensal', false, false, 'https://brain.srv.br/conteudos', null, '{}', '{}'),
  ('datazap', 'DataZap', 'Índices de preço e oferta do grupo OLX. Série histórica por cidade — a base de comparação quando alguém pergunta se subiu ou caiu.', 'mensal', false, false, 'https://imoveis.grupoolx.com.br/datazap', null, '{}', '{}'),
  ('modo-aviao', 'Modo Avião', 'Podcast da CUPOLA. Entrevistas com operadores do mercado — leitura qualitativa, não dado.', 'semanal', false, true, '#', null, '{}', '{}'),
  ('oficial', 'Fontes oficiais e imprensa', 'Bancos centrais, entidades setoriais e imprensa especializada. Entra por busca, sempre com a fonte registrada junto.', 'eventual', false, false, null, null, '{}', '{}')
on conflict (id) do update set
  nome = excluded.nome, descricao = excluded.descricao,
  cadencia = excluded.cadencia, automatica = excluded.automatica,
  da_casa = excluded.da_casa, url = excluded.url, feed = excluded.feed;
insert into agencia.acessos_funcionalidade (pessoa_id, funcionalidade, nivel) values
  ('giuliano', 'agentes', 'escrita'), ('giuliano', 'skills', 'leitura'), ('giuliano', 'mercado', 'leitura'), ('giuliano', 'projetos', 'escrita'), ('giuliano', 'crons', 'escrita'), ('giuliano', 'clientes', 'escrita'), ('giuliano', 'produtos', 'escrita'), ('giuliano', 'admin', 'admin'),
  ('camila', 'agentes', 'escrita'), ('camila', 'skills', 'leitura'), ('camila', 'mercado', 'leitura'), ('camila', 'projetos', 'escrita'), ('camila', 'crons', 'escrita'), ('camila', 'clientes', 'escrita'), ('camila', 'produtos', 'escrita'), ('camila', 'admin', 'admin'),
  ('samara', 'agentes', 'escrita'), ('samara', 'skills', 'escrita'), ('samara', 'mercado', 'leitura'), ('samara', 'projetos', 'escrita'), ('samara', 'crons', 'escrita'), ('samara', 'clientes', 'escrita'), ('samara', 'produtos', 'escrita'), ('samara', 'admin', 'admin'),
  ('aline', 'agentes', 'escrita'), ('aline', 'skills', 'leitura'), ('aline', 'mercado', 'leitura'), ('aline', 'projetos', 'escrita'), ('aline', 'crons', 'escrita'), ('aline', 'clientes', 'escrita'), ('aline', 'produtos', 'escrita'), ('aline', 'admin', 'admin'),
  ('erick', 'agentes', 'escrita'), ('erick', 'skills', 'escrita'), ('erick', 'mercado', 'escrita'), ('erick', 'projetos', 'escrita'), ('erick', 'crons', 'escrita'), ('erick', 'clientes', 'escrita'), ('erick', 'produtos', 'escrita'), ('erick', 'admin', 'admin'),
  ('mariana', 'agentes', 'escrita'), ('mariana', 'skills', 'leitura'), ('mariana', 'mercado', 'leitura'), ('mariana', 'projetos', 'escrita'), ('mariana', 'crons', 'escrita'), ('mariana', 'clientes', 'escrita'), ('mariana', 'produtos', 'escrita'), ('mariana', 'admin', 'admin'),
  ('suellen', 'agentes', 'escrita'), ('suellen', 'skills', 'leitura'), ('suellen', 'mercado', 'leitura'), ('suellen', 'projetos', 'escrita'), ('suellen', 'crons', 'escrita'), ('suellen', 'clientes', 'escrita'), ('suellen', 'produtos', 'escrita'), ('suellen', 'admin', 'admin'),
  ('robson', 'agentes', 'escrita'), ('robson', 'skills', 'leitura'), ('robson', 'mercado', 'leitura'), ('robson', 'projetos', 'escrita'), ('robson', 'crons', 'leitura'), ('robson', 'clientes', 'leitura'), ('robson', 'produtos', 'leitura'), ('robson', 'admin', 'admin'),
  ('aline-santos', 'agentes', 'escrita'), ('aline-santos', 'skills', 'leitura'), ('aline-santos', 'mercado', 'leitura'), ('aline-santos', 'projetos', 'escrita'), ('aline-santos', 'crons', 'leitura'), ('aline-santos', 'clientes', 'escrita'), ('aline-santos', 'produtos', 'leitura'), ('aline-santos', 'admin', 'admin'),
  ('matheus-pinheiro', 'agentes', 'escrita'), ('matheus-pinheiro', 'skills', 'leitura'), ('matheus-pinheiro', 'mercado', 'leitura'), ('matheus-pinheiro', 'projetos', 'escrita'), ('matheus-pinheiro', 'crons', 'leitura'), ('matheus-pinheiro', 'clientes', 'escrita'), ('matheus-pinheiro', 'produtos', 'leitura'), ('matheus-pinheiro', 'admin', 'admin'),
  ('gabrielle-xavier', 'agentes', 'escrita'), ('gabrielle-xavier', 'skills', 'leitura'), ('gabrielle-xavier', 'mercado', 'leitura'), ('gabrielle-xavier', 'projetos', 'escrita'), ('gabrielle-xavier', 'crons', 'leitura'), ('gabrielle-xavier', 'clientes', 'leitura'), ('gabrielle-xavier', 'produtos', 'leitura'), ('gabrielle-xavier', 'admin', 'admin'),
  ('guilherme-faria', 'agentes', 'escrita'), ('guilherme-faria', 'skills', 'leitura'), ('guilherme-faria', 'mercado', 'leitura'), ('guilherme-faria', 'projetos', 'escrita'), ('guilherme-faria', 'crons', 'leitura'), ('guilherme-faria', 'clientes', 'escrita'), ('guilherme-faria', 'produtos', 'leitura'), ('guilherme-faria', 'admin', 'admin'),
  ('mateus-toignal', 'agentes', 'escrita'), ('mateus-toignal', 'skills', 'leitura'), ('mateus-toignal', 'mercado', 'leitura'), ('mateus-toignal', 'projetos', 'escrita'), ('mateus-toignal', 'crons', 'leitura'), ('mateus-toignal', 'clientes', 'leitura'), ('mateus-toignal', 'produtos', 'leitura'), ('mateus-toignal', 'admin', 'admin'),
  ('julia-benatti', 'agentes', 'escrita'), ('julia-benatti', 'skills', 'leitura'), ('julia-benatti', 'mercado', 'leitura'), ('julia-benatti', 'projetos', 'escrita'), ('julia-benatti', 'crons', 'leitura'), ('julia-benatti', 'clientes', 'leitura'), ('julia-benatti', 'produtos', 'leitura'), ('julia-benatti', 'admin', 'admin'),
  ('julia-lazzarotto', 'agentes', 'escrita'), ('julia-lazzarotto', 'skills', 'leitura'), ('julia-lazzarotto', 'mercado', 'leitura'), ('julia-lazzarotto', 'projetos', 'escrita'), ('julia-lazzarotto', 'crons', 'leitura'), ('julia-lazzarotto', 'clientes', 'leitura'), ('julia-lazzarotto', 'produtos', 'leitura'), ('julia-lazzarotto', 'admin', 'admin'),
  ('elainy-carmona', 'agentes', 'escrita'), ('elainy-carmona', 'skills', 'leitura'), ('elainy-carmona', 'mercado', 'leitura'), ('elainy-carmona', 'projetos', 'escrita'), ('elainy-carmona', 'crons', 'leitura'), ('elainy-carmona', 'clientes', 'leitura'), ('elainy-carmona', 'produtos', 'leitura'), ('elainy-carmona', 'admin', 'admin'),
  ('ana-sousa', 'agentes', 'escrita'), ('ana-sousa', 'skills', 'leitura'), ('ana-sousa', 'mercado', 'leitura'), ('ana-sousa', 'projetos', 'escrita'), ('ana-sousa', 'crons', 'leitura'), ('ana-sousa', 'clientes', 'leitura'), ('ana-sousa', 'produtos', 'leitura'), ('ana-sousa', 'admin', 'admin'),
  ('kamila-freitas', 'agentes', 'escrita'), ('kamila-freitas', 'skills', 'leitura'), ('kamila-freitas', 'mercado', 'leitura'), ('kamila-freitas', 'projetos', 'escrita'), ('kamila-freitas', 'crons', 'leitura'), ('kamila-freitas', 'clientes', 'leitura'), ('kamila-freitas', 'produtos', 'leitura'), ('kamila-freitas', 'admin', 'admin'),
  ('tauan-domingues', 'agentes', 'escrita'), ('tauan-domingues', 'skills', 'leitura'), ('tauan-domingues', 'mercado', 'leitura'), ('tauan-domingues', 'projetos', 'escrita'), ('tauan-domingues', 'crons', 'leitura'), ('tauan-domingues', 'clientes', 'leitura'), ('tauan-domingues', 'produtos', 'leitura'), ('tauan-domingues', 'admin', 'admin'),
  ('dieniffer-jesus', 'agentes', 'escrita'), ('dieniffer-jesus', 'skills', 'leitura'), ('dieniffer-jesus', 'mercado', 'leitura'), ('dieniffer-jesus', 'projetos', 'escrita'), ('dieniffer-jesus', 'crons', 'leitura'), ('dieniffer-jesus', 'clientes', 'leitura'), ('dieniffer-jesus', 'produtos', 'leitura'), ('dieniffer-jesus', 'admin', 'admin'),
  ('joao-gobbi', 'agentes', 'escrita'), ('joao-gobbi', 'skills', 'leitura'), ('joao-gobbi', 'mercado', 'leitura'), ('joao-gobbi', 'projetos', 'escrita'), ('joao-gobbi', 'crons', 'leitura'), ('joao-gobbi', 'clientes', 'leitura'), ('joao-gobbi', 'produtos', 'leitura'), ('joao-gobbi', 'admin', 'admin'),
  ('giuliano', 'gestao', 'escrita')
on conflict (pessoa_id, funcionalidade) do nothing;