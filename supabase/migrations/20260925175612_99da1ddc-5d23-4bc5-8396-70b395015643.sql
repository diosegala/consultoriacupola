create table if not exists agencia.news_edicoes (
  cliente_id text not null references agencia.clientes(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  tipo text not null default 'blog' check (tipo = 'blog'),
  conteudo jsonb not null default '{}'::jsonb,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, mes, tipo));
grant select, insert, update, delete on agencia.news_edicoes to authenticated;
grant all on agencia.news_edicoes to service_role;
alter table agencia.news_edicoes enable row level security;
create policy "ver news" on agencia.news_edicoes for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer news" on agencia.news_edicoes for all to authenticated using ((select agencia_app.pode_usar('agentes'))) with check ((select agencia_app.pode_usar('agentes')));