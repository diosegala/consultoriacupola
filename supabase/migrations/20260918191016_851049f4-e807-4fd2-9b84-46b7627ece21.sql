create schema if not exists agencia_app;
revoke all on schema agencia_app from public;
create or replace function agencia_app.pessoa_id() returns text
language sql stable security definer set search_path = public as $$
  select id from agencia.pessoas where auth_id = auth.uid() and ativa
$$;
create or replace function agencia_app.marcar_cliente_atualizado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(agencia_app.pessoa_id(), new.atualizado_por);
  return new;
end $$;
drop trigger if exists clientes_atualizado on agencia.clientes;
create trigger clientes_atualizado
  before update on agencia.clientes
  for each row execute function agencia_app.marcar_cliente_atualizado();
create or replace function agencia_app.papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from agencia.pessoas where auth_id = auth.uid() and ativa
$$;
create or replace function agencia_app.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(agencia_app.papel() = 'admin', false)
$$;
create or replace function agencia_app.eh_lideranca() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(agencia_app.papel() in ('admin', 'gestor'), false)
$$;
create or replace function agencia_app.minha_area() returns text
language sql stable security definer set search_path = public as $$
  select area_id from agencia.pessoas where auth_id = auth.uid() and ativa
$$;
create or replace function agencia_app.minha_bu() returns text
language sql stable security definer set search_path = public as $$
  select case when e.tipo = 'bu' then e.id else e.bu_id end
    from agencia.pessoas p
    join agencia.espacos e on e.id = p.area_id
   where p.auth_id = auth.uid() and p.ativa
$$;
create or replace function agencia_app.beta_liberado() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select espaco_de_trabalho_liberado from agencia.pessoas
      where auth_id = auth.uid() and ativa), false)
$$;
create or replace function agencia_app.nivel_no_espaco(p_espaco text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when agencia_app.pessoa_id() is null then 'sem-acesso'
    when e.tipo = 'pessoal' then 'admin'
    when agencia_app.eh_admin() then 'admin'
    when (case when e.tipo = 'bu' then e.id else e.bu_id end)
         is distinct from agencia_app.minha_bu() then 'sem-acesso'
    when e.tipo = 'bu' then 'escrita'
    when e.id = agencia_app.minha_area() then 'escrita'
    when agencia_app.eh_lideranca() then 'leitura'
    else 'sem-acesso'
  end
  from agencia.espacos e where e.id = p_espaco
$$;
create or replace function agencia_app.pode_ver_espaco(p_espaco text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(agencia_app.nivel_no_espaco(p_espaco) in ('leitura', 'escrita', 'admin'), false)
$$;
create or replace function agencia_app.pode_escrever_espaco(p_espaco text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(agencia_app.nivel_no_espaco(p_espaco) in ('escrita', 'admin'), false)
$$;
create or replace function agencia_app.nivel_na_funcionalidade(f text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nivel from agencia.acessos_funcionalidade
      where pessoa_id = agencia_app.pessoa_id() and funcionalidade = f),
    'sem-acesso')
$$;
create or replace function agencia_app.pode_abrir(f text) returns boolean
language sql stable security definer set search_path = public as $$
  select agencia_app.nivel_na_funcionalidade(f) in ('leitura', 'escrita', 'admin')
$$;
create or replace function agencia_app.pode_usar(f text) returns boolean
language sql stable security definer set search_path = public as $$
  select agencia_app.nivel_na_funcionalidade(f) in ('escrita', 'admin')
$$;
create or replace function agencia_app.nivel_no_cliente(c text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nivel from agencia.acessos_cliente
      where pessoa_id = agencia_app.pessoa_id() and cliente_id = c),
    (select 'escrita'::text from agencia.squad_clientes sc
       join agencia.pessoa_squads ps on ps.squad_id = sc.squad_id
      where sc.cliente_id = c and ps.pessoa_id = agencia_app.pessoa_id() limit 1),
    case when agencia_app.eh_admin() then 'admin'
         when agencia_app.eh_lideranca() then 'leitura'
         else 'sem-acesso' end)
$$;
create or replace function agencia_app.pode_ver_cliente(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select agencia_app.nivel_no_cliente(c) in ('leitura', 'escrita', 'admin')
$$;
create or replace function agencia_app.pode_escrever_cliente(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select agencia_app.nivel_no_cliente(c) in ('escrita', 'admin')
$$;
create or replace function agencia_app.pode_abrir_projeto(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencia.projetos
                  where id = p and criado_por_id = agencia_app.pessoa_id())
      or exists (select 1 from agencia.projeto_pessoas
                  where projeto_id = p and pessoa_id = agencia_app.pessoa_id())
      or exists (select 1 from agencia.projeto_squads ps
                   join agencia.pessoa_squads ms on ms.squad_id = ps.squad_id
                   where ps.projeto_id = p and ms.pessoa_id = agencia_app.pessoa_id())
$$;
create or replace function agencia_app.eh_dono_do_projeto(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencia.projetos
                  where id = p and criado_por_id = agencia_app.pessoa_id())
$$;
create or replace function agencia_app.pode_ver_sessao(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencia.sessoes
                  where id = s
                    and (pessoa_id = agencia_app.pessoa_id() or agencia_app.pode_ver_espaco(espaco_id)))
$$;
create or replace function agencia_app.minha_sessao(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencia.sessoes where id = s and pessoa_id = agencia_app.pessoa_id())
$$;
create or replace function agencia_app.lidero(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agencia.pessoas where id = p and lider_id = agencia_app.pessoa_id())
$$;
create or replace function agencia_app.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update agencia.pessoas
     set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function agencia_app.ao_criar_usuario();
create or replace function agencia_app.protege_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if agencia_app.pode_usar('admin') then return new; end if;
  if new.papel   is distinct from old.papel
  or new.ativa   is distinct from old.ativa
  or new.email   is distinct from old.email
  or new.area_id is distinct from old.area_id
  or new.auth_id is distinct from old.auth_id
  or new.espaco_de_trabalho_liberado is distinct from old.espaco_de_trabalho_liberado
  then
    raise exception 'Papel, área, e-mail, situação e liberação só mudam pela administração';
  end if;
  return new;
end $$;
drop trigger if exists protege_pessoa on agencia.pessoas;
create trigger protege_pessoa
  before update on agencia.pessoas
  for each row execute function agencia_app.protege_pessoa();
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'agencia'
  loop
    execute format('alter table agencia.%I enable row level security', t.tablename);
  end loop;
end $$;
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'agencia'
  loop
    execute format('drop policy if exists %I on agencia.%I', r.policyname, r.tablename);
  end loop;
end $$;
create policy "ver avisos do sistema" on agencia.avisos_sistema
  for select to authenticated using ((select agencia_app.eh_lideranca()));
create policy "ver lotes" on agencia.lotes
  for select to authenticated using ((select agencia_app.pode_abrir('agentes')));
create policy "mexer lotes" on agencia.lotes
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
create policy "ver cards do lote" on agencia.lote_cards
  for select to authenticated using ((select agencia_app.pode_abrir('agentes')));
create policy "mexer cards do lote" on agencia.lote_cards
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
create policy "ver espacos" on agencia.espacos
  for select to authenticated using (true);
create policy "mexer espacos" on agencia.espacos
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver squads" on agencia.squads
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer squads" on agencia.squads
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver pessoas" on agencia.pessoas
  for select to authenticated
  using ((select agencia_app.pessoa_id()) is not null or auth_id = auth.uid());
create policy "editar a propria ficha" on agencia.pessoas
  for update to authenticated
  using (id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_usar('admin')))
  with check (id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_usar('admin')));
create policy "cadastrar pessoa" on agencia.pessoas
  for insert to authenticated with check ((select agencia_app.pode_usar('admin')));
create policy "criar a propria ficha" on agencia.pessoas
  for insert to authenticated
  with check (
    auth_id = auth.uid()
    and (select agencia_app.pessoa_id()) is null
    and papel = 'analista'
    and espaco_de_trabalho_liberado = false
  );
create or replace function agencia_app.chao_da_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into agencia.acessos_funcionalidade (pessoa_id, funcionalidade, nivel)
  values (new.id, 'agentes',  'escrita'),
         (new.id, 'projetos', 'escrita'),
         (new.id, 'skills',   'leitura'),
         (new.id, 'mercado',  'leitura'),
         (new.id, 'clientes', 'leitura')
  on conflict (pessoa_id, funcionalidade) do nothing;
  return new;
end $$;
drop trigger if exists chao_da_pessoa on agencia.pessoas;
create trigger chao_da_pessoa
  after insert on agencia.pessoas
  for each row execute function agencia_app.chao_da_pessoa();
create policy "ver squads da pessoa" on agencia.pessoa_squads
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer squads da pessoa" on agencia.pessoa_squads
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "entrar nos proprios squads" on agencia.pessoa_squads
  for insert to authenticated
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "ver a carteira" on agencia.squad_clientes
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer a carteira" on agencia.squad_clientes
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver acessos de funcionalidade" on agencia.acessos_funcionalidade
  for select to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_abrir('admin')));
create policy "mexer acessos de funcionalidade" on agencia.acessos_funcionalidade
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver excecoes de cliente" on agencia.acessos_cliente
  for select to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_abrir('admin')));
create policy "mexer excecoes de cliente" on agencia.acessos_cliente
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver cliente" on agencia.clientes
  for select to authenticated using ((select agencia_app.pode_ver_cliente(id)));
create policy "editar cliente" on agencia.clientes
  for update to authenticated
  using ((select agencia_app.pode_escrever_cliente(id)))
  with check ((select agencia_app.pode_escrever_cliente(id)));
create policy "criar cliente" on agencia.clientes
  for insert to authenticated with check ((select agencia_app.pode_usar('clientes')));
create policy "apagar cliente" on agencia.clientes
  for delete to authenticated using ((select agencia_app.pode_usar('admin')));
create policy "ver contrato" on agencia.contratos
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "mexer contrato" on agencia.contratos
  for all to authenticated
  using ((select agencia_app.pode_escrever_cliente(cliente_id)))
  with check ((select agencia_app.pode_escrever_cliente(cliente_id)));
create policy "ver okrs" on agencia.okrs
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "mexer okrs" on agencia.okrs
  for all to authenticated
  using ((select agencia_app.pode_escrever_cliente(cliente_id)))
  with check ((select agencia_app.pode_escrever_cliente(cliente_id)));
create policy "ver resultados" on agencia.resultados_chave
  for select to authenticated using (exists (
    select 1 from agencia.okrs o
     where o.id = okr_id and (select agencia_app.pode_ver_cliente(o.cliente_id))));
create policy "mexer resultados" on agencia.resultados_chave
  for all to authenticated using (exists (
    select 1 from agencia.okrs o
     where o.id = okr_id and (select agencia_app.pode_escrever_cliente(o.cliente_id))))
  with check (exists (
    select 1 from agencia.okrs o
     where o.id = okr_id and (select agencia_app.pode_escrever_cliente(o.cliente_id))));
create policy "ver entregaveis" on agencia.entregaveis
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "mexer entregaveis" on agencia.entregaveis
  for all to authenticated
  using ((select agencia_app.pode_escrever_cliente(cliente_id)))
  with check ((select agencia_app.pode_escrever_cliente(cliente_id)));
create policy "ver demandas" on agencia.demandas
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "mexer demandas" on agencia.demandas
  for all to authenticated
  using ((select agencia_app.pode_escrever_cliente(cliente_id)))
  with check ((select agencia_app.pode_escrever_cliente(cliente_id)));
create policy "ver documentos" on agencia.documentos
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "mexer documentos" on agencia.documentos
  for all to authenticated
  using ((select agencia_app.pode_escrever_cliente(cliente_id)))
  with check ((select agencia_app.pode_escrever_cliente(cliente_id)));
create policy "ver regras" on agencia.regras
  for select to authenticated using (
    case when cliente_id is not null
         then (select agencia_app.pode_ver_cliente(cliente_id))
         else (select agencia_app.pode_abrir_projeto(projeto_id)) end);
create policy "mexer regras" on agencia.regras
  for all to authenticated using (
    case when cliente_id is not null
         then (select agencia_app.pode_escrever_cliente(cliente_id))
         else (select agencia_app.pode_abrir_projeto(projeto_id)) end)
  with check (
    case when cliente_id is not null
         then (select agencia_app.pode_escrever_cliente(cliente_id))
         else (select agencia_app.pode_abrir_projeto(projeto_id)) end);
create policy "ver projeto" on agencia.projetos
  for select to authenticated using ((select agencia_app.pode_abrir_projeto(id)));
create policy "criar projeto" on agencia.projetos
  for insert to authenticated
  with check (criado_por_id = (select agencia_app.pessoa_id()) and (select agencia_app.pode_usar('projetos')));
create policy "editar projeto" on agencia.projetos
  for update to authenticated
  using ((select agencia_app.pode_abrir_projeto(id)))
  with check ((select agencia_app.pode_abrir_projeto(id)));
create policy "apagar projeto" on agencia.projetos
  for delete to authenticated using (criado_por_id = (select agencia_app.pessoa_id()));
create policy "ver compartilhamento com squad" on agencia.projeto_squads
  for select to authenticated using ((select agencia_app.pode_abrir_projeto(projeto_id)));
create policy "compartilhar com squad" on agencia.projeto_squads
  for all to authenticated
  using ((select agencia_app.eh_dono_do_projeto(projeto_id)))
  with check ((select agencia_app.eh_dono_do_projeto(projeto_id)));
create policy "ver compartilhamento com pessoa" on agencia.projeto_pessoas
  for select to authenticated using ((select agencia_app.pode_abrir_projeto(projeto_id)));
create policy "compartilhar com pessoa" on agencia.projeto_pessoas
  for all to authenticated
  using ((select agencia_app.eh_dono_do_projeto(projeto_id)))
  with check ((select agencia_app.eh_dono_do_projeto(projeto_id)));
create policy "ver anexos" on agencia.anexos
  for select to authenticated using (
    case when projeto_id is not null
         then (select agencia_app.pode_abrir_projeto(projeto_id))
         else (select agencia_app.pode_ver_sessao(sessao_id)) end);
create policy "mexer anexos" on agencia.anexos
  for all to authenticated using (
    case when projeto_id is not null
         then (select agencia_app.pode_abrir_projeto(projeto_id))
         else (select agencia_app.minha_sessao(sessao_id)) end)
  with check (
    case when projeto_id is not null
         then (select agencia_app.pode_abrir_projeto(projeto_id))
         else (select agencia_app.minha_sessao(sessao_id)) end);
create policy "ver fontes" on agencia.fontes_mercado
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer fontes" on agencia.fontes_mercado
  for all to authenticated using ((select agencia_app.pode_usar('mercado')))
  with check ((select agencia_app.pode_usar('mercado')));
create policy "ver leituras" on agencia.leituras
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create or replace function agencia_app.anotar_leitura_da_fonte(p_fonte text, p_erro text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not agencia_app.pode_abrir('mercado') then
    raise exception 'Sem acesso à inteligência de mercado.';
  end if;
  update agencia.fontes_mercado
     set ultima_leitura = now(), ultimo_erro = p_erro
   where id = p_fonte;
end $$;
revoke all on function agencia_app.anotar_leitura_da_fonte(text, text) from public;
grant execute on function agencia_app.anotar_leitura_da_fonte(text, text) to authenticated;
create policy "acrescentar leitura" on agencia.leituras
  for insert to authenticated with check ((select agencia_app.pode_abrir('mercado')));
create policy "corrigir leitura" on agencia.leituras
  for update to authenticated using ((select agencia_app.pode_usar('mercado')))
  with check ((select agencia_app.pode_usar('mercado')));
create policy "apagar leitura" on agencia.leituras
  for delete to authenticated using ((select agencia_app.pode_usar('mercado')));
create policy "ver agentes" on agencia.agentes
  for select to authenticated using (
    (espaco_id = 'geral'
     or (select agencia_app.pode_ver_espaco(espaco_id))
     or exists (select 1 from agencia.acessos_agente aa
                 where aa.agente_id = id and (select agencia_app.pode_ver_espaco(aa.espaco_id))))
    and (not beta or (select agencia_app.beta_liberado())));
create policy "mexer agentes" on agencia.agentes
  for all to authenticated
  using ((select agencia_app.pode_usar('agentes')) and (select agencia_app.pode_escrever_espaco(espaco_id)))
  with check ((select agencia_app.pode_usar('agentes')) and (select agencia_app.pode_escrever_espaco(espaco_id)));
create policy "ver emprestimo de agente" on agencia.acessos_agente
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer emprestimo de agente" on agencia.acessos_agente
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
create policy "ver skills" on agencia.skills
  for select to authenticated using ((select agencia_app.pode_ver_espaco(espaco_id)));
create policy "mexer skills" on agencia.skills
  for all to authenticated
  using ((select agencia_app.pode_usar('skills')) and (select agencia_app.pode_escrever_espaco(espaco_id)))
  with check ((select agencia_app.pode_usar('skills')) and (select agencia_app.pode_escrever_espaco(espaco_id)));
create policy "minhas instalacoes" on agencia.instalacoes_skill
  for all to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()))
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "ver sessoes" on agencia.sessoes
  for select to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_ver_espaco(espaco_id)));
create policy "mexer nas proprias sessoes" on agencia.sessoes
  for all to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()))
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "ver mensagens" on agencia.mensagens
  for select to authenticated using ((select agencia_app.pode_ver_sessao(sessao_id)));
create policy "escrever mensagens" on agencia.mensagens
  for all to authenticated
  using ((select agencia_app.minha_sessao(sessao_id)))
  with check ((select agencia_app.minha_sessao(sessao_id)));
create policy "ver agendamentos" on agencia.crons
  for select to authenticated
  using (dono_id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_ver_espaco(espaco_id)));
create policy "mexer agendamentos" on agencia.crons
  for all to authenticated
  using (dono_id = (select agencia_app.pessoa_id()) and (select agencia_app.pode_usar('crons')))
  with check (dono_id = (select agencia_app.pessoa_id()) and (select agencia_app.pode_usar('crons')));
create policy "ver inventario de chaves" on agencia.chaves_api
  for select to authenticated
  using ((select agencia_app.eh_admin()) or (select agencia_app.pode_ver_espaco(espaco_id)));
create policy "mexer chaves" on agencia.chaves_api
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver concessoes" on agencia.concessoes
  for select to authenticated
  using ((select agencia_app.eh_admin()) or (select agencia_app.pode_ver_espaco(espaco_id)));
create policy "mexer concessoes" on agencia.concessoes
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver conectores" on agencia.conectores
  for select to authenticated using ((select agencia_app.pode_abrir('admin')));
create policy "mexer conectores" on agencia.conectores
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ver egresso" on agencia.regras_egress
  for select to authenticated using ((select agencia_app.pode_abrir('admin')));
create policy "mexer egresso" on agencia.regras_egress
  for all to authenticated using ((select agencia_app.pode_usar('admin')))
  with check ((select agencia_app.pode_usar('admin')));
create policy "ler auditoria" on agencia.auditoria
  for select to authenticated using ((select agencia_app.pode_abrir('admin')));
create policy "registrar auditoria" on agencia.auditoria
  for insert to authenticated with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "minhas reunioes" on agencia.reunioes
  for all to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()))
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "minhas notas" on agencia.notas_do_dia
  for all to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()))
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "meus emails" on agencia.emails_resumidos
  for all to authenticated
  using (pessoa_id = (select agencia_app.pessoa_id()))
  with check (pessoa_id = (select agencia_app.pessoa_id()));
create policy "ver tarefas" on agencia.tarefas_runrun
  for select to authenticated
  using (responsavel_id = (select agencia_app.pessoa_id()) or (select agencia_app.pode_abrir('gestao')));
create policy "mexer nas minhas tarefas" on agencia.tarefas_runrun
  for all to authenticated
  using (responsavel_id = (select agencia_app.pessoa_id()))
  with check (responsavel_id = (select agencia_app.pessoa_id()));
create policy "ver fichas de quem lidero" on agencia.fichas_pessoa
  for select to authenticated
  using ((select agencia_app.eh_admin()) or (select agencia_app.lidero(pessoa_id)));
create policy "escrever fichas de quem lidero" on agencia.fichas_pessoa
  for all to authenticated
  using (((select agencia_app.eh_admin()) or (select agencia_app.lidero(pessoa_id)))
         and (select agencia_app.pode_usar('gestao')))
  with check (((select agencia_app.eh_admin()) or (select agencia_app.lidero(pessoa_id)))
              and (select agencia_app.pode_usar('gestao')));
create policy "ver vagas" on agencia.vagas
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer vagas" on agencia.vagas
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver canais" on agencia.canais_recrutamento
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer canais" on agencia.canais_recrutamento
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver candidatos" on agencia.candidatos
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer candidatos" on agencia.candidatos
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver entregas" on agencia.entregas
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer entregas" on agencia.entregas
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver equipamentos" on agencia.equipamentos
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer equipamentos" on agencia.equipamentos
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver desejos" on agencia.desejos_equipamento
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer desejos" on agencia.desejos_equipamento
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver assinaturas" on agencia.assinaturas
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer assinaturas" on agencia.assinaturas
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver fornecedores" on agencia.fornecedores
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer fornecedores" on agencia.fornecedores
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
create policy "ver periodos" on agencia.periodos_trabalho
  for select to authenticated using ((select agencia_app.pode_abrir('gestao')));
create policy "mexer periodos" on agencia.periodos_trabalho
  for all to authenticated using ((select agencia_app.pode_usar('gestao')))
  with check ((select agencia_app.pode_usar('gestao')));
grant select on agencia.espacos, agencia.squads to anon;
create policy "ver areas sem login" on agencia.espacos
  for select to anon using (true);
create policy "ver squads sem login" on agencia.squads
  for select to anon using (true);
grant usage on schema agencia_app to authenticated;
grant execute on all functions in schema agencia_app to authenticated;
alter table agencia.produtos enable row level security;
create policy "ver produtos" on agencia.produtos
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer produtos" on agencia.produtos
  for all to authenticated using ((select agencia_app.pode_usar('produtos')))
  with check ((select agencia_app.pode_usar('produtos')));
alter table agencia.cliente_conhecimento enable row level security;
create policy "conhecimento: quem vê a conta" on agencia.cliente_conhecimento
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "conhecimento: quem edita a conta" on agencia.cliente_conhecimento
  for all to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)))
  with check ((select agencia_app.pode_ver_cliente(cliente_id)));
drop policy if exists "conhecimento: ler arquivo"    on storage.objects;
drop policy if exists "conhecimento: subir arquivo"  on storage.objects;
drop policy if exists "conhecimento: apagar arquivo" on storage.objects;
create policy "conhecimento: ler arquivo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'conhecimento'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
create policy "conhecimento: subir arquivo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'conhecimento'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
create policy "conhecimento: apagar arquivo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'conhecimento'
    and (select agencia_app.pode_ver_cliente((storage.foldername(name))[1]))
  );
alter table agencia.cliente_identidade     enable row level security;
alter table agencia.cliente_marca_arquivo  enable row level security;
create policy "identidade: quem vê a conta" on agencia.cliente_identidade
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "identidade: quem edita a conta" on agencia.cliente_identidade
  for all to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)))
  with check ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "marca: quem vê a conta" on agencia.cliente_marca_arquivo
  for select to authenticated using ((select agencia_app.pode_ver_cliente(cliente_id)));
create policy "marca: quem edita a conta" on agencia.cliente_marca_arquivo
  for all to authenticated
  using ((select agencia_app.pode_ver_cliente(cliente_id)))
  with check ((select agencia_app.pode_ver_cliente(cliente_id)));
alter table agencia.blog_ajustes enable row level security;
alter table agencia.blog_posts  enable row level security;
drop policy if exists "ver ajustes de blog" on agencia.blog_ajustes;
drop policy if exists "mexer ajustes de blog" on agencia.blog_ajustes;
drop policy if exists "ver posts de blog" on agencia.blog_posts;
drop policy if exists "mexer posts de blog" on agencia.blog_posts;
create policy "ver ajustes de blog" on agencia.blog_ajustes
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer ajustes de blog" on agencia.blog_ajustes
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
create policy "ver posts de blog" on agencia.blog_posts
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer posts de blog" on agencia.blog_posts
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
alter table agencia.blog_meses enable row level security;
drop policy if exists "ver meses de blog" on agencia.blog_meses;
drop policy if exists "mexer meses de blog" on agencia.blog_meses;
create policy "ver meses de blog" on agencia.blog_meses
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer meses de blog" on agencia.blog_meses
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
drop policy if exists "retratos: ver"     on storage.objects;
drop policy if exists "retratos: subir"   on storage.objects;
drop policy if exists "retratos: trocar"  on storage.objects;
drop policy if exists "retratos: apagar"  on storage.objects;
create policy "retratos: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'retratos' and (select agencia_app.pessoa_id()) is not null);
create policy "retratos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'retratos'
    and (
      name = 'pessoa/' || (select agencia_app.pessoa_id()) || substring(name from '\.[^.]*$')
      or (select agencia_app.eh_admin())
    )
  );
create policy "retratos: trocar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'retratos'
    and (
      name = 'pessoa/' || (select agencia_app.pessoa_id()) || substring(name from '\.[^.]*$')
      or (select agencia_app.eh_admin())
    )
  );
create policy "retratos: apagar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'retratos' and (select agencia_app.eh_admin()));
create or replace function agencia.renomear_agente(p_id text, p_nome text)
returns text
language plpgsql
security definer
set search_path = public, agencia_app, pg_temp
as $$
declare
  limpo text := btrim(p_nome);
begin
  if not agencia_app.eh_lideranca() then
    raise exception 'Só a liderança troca o nome de um agente.' using errcode = '42501';
  end if;
  if limpo = '' then
    raise exception 'O agente precisa de um nome.';
  end if;
  if char_length(limpo) > 60 then
    raise exception 'O nome do agente passa de 60 caracteres.';
  end if;
  update agencia.agentes set nome = limpo where id = p_id;
  if not found then
    raise exception 'Este agente ainda não está no banco. Reaplique o 03-carga.sql e tente de novo.';
  end if;
  return limpo;
end;
$$;
revoke all on function agencia.renomear_agente(text, text) from public;
grant execute on function agencia.renomear_agente(text, text) to authenticated;
create policy "registrar aviso do sistema" on agencia.avisos_sistema
  for insert to authenticated with check (true);
create policy "atualizar aviso do sistema" on agencia.avisos_sistema
  for update to authenticated using (true) with check (true);
create policy "limpar aviso do sistema" on agencia.avisos_sistema
  for delete to authenticated using (true);
alter table agencia.uso_de_ia enable row level security;
drop policy if exists "registrar uso de ia" on agencia.uso_de_ia;
drop policy if exists "ver uso de ia" on agencia.uso_de_ia;
create policy "registrar uso de ia" on agencia.uso_de_ia
  for insert to authenticated with check ((select agencia_app.pessoa_id()) is not null);
create policy "ver uso de ia" on agencia.uso_de_ia
  for select to authenticated using ((select agencia_app.pode_abrir('admin')));
alter table agencia.redes_conteudo_meses enable row level security;
alter table agencia.redes_conteudo_temas enable row level security;
drop policy if exists "ver meses de conteudo" on agencia.redes_conteudo_meses;
drop policy if exists "mexer meses de conteudo" on agencia.redes_conteudo_meses;
drop policy if exists "ver temas de conteudo" on agencia.redes_conteudo_temas;
drop policy if exists "mexer temas de conteudo" on agencia.redes_conteudo_temas;
create policy "ver meses de conteudo" on agencia.redes_conteudo_meses
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer meses de conteudo" on agencia.redes_conteudo_meses
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
create policy "ver temas de conteudo" on agencia.redes_conteudo_temas
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
create policy "mexer temas de conteudo" on agencia.redes_conteudo_temas
  for all to authenticated using ((select agencia_app.pode_usar('agentes')))
  with check ((select agencia_app.pode_usar('agentes')));
grant all on all tables in schema agencia to service_role;
grant all on all functions in schema agencia_app to service_role;
grant all on all functions in schema agencia to service_role;
alter role authenticator set pgrst.db_schemas = 'public, agencia';
notify pgrst, 'reload config';