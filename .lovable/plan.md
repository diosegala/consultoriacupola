# Trazer a ferramenta da Agência de Marketing para dentro da plataforma de Consultoria

## Objetivo
Integrar a ferramenta da unidade de agência de marketing (hoje em Supabase separado, código feito no Claude Code) dentro desta plataforma, trazendo funcionalidades, dados históricos, integrações externas e usuários.

## Recomendação de modelo: uma plataforma, uma base

Recomendo **migrar tudo para dentro deste app e deste Supabase**, como uma nova seção "Agência" no menu:

- Um login só, reaproveitando o sistema de usuários e permissões já existente (admin/diretor veem tudo; consultores veem sua carteira — estenderíamos com um papel para o time da agência).
- Um banco só: os dados da agência passam a conviver com clientes e contratos, permitindo visões cruzadas (ex.: cliente de consultoria que também é cliente da agência).
- Sem manutenção de dois projetos, dois bancos e duas rotinas de backup.
- As integrações externas da agência (ex.: Meta Ads, Google Ads) são reconectadas aqui usando os mesmos padrões já adotados (Google OAuth por usuário, edge functions).

A alternativa (manter dois bancos e só embutir telas) cria complexidade permanente de sincronização e login duplo — só vale a pena se houver um motivo forte para isolar os dados.

## O que preciso que você me envie

1. **O código da ferramenta** — o ideal é um arquivo .zip da pasta do projeto (arraste aqui no chat) ou o link de um repositório GitHub acessível. Inclua o arquivo `.env.example` ou a lista de nomes de variáveis de ambiente (sem os valores secretos).
2. **O esquema do banco Supabase deles** — a pasta `supabase/migrations` (se existir) ou um export SQL do schema. No Supabase deles: SQL Editor → ou `supabase db dump`. Se não souber como, me avise que eu te guio.
3. **Uma lista das integrações externas** que a ferramenta usa (Meta Ads? Google Ads? CVCRM? outras?), para eu verificar como reconectá-las aqui.

Com isso em mãos, a análise de viabilidade acontece aqui mesmo, sem custo de configuração.

## Etapas

### Fase 1 — Análise de viabilidade (assim que receber os arquivos)
- Leio o código e o esquema do banco da agência.
- Mapeio: telas/funcionalidades, tabelas e dados, integrações externas, regras de acesso.
- Entrego um relatório com: o que migra direto, o que precisa de adaptação, conflitos de nomes/estruturas com o banco atual, riscos e esforço estimado por item.

### Fase 2 — Plano de migração detalhado
- Desenho das novas tabelas neste Supabase (com prefixo ou schema que evite conflito, ex.: `agencia_*`), com RLS e GRANTs seguindo os padrões deste projeto.
- Estratégia de migração dos dados históricos (script de export do Supabase deles → import aqui, com remapeamento de IDs de usuários/clientes).
- Plano de usuários: criar contas do time da agência aqui e mapear os registros históricos para os novos IDs.
- Plano de integrações: quais segredos/contas reconectar e como.

### Fase 3 — Implementação (após sua aprovação do plano detalhado)
- Criação das tabelas e políticas de acesso.
- Nova seção "Agência" no app: menu, rotas, páginas adaptadas ao visual dark/Cupola.
- Migração dos dados históricos com validação (contagens antes/depois).
- Reconexão das integrações externas e testes.
- Cadastro dos usuários da agência.

## Pontos de atenção
- **Sem tempo de parada**: a ferramenta antiga continua no ar até a migração ser validada; só desligamos depois.
- **Dados**: antes de importar qualquer coisa, validamos contagens e amostras juntos.
- **Segredos**: chaves de API e tokens não vêm no código — cada integração será reconectada aqui com credenciais novas ou transferidas por você via interface segura.

## Detalhes técnicos
- Stack da ferramenta será confirmada na Fase 1 (React + Supabase, provavelmente; se houver tecnologias incompatíveis, o relatório indicará o esforço de adaptação).
- RLS neste projeto usa `is_authorized_user()` e `is_admin_or_director()`; as tabelas da agência seguirão o mesmo padrão, com um papel adicional se o time da agência não for o mesmo da consultoria.
- Toda `CREATE TABLE` virá acompanhada de `GRANT`s explícitos, conforme o padrão do projeto.
