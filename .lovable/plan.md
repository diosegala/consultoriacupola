# Acesso do Giuliano: admin só da Agência

Objetivo: o Giuliano entra no ambiente de testes (link de pré-visualização), vê apenas a Agência e as Mensagens, e nada disso vai para produção.

## O que muda

1. **Novo tipo de acesso "Agência"**
   Hoje só existem três tipos de acesso: administrador, diretor e consultor — todos veem a consultoria. Será criado um quarto tipo, "Agência", que dá acesso somente às telas da Agência e ao chat interno.

2. **Menu e navegação**
   Para quem tem esse acesso, o menu lateral mostra apenas: Contas, Agentes, Mercado, Time e Mensagens. Ao abrir qualquer endereço da consultoria (painel, clientes, contratos, reuniões, configurações etc.), a pessoa é levada de volta para a lista de Contas.

3. **Criação do usuário na tela**
   Na página de Configurações, ao criar um usuário, o administrador passa a poder escolher "Agência" além de consultor e diretor. O Giuliano recebe e-mail e senha temporária e troca a senha no primeiro acesso, como os demais.

4. **Ficha dele na Agência**
   Será criada a ficha do Giuliano em Agência → Time, marcada como ativa e com perfil de administração da Agência, ligada ao login criado. Assim ele administra contas, agentes, time e mercado.

5. **Fora do alcance dele**
   As integrações e configurações da plataforma continuam restritas a administradores da consultoria.

## Como ele acessa sem produção

Depois de aplicado, você recebe o link de pré-visualização do ambiente de desenvolvimento e o repassa junto com o e-mail e a senha temporária. Nada precisa ser publicado; a consultoria em produção segue intocada.

## Detalhes técnicos

- Migração: novo valor `agencia` no enum `app_role`. Políticas existentes que usam `has_role`/`is_authorized_user` continuam válidas; conferir se `is_authorized_user` deve retornar verdadeiro para esse papel apenas no necessário ao chat (`chat_*`) e negar o restante do schema `public`.
- `AuthContext`: expor `isAgencia` (`userRole === 'agencia'`).
- `AppLayout`: se `isAgencia`, permitir apenas rotas `/agencia/*`, `/mensagens` e `/trocar-senha`; qualquer outra redireciona para `/agencia/contas`.
- `Sidebar`: quando `isAgencia`, renderizar somente `agenciaMenuItems` + item Mensagens, sem o bloco da consultoria.
- `supabase/functions/create-user`: aceitar `role === 'agencia'` na validação; mantém `force_password_change: true`.
- Configurações: incluir "Agência" no seletor de papel da criação de usuário e na exibição dos papéis.
- Ficha: inserir em `agencia.pessoas` (`nome`, `email`, `papel` admin, `ativa` true, `auth_id` do usuário criado) — confirmar os valores aceitos em `papel` antes de inserir.
- Nada de publicação: uso apenas do banco e do preview de desenvolvimento.

## Preciso de você

O e-mail do Giuliano para criar o login e a ficha.
