
# Plano: Funcionalidade de Exclusão de Cliente e Contrato

## Situação Atual

### Exclusão de Cliente
A funcionalidade de excluir cliente **já está implementada**:
- Hook `useDeleteCliente()` em `src/hooks/useClientes.ts` (linhas 168-217)
- Botão de lixeira na listagem de clientes (`/clientes`)
- Modal de confirmação com `AlertDialog`
- Exclusão em cascata de todos os dados relacionados (atendimentos, ferramentas, onboarding, encerramentos, contratos)

### Exclusão de Contrato
Essa funcionalidade **não existe** e precisa ser implementada:
- Não há hook `useDeleteContrato`
- Não há opção de excluir contrato individual na interface
- Atualmente, para remover um contrato, é preciso excluir o cliente inteiro

---

## Implementação Necessária

### 1. Criar Hook `useDeleteContrato`

Adicionar ao arquivo `src/hooks/useContratos.ts`:
- Função para excluir contrato individual
- Antes de excluir, remover registros dependentes:
  - `pausas_contrato` (pausas associadas ao contrato)
  - `encerramentos` (encerramentos associados ao contrato)
  - `onboarding` (se vinculado ao contrato específico)

### 2. Adicionar Botão de Exclusão no Modal de Detalhes do Contrato

No arquivo `src/pages/Contratos.tsx`:
- Adicionar botão "Excluir" no rodapé do modal de detalhes
- Implementar `AlertDialog` de confirmação (padrão destrutivo)
- Mostrar aviso sobre dados que serão removidos

### 3. Adicionar Exclusão na Aba Contrato do Cliente

No arquivo `src/components/cliente/ContratoTab.tsx`:
- Adicionar botão de excluir no card do contrato ativo
- Adicionar opção de excluir no histórico de contratos
- Implementar confirmação antes da exclusão

### 4. Adicionar Exclusão na Página de Detalhe do Cliente

No arquivo `src/pages/ClienteDetalhe.tsx`:
- Adicionar botão "Excluir Cliente" no header (ao lado do botão Editar)
- Reutilizar o mesmo padrão de confirmação da página de listagem
- Após exclusão, redirecionar para `/clientes`

---

## Detalhes Técnicos

### Hook `useDeleteContrato`

```text
useDeleteContrato()
├── Receber: contrato_id, cliente_id
├── Excluir pausas_contrato WHERE contrato_id = ?
├── Excluir encerramentos WHERE contrato_id = ?
├── Excluir onboarding WHERE contrato_id = ?
├── Excluir contrato WHERE id = ?
└── Invalidar queries: contratos, all-contratos, cliente
```

### Lógica de Negócio

Ao excluir um contrato:
1. Se for o único contrato do cliente e estiver ativo: perguntar se deseja excluir o cliente também
2. Se houver outros contratos: apenas excluir o contrato selecionado
3. Se for o contrato ativo: atualizar status do cliente conforme contratos restantes

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useContratos.ts` | Adicionar `useDeleteContrato()` |
| `src/pages/Contratos.tsx` | Adicionar botão e modal de exclusão de contrato |
| `src/components/cliente/ContratoTab.tsx` | Adicionar opção de excluir contrato |
| `src/pages/ClienteDetalhe.tsx` | Adicionar botão de excluir cliente |

---

## Fluxo de Exclusão

```text
Usuário clica "Excluir"
         |
         v
   +------------------+
   | AlertDialog com  |
   | confirmação      |
   +------------------+
         |
    [Confirmar]
         |
         v
   +------------------+
   | Excluir dados    |
   | dependentes      |
   +------------------+
         |
         v
   +------------------+
   | Excluir registro |
   | principal        |
   +------------------+
         |
         v
   +------------------+
   | Toast de sucesso |
   | Atualizar UI     |
   +------------------+
```

---

## Resumo das Ações

1. Criar hook `useDeleteContrato` com exclusão em cascata
2. Adicionar botão de exclusão no modal de detalhes de contrato na página `/contratos`
3. Adicionar botão de exclusão na aba Contrato da página de detalhe do cliente
4. Adicionar botão de exclusão de cliente na página de detalhe do cliente
5. Implementar modais de confirmação com texto explicativo sobre consequências
