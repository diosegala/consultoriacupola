---
name: Acesso "Agência"
description: Quarto papel app_role 'agencia' — vê só as telas da Agência e o chat interno, nada da consultoria
type: feature
---

- Enum `public.app_role` tem quatro valores: `admin`, `director`, `consultor`, `agencia`.
- `is_authorized_user()` cobre apenas admin/director/consultor — quem é `agencia` NÃO acessa dados da consultoria (clientes, contratos, projetos, reuniões).
- O chat interno usa `public.pode_usar_chat()` (qualquer papel), então o time da agência conversa com o time da consultoria.
- `AuthContext` expõe `isAgencia`; `AppLayout` só libera `/agencia/*` e `/mensagens` para esse papel (o resto redireciona para `/agencia/contas`); `Sidebar` mostra só Mensagens + grupo Agência.
- Criação pela tela: Configurações → Usuários → criar usuário com papel "Agência". A edge function `create-user` aceita `agencia` e liga automaticamente `agencia.pessoas.auth_id` pela igualdade de e-mail (a ficha da pessoa já existe no schema `agencia`).
- Permissões dentro da Agência continuam vindo de `agencia.pessoas.papel` (`admin` / `gestor` / `analista`).
