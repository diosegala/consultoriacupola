create schema if not exists agencia;
create extension if not exists pgcrypto;
create table if not exists agencia.espacos (
  id     text primary key,
  tipo   text not null check (tipo in ('pessoal', 'area', 'bu')),
  nome   text not null,
  cor    text not null,
  bu_id  text references agencia.espacos (id),
  constraint area_tem_bu check (
    (tipo = 'area' and bu_id is not null) or (tipo <> 'area' and bu_id is null)
  )
);
create table if not exists agencia.squads (
  id     text primary key,
  nome   text not null,
  cor    text not null,
  bu_id  text not null references agencia.espacos (id)
);
create table if not exists agencia.pessoas (
  id       text primary key,
  auth_id  uuid unique references auth.users (id) on delete set null,
  nome     text not null,
  email    text not null unique,
  iniciais text not null,
  funcao   text not null,
  area_id  text not null references agencia.espacos (id),
  lider_id text references agencia.pessoas (id),
  papel    text not null check (papel in ('analista', 'gestor', 'admin')),
  ativa    boolean not null default true,
  espaco_de_trabalho_liberado boolean not null default false,
  site     text,
  bio      text,
  constraint email_do_dominio check (email ~ '^[^@]+@cupola\.com\.br$')
);
create index if not exists pessoas_area_idx  on agencia.pessoas (area_id);
create index if not exists pessoas_lider_idx on agencia.pessoas (lider_id);
create table if not exists agencia.pessoa_squads (
  pessoa_id text not null references agencia.pessoas (id) on delete cascade,
  squad_id  text not null references agencia.squads (id)  on delete cascade,
  primary key (pessoa_id, squad_id)
);
create table if not exists agencia.acessos_funcionalidade (
  pessoa_id      text not null references agencia.pessoas (id) on delete cascade,
  funcionalidade text not null check (funcionalidade in (
    'clientes', 'produtos', 'projetos', 'agentes', 'skills', 'mercado', 'crons',
    'meu-dia', 'gestao', 'admin'
  )),
  nivel          text not null check (
    nivel in ('sem-acesso', 'leitura', 'escrita', 'admin')
  ),
  primary key (pessoa_id, funcionalidade)
);
create table if not exists agencia.clientes (
  id     text primary key,
  slug   text not null unique,
  nome   text not null,
  sigla  text not null,
  tipo   text not null check (tipo in ('imobiliaria', 'incorporadora', 'servicos')),
  cidade text not null,
  cor    text not null,
  desde  date not null,
  resumo text not null default ''
);
create table if not exists agencia.squad_clientes (
  squad_id   text not null references agencia.squads (id)   on delete cascade,
  cliente_id text not null references agencia.clientes (id) on delete cascade,
  primary key (squad_id, cliente_id),
  unique (cliente_id)
);
create table if not exists agencia.acessos_cliente (
  pessoa_id  text not null references agencia.pessoas (id)  on delete cascade,
  cliente_id text not null references agencia.clientes (id) on delete cascade,
  nivel      text not null check (
    nivel in ('sem-acesso', 'leitura', 'escrita', 'admin')
  ),
  primary key (pessoa_id, cliente_id)
);
create table if not exists agencia.contratos (
  cliente_id   text primary key references agencia.clientes (id) on delete cascade,
  status       text not null check (status in ('ativo', 'renovacao', 'encerrado')),
  modalidade   text not null,
  inicio       date not null,
  renovacao    date not null,
  horas_mes    integer,
  horas_usadas integer,
  escopo       text[] not null default '{}',
  responsavel  text not null
);
create table if not exists agencia.okrs (
  id         text primary key,
  cliente_id text not null references agencia.clientes (id) on delete cascade,
  objetivo   text not null,
  trimestre  text not null
);
create table if not exists agencia.resultados_chave (
  id        bigserial primary key,
  okr_id    text not null references agencia.okrs (id) on delete cascade,
  ordem     integer not null default 0,
  descricao text not null,
  atual     numeric not null,
  meta      numeric not null,
  unidade   text not null
);
create table if not exists agencia.entregaveis (
  id             text primary key,
  cliente_id     text not null references agencia.clientes (id) on delete cascade,
  nome           text not null,
  status         text not null check (
    status in ('planejado', 'em-producao', 'em-aprovacao', 'entregue', 'atrasado')
  ),
  prazo          date not null,
  responsavel_id text references agencia.pessoas (id),
  area_id        text references agencia.espacos (id)
);
create table if not exists agencia.demandas (
  id             text primary key,
  cliente_id     text not null references agencia.clientes (id) on delete cascade,
  titulo         text not null,
  etapa          text not null check (
    etapa in ('briefing', 'producao', 'revisao', 'aprovacao', 'publicado')
  ),
  responsavel_id text references agencia.pessoas (id),
  prazo          date not null,
  urgente        boolean not null default false
);
create table if not exists agencia.documentos (
  id            text primary key,
  cliente_id    text not null references agencia.clientes (id) on delete cascade,
  tipo          text not null check (
    tipo in ('brandbook', 'identidade', 'planejamento', 'site',
             'instagram', 'drive', 'contrato', 'leitura')
  ),
  nome          text not null,
  url           text not null,
  atualizado_em date,
  validade_dias integer
);
create table if not exists agencia.projetos (
  id            text primary key,
  slug          text not null unique,
  nome          text not null,
  cliente_id    text not null references agencia.clientes (id),
  status        text not null check (status in ('ativo', 'pausado', 'concluido')),
  resumo        text not null default '',
  contexto      text not null default '',
  espaco_id     text not null references agencia.espacos (id),
  criado_por_id text not null references agencia.pessoas (id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table if not exists agencia.projeto_squads (
  projeto_id text not null references agencia.projetos (id) on delete cascade,
  squad_id   text not null references agencia.squads (id)   on delete cascade,
  primary key (projeto_id, squad_id)
);
create table if not exists agencia.projeto_pessoas (
  projeto_id text not null references agencia.projetos (id) on delete cascade,
  pessoa_id  text not null references agencia.pessoas (id)  on delete cascade,
  primary key (projeto_id, pessoa_id)
);
create table if not exists agencia.regras (
  id         text primary key,
  cliente_id text references agencia.clientes (id) on delete cascade,
  projeto_id text references agencia.projetos (id) on delete cascade,
  tipo       text not null check (tipo in ('veto', 'obrigatorio', 'posicionamento')),
  texto      text not null,
  porque     text,
  termos     text[],
  desde      date not null,
  constraint regra_tem_um_dono check (num_nonnulls(cliente_id, projeto_id) = 1)
);
create index if not exists regras_cliente_idx on agencia.regras (cliente_id);
create index if not exists regras_projeto_idx on agencia.regras (projeto_id);
create table if not exists agencia.fontes_mercado (
  id         text primary key,
  nome       text not null,
  descricao  text not null default '',
  cadencia   text not null check (cadencia in ('diaria', 'semanal', 'mensal', 'eventual')),
  automatica boolean not null default false,
  da_casa    boolean not null default false,
  url        text
);
create table if not exists agencia.leituras (
  id            text primary key,
  titulo        text not null,
  resumo        text not null default '',
  fonte_id      text not null references agencia.fontes_mercado (id),
  publicado_em  date not null,
  validade_dias integer not null default 90,
  regioes       text[] not null default '{}',
  aplica_a      text[],
  temas         text[] not null default '{}'
);
create table if not exists agencia.agentes (
  id          text primary key,
  slug        text not null unique,
  nome        text not null,
  resumo      text not null default '',
  descricao   text not null default '',
  glifo       text not null check (
    glifo in ('orbita', 'imagem', 'linhas', 'confere', 'grade', 'mosaico',
              'filme', 'terminal', 'livro', 'relogio', 'chave')
  ),
  espaco_id   text not null references agencia.espacos (id),
  destaque    boolean not null default false,
  beta        boolean not null default false,
  url_externa text,
  rota_interna text,
  cliente_id  text,
  ordem       integer,
  atalhos     text[] not null default '{}'
);
create table if not exists agencia.acessos_agente (
  agente_id text not null references agencia.agentes (id) on delete cascade,
  espaco_id text not null references agencia.espacos (id) on delete cascade,
  primary key (agente_id, espaco_id)
);
create table if not exists agencia.skills (
  id            text primary key,
  slug          text not null unique,
  nome          text not null,
  descricao     text not null default '',
  categoria     text not null check (
    categoria in ('design', 'conteudo', 'midia', 'atendimento', 'geral')
  ),
  origem        text not null check (origem in ('cupola', 'qm')),
  espaco_id     text not null references agencia.espacos (id),
  corpo         text not null default '',
  requer_chaves text[],
  usos          integer not null default 0
);
create table if not exists agencia.instalacoes_skill (
  id            text primary key,
  pessoa_id     text not null references agencia.pessoas (id) on delete cascade,
  skill_id      text not null references agencia.skills (id)  on delete cascade,
  ativa         boolean not null default true,
  instalada_em  timestamptz not null default now(),
  unique (pessoa_id, skill_id)
);
create table if not exists agencia.sessoes (
  id            text primary key,
  agente_id     text not null references agencia.agentes (id),
  pessoa_id     text not null references agencia.pessoas (id),
  espaco_id     text not null references agencia.espacos (id),
  projeto_id    text references agencia.projetos (id) on delete set null,
  cliente_id    text references agencia.clientes (id) on delete set null,
  titulo        text not null,
  subtitulo     text,
  atualizada_em timestamptz not null default now(),
  fixada        boolean not null default false,
  arquivada     boolean not null default false
);
create table if not exists agencia.avisos_sistema (
  id        text primary key,
  tom       text not null check (tom in ('risco', 'atencao', 'neutro')),
  titulo    text not null,
  detalhe   text not null,
  visto_em  timestamptz not null default now()
);
create table if not exists agencia.lotes (
  id            text primary key,
  agente_id     text not null references agencia.agentes (id) on delete cascade,
  nome          text not null,
  criado_por    text not null references agencia.pessoas (id),
  criado_em     timestamptz not null default now(),
  atualizado_por text references agencia.pessoas (id),
  atualizado_em timestamptz not null default now()
);
create index if not exists lotes_agente_idx on agencia.lotes (agente_id, atualizado_em desc);
create table if not exists agencia.lote_cards (
  id       text primary key,
  lote_id  text not null references agencia.lotes (id) on delete cascade,
  posicao  integer not null,
  dados    jsonb not null
);
create index if not exists lote_cards_lote_idx on agencia.lote_cards (lote_id, posicao);
create index if not exists sessoes_pessoa_idx  on agencia.sessoes (pessoa_id);
create index if not exists sessoes_projeto_idx on agencia.sessoes (projeto_id);
create table if not exists agencia.mensagens (
  id        text primary key,
  sessao_id text not null references agencia.sessoes (id) on delete cascade,
  papel     text not null check (papel in ('pessoa', 'agente', 'passo')),
  conteudo  text not null,
  criada_em timestamptz not null default now(),
  avaliacao text check (avaliacao in ('positivo', 'negativo')),
  conta_sugerida text
);
create index if not exists mensagens_sessao_idx on agencia.mensagens (sessao_id, criada_em);
create table if not exists agencia.anexos (
  id          text primary key,
  projeto_id  text references agencia.projetos (id) on delete cascade,
  sessao_id   text references agencia.sessoes (id)  on delete cascade,
  nome        text not null,
  tipo        text not null check (
    tipo in ('briefing', 'ata', 'referencia', 'planilha', 'arte', 'outro')
  ),
  tamanho     text not null default '',
  origem      text check (origem in ('arquivo', 'link', 'drive', 'texto')),
  url         text,
  enviado_por text not null,
  enviado_em  timestamptz not null default now(),
  constraint anexo_tem_um_dono check (num_nonnulls(projeto_id, sessao_id) = 1)
);
create table if not exists agencia.crons (
  id          text primary key,
  nome        text not null,
  agente_id   text not null references agencia.agentes (id),
  instrucao   text not null,
  frequencia  text not null check (
    frequencia in ('diaria', 'semanal', 'quinzenal', 'mensal')
  ),
  quando      text not null,
  proxima_em  timestamptz,
  ultima_em   timestamptz,
  ativo       boolean not null default true,
  dono_id     text not null references agencia.pessoas (id),
  espaco_id   text not null references agencia.espacos (id),
  cliente_id  text references agencia.clientes (id)
);
create table if not exists agencia.chaves_api (
  id                text primary key,
  nome              text not null,
  servico           text not null,
  host              text not null,
  espaco_id         text not null references agencia.espacos (id),
  tem_segredo       boolean not null default false,
  criada_por_id     text not null references agencia.pessoas (id),
  criada_em         timestamptz not null default now(),
  expira_em         timestamptz,
  ultimo_uso_em     timestamptz,
  ultimo_uso_por_id text references agencia.pessoas (id),
  usos              integer not null default 0,
  ativa             boolean not null default true
);
create table if not exists agencia.concessoes (
  id               text primary key,
  chave_id         text not null references agencia.chaves_api (id) on delete cascade,
  espaco_id        text not null references agencia.espacos (id),
  modo             text not null check (modo in ('uma-vez', 'permanente')),
  proposito        text not null,
  concedida_por_id text not null references agencia.pessoas (id),
  concedida_em     timestamptz not null default now(),
  expira_em        timestamptz,
  ativa            boolean not null default true
);
create table if not exists agencia.conectores (
  id               text primary key,
  nome             text not null,
  servico          text not null,
  status           text not null check (
    status in ('conectado', 'desconectado', 'reconectar')
  ),
  conectado_por_id text references agencia.pessoas (id),
  conectado_em     timestamptz,
  escopos          text[] not null default '{}'
);
create table if not exists agencia.regras_egress (
  id            text primary key,
  host          text not null,
  motivo        text not null,
  permitido     boolean not null,
  criada_por_id text not null references agencia.pessoas (id),
  criada_em     timestamptz not null default now()
);
create table if not exists agencia.auditoria (
  id       text primary key default gen_random_uuid()::text,
  em       timestamptz not null default now(),
  pessoa_id text not null references agencia.pessoas (id),
  acao     text not null check (acao in (
    'entrou', 'saiu',
    'funcionalidade.alterada',
    'pessoa.cadastrada', 'pessoa.area.alterada', 'pessoa.cargo.alterado', 'pessoa.squad.alterado',
    'squad.carteira.alterada', 'pessoa.desligada', 'pessoa.religada',
    'cliente.criado', 'cliente.alterado',
    'cliente.acesso.alterado', 'agente.acesso.alterado', 'espaco-trabalho.alterado',
    'chave.criada', 'chave.revogada', 'chave.usada', 'chave.uso.negado',
    'concessao.criada', 'projeto.criado',
    'skill.instalada', 'skill.desinstalada', 'skill.ativada', 'skill.desativada',
    'cron.criado', 'cron.alterado',
    'sessao.criada', 'sessao.renomeada', 'sessao.arquivada', 'sessao.excluida',
    'sessao.movida', 'senha.revelada'
  )),
  alvo     text not null,
  detalhe  text,
  negado   boolean not null default false
);
create index if not exists auditoria_em_idx     on agencia.auditoria (em desc);
create index if not exists auditoria_pessoa_idx on agencia.auditoria (pessoa_id);
create table if not exists agencia.reunioes (
  id         text primary key,
  pessoa_id  text not null references agencia.pessoas (id) on delete cascade,
  dia        date not null default current_date,
  hora       text not null,
  titulo     text not null,
  com_quem   text,
  cliente_id text references agencia.clientes (id)
);
create table if not exists agencia.notas_do_dia (
  id          text primary key,
  pessoa_id   text not null references agencia.pessoas (id) on delete cascade,
  texto       text not null,
  detalhe     text,
  prazo       date,
  para        text,
  rotulo_para text
);
create table if not exists agencia.tarefas_runrun (
  id               text primary key,
  codigo           text not null,
  titulo           text not null,
  cliente_id       text references agencia.clientes (id),
  status           text not null check (
    status in ('a-fazer', 'em-andamento', 'aguardando', 'concluida')
  ),
  prazo            date,
  horas_gastas     numeric not null default 0,
  horas_estimadas  numeric not null default 0,
  responsavel_id   text not null references agencia.pessoas (id) on delete cascade,
  travada_por      text
);
create table if not exists agencia.emails_resumidos (
  id           text primary key,
  pessoa_id    text not null references agencia.pessoas (id) on delete cascade,
  remetente    text not null,
  organizacao  text not null default '',
  assunto      text not null,
  resumo       text not null default '',
  marcador     text not null check (
    marcador in ('responder', 'prazo-mudou', 'decisao', 'leitura')
  ),
  quando       timestamptz not null default now(),
  cliente_id   text references agencia.clientes (id)
);
create table if not exists agencia.fichas_pessoa (
  pessoa_id         text primary key references agencia.pessoas (id) on delete cascade,
  disc              text check (
    disc in ('D', 'I', 'S', 'C', 'DI', 'ID', 'SC', 'CS', 'DC', 'IS')
  ),
  situacao          text check (situacao in ('firme', 'atencao', 'risco')),
  momento           text,
  pontos_atencao    text[] not null default '{}',
  pdi_objetivo      text,
  pdi_proximo_passo text,
  pdi_progresso     numeric,
  pdi_revisao_em    date,
  avaliacao         numeric,
  avaliada_em       date,
  engajamento       numeric,
  desde             date
);
create table if not exists agencia.vagas (
  id             text primary key,
  cargo          text not null,
  area_id        text not null references agencia.espacos (id),
  status         text not null check (status in ('aberta', 'em-oferta', 'fechada')),
  aberta_em      date not null,
  meta           integer not null default 1,
  contratados    integer not null default 0,
  responsavel_id text references agencia.pessoas (id)
);
create table if not exists agencia.canais_recrutamento (
  id            text primary key,
  nome          text not null,
  regiao        text not null default '',
  candidatos    integer not null default 0,
  avancados     integer not null default 0,
  contratados   integer not null default 0,
  custo_inicial text not null default '',
  status        text not null check (
    status in ('ativo', 'onboarding', 'pausado', 'encerrado')
  )
);
create table if not exists agencia.candidatos (
  id         text primary key,
  nome       text not null,
  vaga_id    text not null references agencia.vagas (id) on delete cascade,
  origem     text not null default '',
  cidade     text not null default '',
  etapa      text not null check (
    etapa in ('triagem', 'teste', 'entrevista', 'proposta', 'contratado')
  ),
  triagem    text check (
    triagem in ('aprovado', 'agendado', 'em-analise', 'pendente', 'reprovado')
  ),
  entrevista text check (
    entrevista in ('aprovado', 'agendado', 'em-analise', 'pendente', 'reprovado')
  ),
  pretensao  text,
  ranking    integer,
  nota       text
);
create table if not exists agencia.entregas (
  id                     text primary key,
  cliente_id             text not null references agencia.clientes (id) on delete cascade,
  tema                   text not null,
  dono_conta_id          text references agencia.pessoas (id),
  lider_projeto_id       text references agencia.pessoas (id),
  revisao_lider_em       date,
  revisao_atendimento_em date,
  apresentacao_em        date,
  status                 text not null check (status in (
    'na-fila', 'revisao-lider', 'revisao-atendimento',
    'liberado', 'alteracoes', 'apresentado'
  )),
  link_tarefa            text,
  nps                    numeric,
  observacao             text
);
create table if not exists agencia.equipamentos (
  id            text primary key,
  apelido       text not null,
  modelo        text not null default '',
  especificacao text not null default '',
  area_id       text references agencia.espacos (id),
  local         text not null check (local in ('escritorio', 'casa', 'estoque')),
  com_quem_id   text references agencia.pessoas (id),
  usuario       text not null default '',
  tem_senha     boolean not null default false,
  comprado_em   date,
  estado        text not null check (estado in ('bom', 'trocar', 'quebrado')),
  observacao    text
);
create table if not exists agencia.desejos_equipamento (
  id              text primary key,
  item            text not null,
  motivo          text not null default '',
  area_id         text references agencia.espacos (id),
  valor_estimado  numeric,
  prioridade      text not null check (prioridade in ('alta', 'media', 'baixa'))
);
create table if not exists agencia.assinaturas (
  id                text primary key,
  ferramenta        text not null,
  categoria         text not null check (
    categoria in ('ia', 'criacao', 'gestao', 'midia', 'infra')
  ),
  area_id           text references agencia.espacos (id),
  contas            integer not null default 1,
  valor_por_conta   numeric not null default 0,
  moeda             text not null check (moeda in ('BRL', 'USD')),
  ciclo             text not null check (ciclo in ('mensal', 'anual')),
  renova_em         date,
  status            text not null check (status in ('ativa', 'pesquisando', 'cancelar')),
  responsavel_id    text references agencia.pessoas (id),
  link_invoice      text,
  email_financeiro  text,
  observacao        text
);
create table if not exists agencia.fornecedores (
  id              text primary key,
  nome            text not null,
  tipo            text not null check (tipo in (
    'freela', 'filmmaker', 'outdoor', 'shopping', 'tv', 'radio', 'jornal', 'grafica'
  )),
  especialidade   text not null default '',
  cidade          text not null default '',
  contato         text not null default '',
  referencia      text not null default '',
  material        text,
  material_rotulo text,
  avaliacao       numeric,
  observacao      text
);
create table if not exists agencia.periodos_trabalho (
  id             bigserial primary key,
  fornecedor_id  text not null references agencia.fornecedores (id) on delete cascade,
  inicio         date not null,
  fim            date,
  descricao      text not null default '',
  valor          numeric not null default 0,
  nota_fiscal    boolean not null default false
);
create table if not exists agencia.cliente_conhecimento (
  id          text primary key,
  cliente_id  text not null references agencia.clientes (id) on delete cascade,
  nome        text not null,
  origem      text not null check (origem in ('arquivo', 'texto', 'site')),
  texto       text not null default '',
  enviado_por text references agencia.pessoas (id),
  enviado_em  timestamptz not null default now()
);
create index if not exists idx_conhecimento_cliente on agencia.cliente_conhecimento (cliente_id);
create table if not exists agencia.cliente_identidade (
  cliente_id    text primary key references agencia.clientes (id) on delete cascade,
  cores         jsonb not null default '[]'::jsonb,
  tipografia    jsonb not null default '[]'::jsonb,
  guia          text  not null default '',
  atualizado_em timestamptz not null default now()
);
create table if not exists agencia.cliente_marca_arquivo (
  id           text primary key,
  cliente_id   text not null references agencia.clientes (id) on delete cascade,
  nome         text not null,
  papel        text not null check (papel in ('logo', 'aplicacao')),
  caminho      text,
  tipo_arquivo text,
  tamanho      bigint,
  enviado_em   timestamptz not null default now()
);
create index if not exists idx_marca_arquivo_cliente
  on agencia.cliente_marca_arquivo (cliente_id);
create table if not exists agencia.produtos (
  id                text primary key,
  slug              text not null unique,
  nome              text not null,
  tipo              text not null default '',
  resumo            text not null default '',
  status            text not null default 'rascunho'
                    check (status in ('rascunho', 'ativo', 'encerrado')),
  cor               text not null default '#5FA8C4',
  bu_id             text,
  sobre             text not null default '',
  publico_alvo      text not null default '',
  proposta_de_valor text not null default '',
  tagline           text not null default '',
  frase_de_impacto  text not null default '',
  contexto_mercado  text not null default '',
  posicionamento    text not null default '',
  dores             jsonb not null default '[]'::jsonb,
  diferenciais      jsonb not null default '[]'::jsonb,
  entregaveis       jsonb not null default '[]'::jsonb,
  conteudo          jsonb not null default '[]'::jsonb,
  objecoes          jsonb not null default '[]'::jsonb,
  links             jsonb not null default '[]'::jsonb,
  materiais         jsonb not null default '[]'::jsonb,
  inicio            date,
  fim               date,
  local             text not null default '',
  modalidade        text check (modalidade in ('presencial', 'online', 'hibrido')),
  vagas             integer,
  inicio_das_vendas date,
  preco_referencia  numeric,
  politica_comercial text not null default '',
  vendidas          integer not null default 0,
  atualizado_em     date
);
create table if not exists agencia.blog_ajustes (
  cliente_id      text primary key references agencia.clientes (id) on delete cascade,
  estilo_redator  text not null default '',
  amostras        jsonb not null default '[]'::jsonb,
  panorama        jsonb not null default '[]'::jsonb,
  cta_base_url    text not null default '',
  utm_source      text not null default '',
  utm_medium      text not null default '',
  utm_campaign    text not null default '',
  utm_content     text not null default '',
  atualizado_em   timestamptz not null default now()
);
create table if not exists agencia.blog_posts (
  id             text primary key,
  cliente_id     text not null references agencia.clientes (id) on delete cascade,
  mes            text not null,
  titulo         text not null default '',
  status         text not null default 'rascunho'
                 check (status in ('rascunho', 'em_revisao', 'publicado')),
  passo_atual    integer not null default 1 check (passo_atual between 1 and 9),
  tema           text not null default '',
  objetivo       text not null default '',
  etapa          text not null default 'descoberta'
                 check (etapa in ('descoberta', 'consideracao', 'decisao')),
  obrigatorias   text not null default '',
  motivo         text not null default '',
  intencao       text not null default '',
  palavra_chave  text not null default '',
  secundarias    text not null default '',
  prompts_de_ia  text not null default '',
  h1             text not null default '',
  titulos        jsonb not null default '[]'::jsonb,
  fontes         text not null default '',
  introducao     text not null default '',
  desenvolvimento text not null default '',
  encerramento   text not null default '',
  faq            jsonb not null default '[]'::jsonb,
  seo_title      text not null default '',
  seo_description text not null default '',
  seo_slug       text not null default '',
  texto_revisado text not null default '',
  criado_por     text not null references agencia.pessoas (id),
  criado_em      timestamptz not null default now(),
  atualizado_por text references agencia.pessoas (id),
  atualizado_em  timestamptz not null default now()
);
create index if not exists blog_posts_cliente_idx
  on agencia.blog_posts (cliente_id, mes desc, atualizado_em desc);
create table if not exists agencia.blog_meses (
  cliente_id text not null references agencia.clientes (id) on delete cascade,
  mes        text not null,
  criado_por text references agencia.pessoas (id),
  criado_em  timestamptz not null default now(),
  primary key (cliente_id, mes)
);
create table if not exists agencia.uso_de_ia (
  id            text primary key,
  quando        timestamptz not null default now(),
  rota          text not null,
  provedor      text not null check (provedor in ('anthropic', 'gemini', 'magnific')),
  modelo        text not null,
  entrada       integer not null default 0,
  saida         integer not null default 0,
  cache_escrita integer not null default 0,
  cache_leitura integer not null default 0,
  custo         numeric(12, 6) not null default 0,
  pessoa_id     text,
  cliente_id    text,
  agente        text,
  creditos      integer not null default 0
);
create index if not exists uso_de_ia_quando_idx on agencia.uso_de_ia (quando desc);
create index if not exists uso_de_ia_cliente_idx on agencia.uso_de_ia (cliente_id, quando desc);
create index if not exists uso_de_ia_agente_idx on agencia.uso_de_ia (agente, quando desc);
create table if not exists agencia.redes_conteudo_meses (
  cliente_id     text not null references agencia.clientes (id) on delete cascade,
  mes            text not null,
  tarefa         text not null default '',
  briefing       text not null default '',
  datas          text not null default '',
  sugeridos      text not null default '',
  palavras       jsonb not null default '[]'::jsonb,
  passo_atual    integer not null default 1 check (passo_atual between 1 and 5),
  producao_fechada_em timestamptz,
  criado_por     text references agencia.pessoas (id),
  criado_em      timestamptz not null default now(),
  atualizado_por text references agencia.pessoas (id),
  atualizado_em  timestamptz not null default now(),
  primary key (cliente_id, mes)
);
create table if not exists agencia.redes_conteudo_temas (
  id             text primary key,
  cliente_id     text not null references agencia.clientes (id) on delete cascade,
  mes            text not null,
  titulo         text not null default '',
  justificativa  text not null default '',
  estado         text not null default 'sugerido'
                 check (estado in ('sugerido', 'escolhido', 'descartado')),
  ordem          integer not null default 0,
  numero         integer,
  formato        text check (formato in ('card', 'carrossel')),
  instrucoes     text not null default '',
  legenda        text not null default '',
  texto_imagem   text not null default '',
  slides         jsonb not null default '[]'::jsonb,
  stories        jsonb not null default '[]'::jsonb,
  veredito       text check (veredito in ('aprovado', 'ajuste', 'reprovado')),
  comentario     text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists redes_conteudo_temas_mes_idx
  on agencia.redes_conteudo_temas (cliente_id, mes, ordem);
alter table agencia.mensagens add column if not exists avaliacao      text;
alter table agencia.mensagens add column if not exists conta_sugerida text;
alter table agencia.agentes add column if not exists rota_interna text;
alter table agencia.agentes add column if not exists cliente_id   text;
alter table agencia.agentes add column if not exists ordem        integer;
alter table agencia.lotes add column if not exists atualizado_por text references agencia.pessoas (id);
alter table agencia.acessos_funcionalidade
  drop constraint if exists acessos_funcionalidade_funcionalidade_check;
alter table agencia.acessos_funcionalidade
  add constraint acessos_funcionalidade_funcionalidade_check check (funcionalidade in (
    'clientes', 'produtos', 'projetos', 'agentes', 'skills', 'mercado', 'crons',
    'meu-dia', 'gestao', 'admin'
  ));
alter table agencia.auditoria drop constraint if exists auditoria_acao_check;
alter table agencia.auditoria add constraint auditoria_acao_check check (acao in (
  'entrou', 'saiu',
  'funcionalidade.alterada',
  'pessoa.cadastrada', 'pessoa.area.alterada', 'pessoa.cargo.alterado', 'pessoa.squad.alterado',
  'squad.carteira.alterada', 'pessoa.desligada', 'pessoa.religada',
  'cliente.criado', 'cliente.alterado',
  'cliente.acesso.alterado', 'agente.acesso.alterado', 'espaco-trabalho.alterado',
  'chave.criada', 'chave.revogada', 'chave.usada', 'chave.uso.negado',
  'concessao.criada', 'projeto.criado',
  'skill.instalada', 'skill.desinstalada', 'skill.ativada', 'skill.desativada',
  'cron.criado', 'cron.alterado',
  'sessao.criada', 'sessao.renomeada', 'sessao.arquivada', 'sessao.excluida',
  'sessao.movida', 'senha.revelada'
));
alter table agencia.clientes add column if not exists setor_descricao   text not null default '';
alter table agencia.clientes add column if not exists publico_alvo      text not null default '';
alter table agencia.clientes add column if not exists tom_de_voz        text not null default '';
alter table agencia.clientes add column if not exists produtos_servicos text not null default '';
alter table agencia.cliente_conhecimento add column if not exists caminho      text;
alter table agencia.cliente_conhecimento add column if not exists tipo_arquivo text;
alter table agencia.cliente_conhecimento add column if not exists tamanho      bigint;
alter table agencia.clientes add column if not exists posicionamento  text not null default '';
alter table agencia.clientes add column if not exists diferenciais    text not null default '';
alter table agencia.clientes add column if not exists concorrencia    text not null default '';
alter table agencia.clientes add column if not exists palavras_chave  text not null default '';
alter table agencia.clientes add column if not exists fontes_do_perfil jsonb not null default '{}'::jsonb;
alter table agencia.clientes add column if not exists atualizado_em  timestamptz;
alter table agencia.clientes add column if not exists atualizado_por text references agencia.pessoas (id);
alter table agencia.clientes add column if not exists contato_nome     text not null default '';
alter table agencia.clientes add column if not exists contato_cargo    text not null default '';
alter table agencia.clientes add column if not exists contato_email    text not null default '';
alter table agencia.clientes add column if not exists contato_telefone text not null default '';
alter table agencia.contratos add column if not exists valor_mensal numeric;
alter table agencia.leituras add column if not exists link   text;
alter table agencia.leituras add column if not exists imagem text;
drop index if exists agencia.idx_leituras_link;
create unique index if not exists idx_leituras_link on agencia.leituras (link);
alter table agencia.fontes_mercado add column if not exists feed           text;
alter table agencia.fontes_mercado add column if not exists regioes_padrao text[] not null default '{}';
alter table agencia.fontes_mercado add column if not exists temas_padrao   text[] not null default '{}';
alter table agencia.fontes_mercado add column if not exists ultima_leitura timestamptz;
alter table agencia.fontes_mercado add column if not exists ultimo_erro    text;
alter table agencia.fontes_mercado add column if not exists classificar boolean not null default false;
alter table agencia.leituras add column if not exists porque text;
alter table agencia.blog_ajustes add column if not exists panorama jsonb not null default '[]'::jsonb;
alter table agencia.cliente_conhecimento
  drop constraint if exists cliente_conhecimento_origem_check;
alter table agencia.cliente_conhecimento
  add constraint cliente_conhecimento_origem_check
  check (origem in ('arquivo', 'texto', 'site', 'drive'));
alter table agencia.cliente_conhecimento add column if not exists url text;
alter table agencia.agentes add column if not exists oculto boolean not null default false;
alter table agencia.agentes add column if not exists por_conta boolean not null default false;
alter table agencia.pessoas add column if not exists foto text;
alter table agencia.squads  add column if not exists logo text;
alter table agencia.clientes add column if not exists capa text;
alter table agencia.clientes add column if not exists atendimento_id text;
alter table agencia.agentes
  drop constraint if exists agentes_glifo_check;
alter table agencia.agentes
  add constraint agentes_glifo_check
  check (glifo in ('orbita', 'imagem', 'linhas', 'confere', 'grade', 'mosaico',
                   'filme', 'terminal', 'livro', 'relogio', 'chave'));
alter table agencia.uso_de_ia add column if not exists agente text;
alter table agencia.uso_de_ia add column if not exists creditos integer not null default 0;
alter table agencia.uso_de_ia drop constraint if exists uso_de_ia_provedor_check;
alter table agencia.uso_de_ia add constraint uso_de_ia_provedor_check
  check (provedor in ('anthropic', 'gemini', 'magnific'));
alter table agencia.lotes add column if not exists cliente_id text
  references agencia.clientes (id) on delete set null;
create index if not exists lotes_cliente_idx on agencia.lotes (agente_id, cliente_id, atualizado_em desc);
alter table agencia.redes_conteudo_meses
  add column if not exists palavras jsonb not null default '[]'::jsonb;
alter table agencia.redes_conteudo_meses drop column if exists palavras_chave;
alter table agencia.redes_conteudo_meses
  drop constraint if exists redes_conteudo_meses_passo_atual_check;
alter table agencia.redes_conteudo_meses
  add constraint redes_conteudo_meses_passo_atual_check check (passo_atual between 1 and 5);
alter table agencia.redes_conteudo_meses
  add column if not exists producao_fechada_em timestamptz;
alter table agencia.redes_conteudo_temas
  add column if not exists numero integer;