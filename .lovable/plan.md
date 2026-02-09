

## Dois Pedidos: Alteracao de Senha + MRR Futuro

---

### Pedido 1: Alterar Senha

Adicionar um botao/link "Esqueci minha senha" na tela de login e uma opcao de alterar senha para usuarios logados.

#### Tela de Login (Auth.tsx)
- Adicionar link "Esqueci minha senha" abaixo do botao "Entrar"
- Ao clicar, mostrar um campo de email e enviar link de redefinicao via `supabase.auth.resetPasswordForEmail()`
- Pode ser implementado como uma terceira aba ou um dialog simples

#### Para usuarios logados
- Adicionar na pagina de Configuracoes (ou no Sidebar via menu do usuario) uma secao "Alterar Senha"
- Formulario com campos "Nova senha" e "Confirmar nova senha"
- Usar `supabase.auth.updateUser({ password: novaSenha })`

#### Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Auth.tsx` | Adicionar link "Esqueci minha senha" com fluxo de reset por email |
| `src/pages/Configuracoes.tsx` | Adicionar secao "Alterar Senha" acessivel a todos os usuarios logados |
| `src/components/layout/Sidebar.tsx` | Garantir que todos os usuarios (nao so admin) possam acessar Configuracoes para alterar senha |

#### Detalhes sobre a visibilidade de Configuracoes
Atualmente, o link "Configuracoes" so aparece para admin. Para permitir que todos alterem sua senha, ha duas opcoes:
- **Opcao A**: Mostrar "Configuracoes" para todos, mas a aba "Usuarios" so aparece para admin
- **Opcao B**: Criar um botao "Alterar Senha" diretamente no Sidebar/header, sem usar a pagina de Configuracoes

A Opcao A e mais limpa: todos acessam `/configuracoes` e veem a aba "Minha Conta" (com alteracao de senha), mas apenas admin ve a aba "Usuarios".

---

### Pedido 2: Grafico MRR com Projecao Futura

Estender o grafico de evolucao do MRR para incluir meses futuros, usando os contratos ativos que tem `data_fim` no futuro.

#### Logica
O calculo ja existente no `useMRRHistorico` verifica se um contrato estava ativo em determinado mes (comparando `data_inicio` e `data_fim`). A mesma logica funciona para meses futuros: basta estender o loop para incluir meses adiante.

Para cada mes futuro, o MRR sera calculado com base nos contratos que ainda estarao vigentes (ou seja, cuja `data_fim` e posterior ao mes em questao).

#### Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useDashboard.ts` | Modificar `useMRRHistorico` para aceitar um parametro de meses futuros (ex: 6) e gerar dados de `i = 11 meses atras` ate `i = 6 meses no futuro` |
| `src/pages/Dashboard.tsx` | Atualizar o titulo do grafico, adicionar indicacao visual (linha tracejada) para a parte de projecao, e adicionar um seletor para o horizonte futuro (3, 6 ou 12 meses) |

#### Visualizacao
- Meses passados: linha solida (como hoje)
- Meses futuros: linha tracejada ou cor diferente para indicar projecao
- O mes atual sera o ponto de transicao entre real e projetado

A implementacao usara dois campos de dados no grafico (`mrr` para real e `mrr_projetado` para futuro), renderizando duas `Line` no Recharts - uma solida e uma tracejada.

#### Dados do grafico (exemplo)

```text
mes       | mrr (real) | mrr_projetado
----------|------------|---------------
jan/25    | 50000      | null
fev/25    | 52000      | null
...
jan/26    | 60000      | null       <- mes atual (ponto de transicao)
fev/26    | null       | 58000     <- projecao baseada em contratos vigentes
mar/26    | null       | 55000
...
```

Para continuidade visual, o ultimo ponto real e o primeiro ponto projetado compartilham o mesmo valor no mes atual.

#### Seletor de horizonte
Adicionar um pequeno seletor (3, 6 ou 12 meses) no header do card do grafico, para o usuario escolher ate onde quer ver a projecao.

---

### Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Auth.tsx` | Link "Esqueci minha senha" + fluxo de reset |
| `src/pages/Configuracoes.tsx` | Aba "Minha Conta" com formulario de alteracao de senha |
| `src/components/layout/Sidebar.tsx` | Mostrar "Configuracoes" para todos os usuarios autorizados |
| `src/hooks/useDashboard.ts` | Estender `useMRRHistorico` para calcular MRR futuro |
| `src/pages/Dashboard.tsx` | Grafico com projecao (linha tracejada) e seletor de horizonte |

