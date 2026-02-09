

## Gestão de Usuários Autorizados

### Problema Atual
A tabela `user_roles` só tem o usuário dioner.segala como `admin`. O novo usuário (renata.maciel) se cadastrou mas não tem role, então as políticas RLS bloqueiam todo o acesso.

### Solução

#### 1. Ação Imediata - Adicionar a usuária existente
Inserir a role `director` para renata.maciel na tabela `user_roles` via SQL.

#### 2. Adicionar role `director` ao enum
Criar uma migration para adicionar o valor `director` ao enum `app_role`, já que atualmente só existem `admin` e `moderator`/`user` (se existirem).

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
```

#### 3. Tela de Gestão de Usuários (apenas para admin)
Criar uma página `/configuracoes` (ou usar a rota existente) com:

- Lista de usuários autorizados (email + role)
- Botão para adicionar novo usuário (somente admin)
- O admin insere o email, e quando esse email se cadastrar, já terá acesso
- Opção de remover acesso (somente admin)

**Regras de acesso:**
- `admin`: pode ver todos os dados + gerenciar usuários
- `director`: pode ver todos os dados, mas NÃO pode gerenciar usuários

#### 4. Arquivos a criar/modificar

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar `director` ao enum + inserir role para renata.maciel |
| `src/hooks/useUserRoles.ts` | Novo hook para CRUD de user_roles |
| `src/hooks/useAuth.ts` ou `AuthContext.tsx` | Expor a role do usuário logado |
| `src/pages/Configuracoes.tsx` | Criar página com lista de usuários e formulário de adição |
| `src/App.tsx` | Adicionar rota /configuracoes |
| `src/components/layout/Sidebar.tsx` | Mostrar link "Configurações" apenas para admin |

#### 5. Fluxo de adição de usuário

```text
1. Admin acessa /configuracoes
2. Clica em "Adicionar Usuário"
3. Informa o email do novo diretor
4. Sistema cria um registro na user_roles com role = 'director'
   (o user_id será preenchido quando o usuário se cadastrar)
5. Novo usuário faz signup com aquele email
6. Trigger no banco associa o user_id ao registro existente
```

**Alternativa mais simples (recomendada):** O admin adiciona usuários que JÁ se cadastraram, selecionando da lista de usuários do auth. Isso evita a complexidade do pré-registro.

#### 6. Detalhes técnicos

**Verificar role do usuário logado no AuthContext:**
```typescript
// Adicionar ao AuthContext
const [userRole, setUserRole] = useState<string | null>(null);

// Após login, buscar role
const { data } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();
```

**Política RLS para user_roles (já existe):**
- Admin pode SELECT, INSERT, DELETE
- Usuário pode ver apenas seu próprio registro
- Ninguém pode UPDATE (manter assim)

**Página de Configurações:**
- Tabela com colunas: Email, Role, Ações
- Botão "Remover" para cada usuário (exceto o próprio admin)
- Dialog para adicionar: campo de email + seleção de role (apenas `director`)

