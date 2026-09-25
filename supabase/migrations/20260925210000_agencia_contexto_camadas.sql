-- Camada de contexto da CUPOLA (porte de 06-contexto-e-arquivamento.sql, parte 1).
-- O que a casa é, antes de qualquer conta: entra em toda conversa de todo agente.
-- Seguro para rodar mais de uma vez.

create table if not exists agencia.contexto_camadas (
  escopo text primary key,
  -- Vai em toda conversa. Curta de propósito: texto que entra em todo pedido é cobrado todo dia.
  essencia text not null default '',
  -- Tom de voz, pessoa gramatical e palavras proibidas. Entra em quem escreve.
  escrita text not null default '',
  atualizado_em timestamptz not null default now(),
  atualizado_por text references agencia.pessoas (id)
);

alter table agencia.contexto_camadas enable row level security;

-- Todo mundo da agência lê: a camada viaja no pedido de qualquer conversa.
drop policy if exists "ver as camadas de contexto" on agencia.contexto_camadas;
create policy "ver as camadas de contexto" on agencia.contexto_camadas
  for select to authenticated using ((select agencia_app.pessoa_id()) is not null);

-- Ninguém escreve direto (sem policy de insert/update): a gravação passa pela
-- função abaixo, que confere a liderança. Uma frase trocada aqui muda o que sai
-- para todos os clientes.
create or replace function agencia.salvar_camada_contexto(
  p_escopo text, p_essencia text, p_escrita text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not agencia_app.eh_lideranca() then
    raise exception 'Só a liderança edita o contexto da casa.' using errcode = '42501';
  end if;
  if p_escopo is null or btrim(p_escopo) = '' then
    raise exception 'Informe o escopo da camada.';
  end if;
  if p_essencia is null or btrim(p_essencia) = '' then
    raise exception 'A essência não pode ficar em branco: ela entra em toda conversa.';
  end if;
  -- Este texto viaja em todo pedido que vai para a IA: dez mil caracteres já são
  -- umas quatro páginas em cada conversa de cada pessoa.
  if char_length(p_essencia) > 10000 or char_length(coalesce(p_escrita, '')) > 20000 then
    raise exception 'Texto longo demais para uma camada de contexto.';
  end if;

  insert into agencia.contexto_camadas (escopo, essencia, escrita, atualizado_em, atualizado_por)
  values (btrim(p_escopo), p_essencia, coalesce(p_escrita, ''), now(), agencia_app.pessoa_id())
  on conflict (escopo) do update
    set essencia = excluded.essencia,
        escrita = excluded.escrita,
        atualizado_em = now(),
        atualizado_por = excluded.atualizado_por;
end;
$$;

revoke all on function agencia.salvar_camada_contexto(text, text, text) from public, anon;
grant execute on function agencia.salvar_camada_contexto(text, text, text) to authenticated;
