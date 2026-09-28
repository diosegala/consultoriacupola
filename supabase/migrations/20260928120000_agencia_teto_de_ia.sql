-- Teto de gasto de IA da Agência (porte de 07-limite-de-chat.sql do CupolaOS).
--
-- O teto é mensal, em dólares, por área e por pessoa, em duas portas:
--   conversa — a conversa com os agentes (agencia-conversar);
--   geracao  — o resto: blog, redes, news, ficha, áudio, mercado.
-- Conversa é gasto miúdo e contínuo; geração é gasto em lote. Um número só faria
-- o chat travar por causa de um lote de imagens, e o contrário também.
--
-- Sem linha na tabela = sem limite. Admin define o teto de qualquer área ou pessoa;
-- o gestor só aperta o da própria área (nunca afrouxa) e distribui entre as pessoas dela.
--
-- Também corrige a auditoria, que recusava todas as ações da Gestão (a lista de
-- ações aceitas não tinha nenhuma delas), e fecha os avisos do sistema, que
-- qualquer usuário logado podia alterar ou apagar.
-- Seguro para rodar mais de uma vez; não apaga nem altera dado de negócio.

-- ===========================================================================
-- 1. Auditoria: as ações que a Gestão grava, mais as do teto
-- ===========================================================================
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
  'sessao.criada', 'sessao.renomeada', 'sessao.arquivada', 'sessao.excluida', 'sessao.movida',
  'senha.revelada',
  -- Gestão da agência (src/hooks/agencia/useAgenciaGestao.ts)
  'squad.criado', 'squad.alterado',
  'squad.membro.incluido', 'squad.membro.removido',
  'squad.carteira.incluido', 'squad.carteira.removido',
  'agente.acesso.liberado', 'agente.acesso.removido',
  'agente.arquivado', 'agente.devolvido',
  'contexto.alterado',
  -- Teto de IA (gravadas pela função definir_limite_ia, não pela tela)
  'limite.definido', 'limite.removido'
));

-- ===========================================================================
-- 2. Avisos do sistema: só a liderança lê, e ninguém escreve direto
-- ===========================================================================
-- O aviso dos 80% nasce dentro de limite_ia(), que roda como dona da tabela.
-- Nenhuma tela grava aviso; as políticas abertas (using true) permitiam a
-- qualquer usuário logado, até da consultoria, alterar ou apagar os avisos.
drop policy if exists "registrar aviso do sistema" on agencia.avisos_sistema;
drop policy if exists "atualizar aviso do sistema" on agencia.avisos_sistema;
drop policy if exists "limpar aviso do sistema" on agencia.avisos_sistema;

-- ===========================================================================
-- 3. A tabela dos tetos
-- ===========================================================================
create table if not exists agencia.limites_ia (
  -- 'area:<id do espaço>' ou 'pessoa:<id da pessoa>'.
  escopo text not null check (escopo ~ '^(area|pessoa):[A-Za-z0-9._-]+$'),
  porta text not null check (porta in ('conversa', 'geracao')),
  -- Dólares no mês corrente. Zero é teto legítimo: "não usa".
  teto_usd numeric(10, 2) not null check (teto_usd >= 0),
  definido_em timestamptz not null default now(),
  definido_por text references agencia.pessoas (id) on delete set null,
  primary key (escopo, porta)
);

grant select on agencia.limites_ia to authenticated;
grant all on agencia.limites_ia to service_role;
alter table agencia.limites_ia enable row level security;

-- Todo mundo da agência lê: quem está perto do teto precisa ver o teto.
drop policy if exists "ver limites de ia" on agencia.limites_ia;
create policy "ver limites de ia" on agencia.limites_ia
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);
-- Escrever, só pela função abaixo.

-- O gasto do mês é somado a cada chamada paga; sem índice vira varredura da tabela inteira.
create index if not exists ai_usage_logs_agencia_pessoa_idx
  on public.ai_usage_logs (agencia_pessoa_id, created_at)
  where unidade = 'agencia';

-- ===========================================================================
-- 4. Definir, alterar e tirar o teto
-- ===========================================================================
-- `p_teto` nulo apaga a linha: a área ou pessoa volta a não ter limite.
-- Cada mudança fica na auditoria com o valor de antes e o de depois.
create or replace function agencia.definir_limite_ia(
  p_escopo text, p_teto numeric, p_porta text default 'conversa'
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_eu text := agencia_app.pessoa_id();
  v_tipo text;
  v_alvo text;
  v_atual numeric;
  v_area_da_pessoa text;
  v_nome text;
  v_brl text;
begin
  if v_eu is null then
    raise exception 'Você não tem acesso à Agência.' using errcode = '42501';
  end if;
  if p_escopo is null or p_escopo !~ '^(area|pessoa):[A-Za-z0-9._-]+$' then
    raise exception 'Escopo inválido. Use "area:<id>" ou "pessoa:<id>".';
  end if;
  if p_porta is null or p_porta not in ('conversa', 'geracao') then
    raise exception 'Porta inválida. Use "conversa" ou "geracao".';
  end if;
  if p_teto is not null and (p_teto < 0 or p_teto > 100000) then
    raise exception 'Informe um teto entre 0 e 100000 dólares, ou deixe em branco para não ter limite.';
  end if;

  v_tipo := split_part(p_escopo, ':', 1);
  v_alvo := split_part(p_escopo, ':', 2);
  select teto_usd into v_atual from agencia.limites_ia where escopo = p_escopo and porta = p_porta;

  if v_tipo = 'area' then
    select nome into v_nome from agencia.espacos where id = v_alvo and tipo = 'area';
    if v_nome is null then
      raise exception 'Área não encontrada.';
    end if;
    -- Admin define à vontade. Gestor só aperta o da própria área: subir é orçamento.
    if not agencia_app.eh_admin() then
      if not (agencia_app.eh_lideranca() and v_alvo = agencia_app.minha_area()) then
        raise exception 'Só a administração define o teto de uma área.' using errcode = '42501';
      end if;
      if v_atual is null then
        raise exception 'Esta área está sem limite. Só a administração define o primeiro teto.' using errcode = '42501';
      end if;
      if p_teto is null then
        raise exception 'Tirar o limite é decisão da administração.' using errcode = '42501';
      end if;
      if p_teto > v_atual then
        raise exception 'O gestor pode baixar o teto da própria área, não aumentar. Peça à administração.' using errcode = '42501';
      end if;
    end if;
  else
    select area_id, nome into v_area_da_pessoa, v_nome from agencia.pessoas where id = v_alvo;
    if v_area_da_pessoa is null then
      raise exception 'Pessoa não encontrada.';
    end if;
    if not agencia_app.eh_admin() then
      if not (agencia_app.eh_lideranca() and v_area_da_pessoa = agencia_app.minha_area()) then
        raise exception 'Só a liderança da área define o limite de quem trabalha nela.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Nada mudou: não grava nem registra.
  if p_teto is not distinct from v_atual then
    return;
  end if;

  if p_teto is null then
    delete from agencia.limites_ia where escopo = p_escopo and porta = p_porta;
  else
    insert into agencia.limites_ia (escopo, porta, teto_usd, definido_em, definido_por)
    values (p_escopo, p_porta, p_teto, now(), v_eu)
    on conflict (escopo, porta) do update
      set teto_usd = excluded.teto_usd, definido_em = now(), definido_por = excluded.definido_por;
  end if;

  v_brl := case when p_porta = 'conversa' then 'conversa' else 'geração' end || ': '
    || coalesce('US$ ' || replace(to_char(v_atual, 'FM999990.00'), '.', ','), 'sem limite') || ' → '
    || coalesce('US$ ' || replace(to_char(p_teto, 'FM999990.00'), '.', ','), 'sem limite');
  insert into agencia.auditoria (pessoa_id, acao, alvo, detalhe, negado)
  values (v_eu, case when p_teto is null then 'limite.removido' else 'limite.definido' end,
          v_nome, v_brl, false);
end;
$$;

revoke all on function agencia.definir_limite_ia(text, numeric, text) from public, anon;
grant execute on function agencia.definir_limite_ia(text, numeric, text) to authenticated;

-- ===========================================================================
-- 5. A leitura que as edge functions fazem antes de cada chamada paga
-- ===========================================================================
-- Chamada com o token da pessoa. Devolve o gasto do mês (dela e da área dela) e os
-- dois tetos que valem para ela, e cria o aviso dos 80% quando a área cruza a marca.
--
-- O gasto vem de public.ai_usage_logs (o que este sistema gastou na chave do gateway).
-- A porta conversa são as linhas com sessão: só a agencia-conversar grava sessao_id.
-- A área é a atual da pessoa, como no original.
create or replace function agencia.limite_ia(p_porta text default 'conversa')
returns table (
  area_id text,
  gasto_pessoa numeric,
  teto_pessoa numeric,
  gasto_area numeric,
  teto_area numeric
)
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_eu text := agencia_app.pessoa_id();
  v_area text := agencia_app.minha_area();
  v_inicio timestamptz := date_trunc('month', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_gasto_pessoa numeric := 0;
  v_gasto_area numeric := 0;
  v_teto_pessoa numeric;
  v_teto_area numeric;
  v_nome_area text;
begin
  if v_eu is null then
    return;
  end if;
  if p_porta is null or p_porta not in ('conversa', 'geracao') then
    p_porta := 'conversa';
  end if;

  select
    coalesce(sum(u.cost_usd) filter (where u.agencia_pessoa_id = v_eu), 0),
    coalesce(sum(u.cost_usd) filter (where p.area_id = v_area), 0)
    into v_gasto_pessoa, v_gasto_area
    from public.ai_usage_logs u
    left join agencia.pessoas p on p.id = u.agencia_pessoa_id
   where u.unidade = 'agencia'
     and u.created_at >= v_inicio
     and ((p_porta = 'conversa' and u.sessao_id is not null)
       or (p_porta = 'geracao' and u.sessao_id is null));

  select l.teto_usd into v_teto_pessoa from agencia.limites_ia l where l.escopo = 'pessoa:' || v_eu and l.porta = p_porta;
  select l.teto_usd into v_teto_area from agencia.limites_ia l where l.escopo = 'area:' || v_area and l.porta = p_porta;

  -- O aviso dos 80%: um por área, por porta, por mês.
  if v_teto_area is not null and v_teto_area > 0 and v_gasto_area >= v_teto_area * 0.8 then
    select nome into v_nome_area from agencia.espacos where id = v_area;
    insert into agencia.avisos_sistema (id, tom, titulo, detalhe)
    values (
      'teto:' || v_area || ':' || p_porta || ':' || to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM'),
      case when v_gasto_area >= v_teto_area then 'risco' else 'atencao' end,
      coalesce(v_nome_area, v_area) || ' passou de 80% do teto de '
        || case when p_porta = 'conversa' then 'conversa' else 'geração' end,
      'Gasto do mês: US$ ' || replace(to_char(v_gasto_area, 'FM999990.00'), '.', ',')
        || ' de US$ ' || replace(to_char(v_teto_area, 'FM999990.00'), '.', ',')
        || '. Quando chegar ao teto, esta porta para para a área inteira.'
    )
    on conflict (id) do nothing;
  end if;

  return query select v_area, v_gasto_pessoa, v_teto_pessoa, v_gasto_area, v_teto_area;
end;
$$;

revoke all on function agencia.limite_ia(text) from public, anon;
grant execute on function agencia.limite_ia(text) to authenticated;

-- ===========================================================================
-- 6. O gasto do mês por área e por pessoa, para a tela de limites (só liderança)
-- ===========================================================================
create or replace function agencia.gasto_ia_do_mes()
returns table (pessoa_id text, area_id text, porta text, gasto numeric)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not agencia_app.eh_lideranca() then
    raise exception 'Só a liderança vê o gasto das pessoas.' using errcode = '42501';
  end if;
  return query
    select u.agencia_pessoa_id, p.area_id,
           case when u.sessao_id is not null then 'conversa' else 'geracao' end,
           sum(u.cost_usd)
      from public.ai_usage_logs u
      left join agencia.pessoas p on p.id = u.agencia_pessoa_id
     where u.unidade = 'agencia'
       and u.created_at >= date_trunc('month', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
       -- O gestor vê só a própria área; o admin, todas.
       and (agencia_app.eh_admin() or p.area_id = agencia_app.minha_area())
     group by 1, 2, 3;
end;
$$;

revoke all on function agencia.gasto_ia_do_mes() from public, anon;
grant execute on function agencia.gasto_ia_do_mes() to authenticated;
