-- Ficha de administração da agência para o Dioner.
-- O login é procurado pelo e-mail no banco onde a migration roda: o id de auth.users
-- muda entre o Teste e a produção do Lovable (a versão anterior tinha o id do Teste
-- escrito à mão, e falharia na publicação). Sem login ainda, a ficha nasce solta e
-- o gatilho agencia_app.ao_criar_usuario liga quando ele entrar.
INSERT INTO agencia.pessoas (id, auth_id, nome, email, iniciais, funcao, area_id, papel, ativa, espaco_de_trabalho_liberado)
VALUES (
  'dioner',
  (SELECT id FROM auth.users WHERE lower(email) = 'dioner.segala@cupola.com.br' LIMIT 1),
  'Dioner Segala', 'dioner.segala@cupola.com.br', 'DS', 'Direção', 'geral', 'admin', true, true
)
ON CONFLICT (id) DO UPDATE SET auth_id = coalesce(EXCLUDED.auth_id, agencia.pessoas.auth_id), papel = 'admin', ativa = true;
