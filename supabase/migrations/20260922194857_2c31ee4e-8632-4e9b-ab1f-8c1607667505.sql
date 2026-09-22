create table agencia.redes_artes (
  id text primary key,
  tema_id text not null references agencia.redes_conteudo_temas(id) on delete cascade,
  cliente_id text not null references agencia.clientes(id) on delete cascade,
  formato text not null check (formato in ('feed_4_5', 'quadrado_1_1', 'stories_9_16')),
  tipo text not null check (tipo in ('imagem_opcao', 'arte_final')),
  versao integer not null default 1,
  slide_indice integer not null default 0,
  caminho text not null,
  prompt text not null default '',
  composicao jsonb not null default '{}'::jsonb,
  texto text not null default '',
  aprovada boolean not null default false,
  criado_por text references agencia.pessoas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on agencia.redes_artes to authenticated;
grant all on agencia.redes_artes to service_role;
alter table agencia.redes_artes enable row level security;
create policy "ver artes da conta" on agencia.redes_artes
  for select to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "criar artes da conta" on agencia.redes_artes
  for insert to authenticated
  with check ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "editar artes da conta" on agencia.redes_artes
  for update to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)))
  with check ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "apagar artes da conta" on agencia.redes_artes
  for delete to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)));
create index redes_artes_tema_idx on agencia.redes_artes(tema_id, criado_em desc);
create index redes_artes_cliente_idx on agencia.redes_artes(cliente_id, criado_em desc);

create policy "pecas: ver arquivo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'agencia-pecas'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
create policy "pecas: subir arquivo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agencia-pecas'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
create policy "pecas: atualizar arquivo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'agencia-pecas'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'agencia-pecas'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
create policy "pecas: apagar arquivo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'agencia-pecas'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );