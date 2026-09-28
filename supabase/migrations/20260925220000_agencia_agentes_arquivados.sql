-- Arquivar agente (porte de 06-contexto-e-arquivamento.sql, parte 2).
-- Tira o agente do catálogo sem apagar: o histórico de sessões continua com o nome dele.
-- Nasce vazia de propósito: os arquivamentos do original não foram importados,
-- a gestão decide do zero o que sai do catálogo. Seguro para rodar mais de uma vez.

create table if not exists agencia.agentes_arquivados (
  agente_id text primary key references agencia.agentes (id) on delete cascade,
  arquivado_em timestamptz not null default now(),
  arquivado_por text references agencia.pessoas (id) on delete set null
);

grant select on agencia.agentes_arquivados to authenticated;
grant all on agencia.agentes_arquivados to service_role;
alter table agencia.agentes_arquivados enable row level security;

-- Todo mundo da agência lê: é o que faz o agente arquivado sumir do catálogo.
drop policy if exists "ver agentes arquivados" on agencia.agentes_arquivados;
create policy "ver agentes arquivados" on agencia.agentes_arquivados
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);

-- Ninguém escreve direto (sem policy de insert/delete): tirar um agente do
-- catálogo muda a tela de todo mundo, então passa pela função, que confere a liderança.
create or replace function agencia.arquivar_agente(p_id text, p_arquivado boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not agencia_app.eh_lideranca() then
    raise exception 'Só a liderança arquiva um agente.' using errcode = '42501';
  end if;
  if p_id is null or btrim(p_id) = '' then
    raise exception 'Informe o agente.';
  end if;

  if coalesce(p_arquivado, false) then
    insert into agencia.agentes_arquivados (agente_id, arquivado_por)
    values (btrim(p_id), agencia_app.pessoa_id())
    on conflict (agente_id) do nothing;
  else
    delete from agencia.agentes_arquivados where agente_id = btrim(p_id);
  end if;
end;
$$;

revoke all on function agencia.arquivar_agente(text, boolean) from public, anon;
grant execute on function agencia.arquivar_agente(text, boolean) to authenticated;
