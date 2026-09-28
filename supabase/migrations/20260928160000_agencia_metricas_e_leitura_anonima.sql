-- Métricas da agência com o uso novo, e fim da leitura sem login de áreas e squads.
-- Seguro para rodar mais de uma vez; não apaga nem altera dado de negócio.

-- ===========================================================================
-- 1. Uso de IA para Gestão → Métricas
-- ===========================================================================
-- A aba lia só agencia.uso_de_ia, que é o histórico importado do CupolaOS
-- (até 24/09/2026). O uso deste sistema é gravado pelas edge functions em
-- public.ai_usage_logs (unidade = 'agencia'), que só os admins da consultoria
-- leem. Esta função junta as duas fontes com a mesma regra de leitura do
-- histórico (acesso a "admin" na agência). Sem quebra por pessoa, de propósito.
-- Devolve os totais já agrupados (agente × conta × modelo): a tela soma poucas
-- linhas, e o limite de linhas por consulta da API nunca corta o período.
create or replace function agencia.uso_ia_desde(p_desde timestamptz)
returns table (
  agente text,
  cliente_id text,
  modelo text,
  chamadas bigint,
  custo numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not agencia_app.pode_abrir('admin') then
    raise exception 'Só a administração da agência vê o uso de IA.' using errcode = '42501';
  end if;
  return query
    select t.agente, t.cliente_id, t.modelo, count(*), coalesce(sum(t.custo), 0)
      from (
        select u.agente, u.cliente_id, u.modelo, u.custo
          from agencia.uso_de_ia u
         where u.quando >= p_desde
        union all
        select coalesce(l.agente_slug, l.agente_tipo), l.agencia_cliente_id, l.model, l.cost_usd
          from public.ai_usage_logs l
         where l.unidade = 'agencia'
           and l.created_at >= p_desde
      ) t
     group by 1, 2, 3;
end;
$$;

revoke all on function agencia.uso_ia_desde(timestamptz) from public, anon;
grant execute on function agencia.uso_ia_desde(timestamptz) to authenticated;

-- ===========================================================================
-- 2. Sem leitura anônima de áreas e squads
-- ===========================================================================
-- No original, a tela de cadastro listava áreas e squads antes do login. Aqui não
-- há autocadastro na agência (20260925200000_endurecimento_agencia.sql) e o anônimo
-- nem tem acesso ao schema; as permissões ficaram sobrando e virariam brecha no dia
-- em que alguém liberasse o schema.
drop policy if exists "ver areas sem login" on agencia.espacos;
drop policy if exists "ver squads sem login" on agencia.squads;
revoke select on agencia.espacos, agencia.squads from anon;
