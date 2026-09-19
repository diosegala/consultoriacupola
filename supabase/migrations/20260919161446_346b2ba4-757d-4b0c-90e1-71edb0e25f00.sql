INSERT INTO agencia.pessoas (id, auth_id, nome, email, iniciais, funcao, area_id, papel, ativa, espaco_de_trabalho_liberado)
VALUES ('dioner', '4c08669f-2ba0-4409-8e4f-28c78e34b5df', 'Dioner Segala', 'dioner.segala@cupola.com.br', 'DS', 'Direção', 'geral', 'admin', true, true)
ON CONFLICT (id) DO UPDATE SET auth_id = EXCLUDED.auth_id, papel='admin', ativa=true;