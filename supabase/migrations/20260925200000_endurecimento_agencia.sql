-- Endurecimento da Agência: devolve ao porte as garantias do CupolaOS original.
-- Seguro para rodar mais de uma vez; não apaga nem altera dado de negócio.

-- 1. Ligação login → ficha só para endereços da Cupola.
--    O original recusava qualquer e-mail fora de @cupola.com.br no cadastro. Aqui o
--    mesmo auth.users atende a consultoria, então não recusamos o login: só não ligamos
--    a ficha da agência a endereço de fora.
create or replace function agencia_app.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email, '')) !~ '^[^@]+@cupola\.com\.br$' then
    return new;
  end if;
  update agencia.pessoas
     set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null;
  return new;
end $$;

-- 2. Sem autocadastro na Agência. Fichas nascem pela gestão do time ("cadastrar pessoa",
--    só admin). No original a política existia porque o domínio era barrado no login;
--    aqui qualquer usuário da consultoria conseguia virar analista e ganhar o "chão".
drop policy if exists "criar a propria ficha" on agencia.pessoas;

-- 3. Sem entrar sozinho num squad (sugestão #3 do Giuliano). Membros e carteira dos
--    squads mudam só pela gestão ("mexer squads da pessoa", admin).
drop policy if exists "entrar nos proprios squads" on agencia.pessoa_squads;

-- 4. Religar o login quando a administração corrige o e-mail da ficha
--    (porte de 09-amarrar-login-ao-corrigir-email.sql). Ficha já ligada não é tocada.
create or replace function agencia_app.amarrar_login_ao_corrigir_email() returns trigger
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.auth_id is null and lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then
    update agencia.pessoas p
       set auth_id = u.id
      from auth.users u
     where p.id = new.id
       and p.auth_id is null
       and lower(u.email) = lower(new.email);
  end if;
  return new;
end $$;
revoke all on function agencia_app.amarrar_login_ao_corrigir_email() from public, anon, authenticated;

drop trigger if exists amarrar_login_ao_corrigir_email on agencia.pessoas;
create trigger amarrar_login_ao_corrigir_email
  after update of email on agencia.pessoas
  for each row execute function agencia_app.amarrar_login_ao_corrigir_email();

-- 5. Colunas de uso de IA por unidade já existem no banco, mas nunca vieram em migration.
alter table public.ai_usage_logs
  add column if not exists unidade text not null default 'consultoria',
  add column if not exists agente_slug text,
  add column if not exists agencia_cliente_id text,
  add column if not exists agencia_pessoa_id text,
  add column if not exists sessao_id text;

-- 6. Buckets privados da Agência (as políticas já existem; os buckets não vinham em migration).
insert into storage.buckets (id, name, public) values
  ('conhecimento', 'conhecimento', false),
  ('retratos', 'retratos', false),
  ('agencia-pecas', 'agencia-pecas', false)
on conflict (id) do nothing;
