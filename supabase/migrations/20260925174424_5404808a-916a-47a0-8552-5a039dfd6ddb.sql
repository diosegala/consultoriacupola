alter table agencia.squads
  add column if not exists coordenacao_id text references agencia.pessoas(id) on delete set null,
  add column if not exists atendimento_id text references agencia.pessoas(id) on delete set null;

alter table agencia.blog_posts add column if not exists texto_refinado text not null default '';
alter table agencia.blog_posts add column if not exists texto_antes_do_refino text not null default '';
alter table agencia.blog_posts drop constraint if exists blog_posts_passo_atual_check;
alter table agencia.blog_posts add constraint blog_posts_passo_atual_check check (passo_atual between 1 and 11);

create table if not exists agencia.agentes_por_cliente (
  agente_id text not null references agencia.agentes(id) on delete cascade,
  cliente_id text not null references agencia.clientes(id) on delete cascade,
  liberado boolean not null,
  primary key (agente_id, cliente_id));
grant select, insert, update, delete on agencia.agentes_por_cliente to authenticated;
grant all on agencia.agentes_por_cliente to service_role;
alter table agencia.agentes_por_cliente enable row level security;
create policy "ver agentes por cliente" on agencia.agentes_por_cliente for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer agentes por cliente" on agencia.agentes_por_cliente for all to authenticated
  using ((select agencia_app.eh_admin()) or (select agencia_app.eh_lideranca()))
  with check ((select agencia_app.eh_admin()) or (select agencia_app.eh_lideranca()));

create table if not exists agencia.blog_experimentos (
  id text primary key, post_id text not null,
  cliente_id text not null references agencia.clientes(id) on delete cascade,
  conteudo jsonb not null, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create index if not exists blog_experimentos_post on agencia.blog_experimentos(post_id, atualizado_em desc);
grant select, insert, update, delete on agencia.blog_experimentos to authenticated;
grant all on agencia.blog_experimentos to service_role;
alter table agencia.blog_experimentos enable row level security;
create policy "ver comparacoes blog" on agencia.blog_experimentos for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer comparacoes blog" on agencia.blog_experimentos for all to authenticated using ((select agencia_app.pode_usar('agentes'))) with check ((select agencia_app.pode_usar('agentes')));

create table if not exists agencia.pranchas_google (
  cliente_id text not null references agencia.clientes(id) on delete cascade,
  apresentacao_id text not null, nome text not null default '', criado_em timestamptz not null default now(),
  primary key (cliente_id, apresentacao_id));
create table if not exists agencia.pranchas_posts (
  cliente_id text not null, apresentacao_id text not null, post_id text not null, titulo text not null,
  vinculo jsonb not null, atualizado_em timestamptz not null default now(),
  primary key (cliente_id, apresentacao_id, post_id),
  foreign key (cliente_id, apresentacao_id) references agencia.pranchas_google on delete cascade);
create table if not exists agencia.pranchas_envios (
  id uuid primary key default gen_random_uuid(), cliente_id text not null, apresentacao_id text not null,
  modo text not null check (modo in ('montagem','legendas','imagens')), posts jsonb not null,
  criado_em timestamptz not null default now(),
  foreign key (cliente_id, apresentacao_id) references agencia.pranchas_google on delete cascade);
create table if not exists agencia.pranchas_config (
  cliente_id text primary key references agencia.clientes(id) on delete cascade, pasta_id text not null);
create table if not exists agencia.pranchas_criacoes (
  cliente_id text not null references agencia.clientes(id) on delete cascade, operacao text not null,
  pasta_id text not null, mes text not null, nome text not null, apresentacao_id text,
  estado text not null check (estado in ('criando','copiada','pronta')), criado_em timestamptz not null default now(),
  primary key (cliente_id, operacao));
create table if not exists agencia.imagens_planejamento (
  cliente_id text not null references agencia.clientes(id) on delete cascade, apresentacao_id text not null,
  estado jsonb not null default '{}'::jsonb, atualizado_por text references agencia.pessoas(id) on delete set null,
  atualizado_em timestamptz not null default now(), primary key (cliente_id, apresentacao_id));

do $$ declare t text; begin
  foreach t in array array['pranchas_google','pranchas_posts','pranchas_envios','pranchas_config','pranchas_criacoes','imagens_planejamento'] loop
    execute format('grant select, insert, update, delete on agencia.%I to authenticated', t);
    execute format('grant all on agencia.%I to service_role', t);
    execute format('alter table agencia.%I enable row level security', t);
    execute format('create policy "acesso da conta" on agencia.%I for all to authenticated using ((select agencia_app.pode_usar(''agentes'')) and (select agencia_app.pode_ver_cliente(cliente_id))) with check ((select agencia_app.pode_usar(''agentes'')) and (select agencia_app.pode_ver_cliente(cliente_id)))', t);
  end loop; end $$;

create table if not exists agencia.pastas_criadas (
  id text primary key, nome text not null, link text not null, destino text not null,
  cliente_id text references agencia.clientes(id) on delete set null,
  criado_por text references agencia.pessoas(id) on delete set null,
  criado_em timestamptz not null default now());
create index if not exists pastas_criadas_recentes on agencia.pastas_criadas(criado_em desc);
grant select, insert on agencia.pastas_criadas to authenticated;
grant all on agencia.pastas_criadas to service_role;
alter table agencia.pastas_criadas enable row level security;
create policy "ver pastas criadas" on agencia.pastas_criadas for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "registrar pasta criada" on agencia.pastas_criadas for insert to authenticated with check (criado_por = (select agencia_app.pessoa_id()));

alter table agencia.acessos_funcionalidade drop constraint if exists acessos_funcionalidade_funcionalidade_check;
alter table agencia.acessos_funcionalidade add constraint acessos_funcionalidade_funcionalidade_check check (funcionalidade in (
  'clientes','produtos','projetos','agentes','skills','mercado','crons','meu-dia','gestao','admin','design-system'));