

## Adicionar campo de Consultor no formulario de edicao do contrato

### Contexto

Atualmente o `consultor_id` pertence a tabela `clientes`, nao a `contratos`. O formulario de contrato (`ContratoFormDialog`) nao permite alterar o consultor -- isso so e possivel editando o cliente. O usuario quer poder trocar o consultor diretamente ao editar um contrato.

### Abordagem

Como o campo `consultor_id` esta na tabela `clientes` (e nao em `contratos`), a solucao e adicionar um campo Select de consultor no `ContratoFormDialog` que, ao salvar, tambem atualiza o `consultor_id` do cliente associado.

Nao e necessario alterar o schema do banco de dados.

### Alteracoes

**Arquivo: `src/components/cliente/ClienteDialogs.tsx`**

1. Importar `useConsultores` e `useUpdateCliente`
2. Adicionar `consultor_id` ao `contratoSchema` (campo opcional)
3. Buscar a lista de consultores no componente
4. Ao carregar para edicao, preencher o campo com o `consultor_id` do cliente (recebido via prop)
5. No `onSubmit`, alem de salvar o contrato, chamar `useUpdateCliente` para atualizar o `consultor_id` do cliente se ele tiver mudado
6. Adicionar o campo Select de Consultor no formulario, ao lado do campo Tipo de Consultoria

**Arquivo: `src/components/cliente/ClienteDialogs.tsx` (interface)**

- Adicionar prop opcional `consultorId?: string | null` ao `ContratoFormDialogProps`

**Arquivo: `src/pages/Contratos.tsx`**

- Passar `consultorId={editingContrato?.cliente?.consultor_id}` ao `ContratoFormDialog`

**Arquivo: `src/components/cliente/ContratoTab.tsx`**

- Buscar o `consultor_id` do cliente e passa-lo ao `ContratoFormDialog`

### Detalhes tecnicos

O campo `consultor_id` continua na tabela `clientes`. O formulario faz um update em `clientes` (apenas o campo `consultor_id`) em paralelo ao update do contrato, usando o hook `useUpdateCliente` ja existente.

