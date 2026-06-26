## Problema

No diálogo **Criar Novo Usuário** (`src/pages/Configuracoes.tsx`), o campo "Papel" tem um valor pré-selecionado (`consultor` por padrão) e, pior, **o estado nunca é resetado quando o diálogo fecha/reabre**. Se em uma criação anterior você escolheu "Diretor", na próxima vez que abrir o diálogo o campo continuará marcado como "Diretor" — e como o `<Select>` já mostra um valor, parece que "nada foi selecionado", mas na verdade o valor antigo é enviado. Foi o que aconteceu com a Vivian.

Além disso, os campos Email e Senha também ficam preenchidos com o que foi digitado anteriormente.

## Plano de correção

### 1. Não pré-selecionar papel
- Mudar `newUserRole` para aceitar `'' | 'consultor' | 'director'` e inicializar como `''`.
- Mostrar placeholder "Selecione o papel" no Select.
- Bloquear o botão **Criar Usuário** enquanto papel, email ou senha estiverem vazios.

### 2. Resetar o formulário ao abrir/fechar
- Ao abrir o diálogo: limpar email, senha e papel.
- Ao fechar (cancelar ou sucesso): limpar tudo de novo.

### 3. Confirmação visual antes de criar
- Mostrar um resumo logo acima do botão: "Será criado **email@exemplo.com** como **Consultor / Diretor**." Isso evita ambiguidade na hora de confirmar.

### 4. Validação no backend (defesa em profundidade)
- Em `supabase/functions/create-user/index.ts`, validar que `role` está em `['consultor', 'director']` e retornar 400 caso contrário (hoje aceita qualquer string).

### 5. Correção pontual da Vivian
- Após o ajuste, alterar manualmente o papel da Vivian de `director` para `consultor` via update na tabela de papéis (confirmando o email com você antes).

## Detalhes técnicos

Arquivos afetados:
- `src/pages/Configuracoes.tsx` — estado do diálogo + reset on open/close + validação de submit + resumo de confirmação.
- `supabase/functions/create-user/index.ts` — validação de `role`.
- Update de dados: ajustar `user_roles` da Vivian (preciso confirmar o email cadastrado).

Nada muda no fluxo de vínculo `consultor_user` (continua sendo feito separadamente na aba "Vincular Consultor").

## Pergunta antes de implementar

Confirma que o email da Vivian é o cadastrado no sistema? Posso buscar pelo primeiro nome se preferir. E o papel correto dela é **Consultor**, certo?
