## Objetivo
Permitir que, ao selecionar o tipo de consultoria **"Personalizado"** no contrato, o usuário informe manualmente o nome da consultoria daquele cliente.

## Mudanças

### 1. Banco
- Adicionar coluna `tipo_consultoria_personalizado text` (nullable) na tabela `contratos`.

### 2. Formulários (`src/components/cliente/ClienteDialogs.tsx`)
Tanto no **Novo Contrato** quanto no **Editar Contrato**:
- Detectar quando o `tipo_consultoria_id` selecionado corresponde ao tipo cujo nome é "Personalizado".
- Mostrar um campo de texto extra ("Nome da consultoria personalizada") logo abaixo do select.
- Tornar o campo obrigatório quando o tipo for Personalizado (zod refinement).
- Limpar o valor automaticamente quando o tipo deixar de ser Personalizado.
- Persistir o valor em `tipo_consultoria_personalizado` no insert/update.

### 3. Exibição
Onde hoje aparece `tipo_consultoria.nome`, mostrar o nome personalizado se o tipo for Personalizado e o campo estiver preenchido. Locais:
- `src/components/cliente/ContratoTab.tsx` (cabeçalho e histórico)
- `src/components/cliente/ClienteDialogs.tsx` (resumo do contrato atual antes do form de edição)
- `src/pages/Contratos.tsx` (coluna "Tipo" na grid global, se exibe esse campo)
- Relatórios/encerramentos que listam o tipo (`useEncerramentos`, geração de PDF)

Padrão de fallback: `personalizado ? personalizado : tipo_consultoria.nome`.

### 4. Tipagens
- `useContratos.ts` / tipo `ContratoComTipo`: incluir `tipo_consultoria_personalizado`.
- Tipos do Supabase são regenerados após a migration.

## Fora de escopo
- Mudanças no fluxo de criação/edição de tipos em "Tipos de Consultoria" (continua existindo o tipo "Personalizado" como entrada fixa).
- Estatísticas em `useDadosAuxiliares` continuam contabilizando "Personalizado" como um único tipo agregado.
