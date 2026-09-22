---
name: Permissões da Agência por funcionalidade
description: Quem cria/edita contas, projetos, pessoas e agentes na Agência (agencia.acessos_funcionalidade)
type: feature
---
Na Agência, permissões de escrita vêm de `agencia.acessos_funcionalidade` (nível leitura/escrita/admin), não só do papel:

- `clientes`: admin papel → nível admin (cria/edita/apaga contas); gestor → escrita (cria/edita). Analistas ficam em leitura.
- `admin`: admins têm nível admin (necessário para cadastrar/editar pessoas e apagar contas).
- `agentes` e `projetos`: todos ativos já nascem com escrita (trigger chao_da_pessoa).
- Atualização de conta exige `pode_escrever_cliente` (escrita do squad/nível do cliente); papel admin/gestor resolve como admin/leitura.

Em 22/09/2026 rodamos ajuste: admins com funcionalidade 'admin'+'clientes' (admin) e gestores com 'clientes' (escrita) — antes ninguém podia criar contas pela interface. Novos admins/gestores criados depois precisam dessas linhas (criar pela tela de gestão do time não cria as linhas automaticamente; a trigger chao_da_pessoa só cria o básico de analista).
