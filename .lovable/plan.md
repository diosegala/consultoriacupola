# Trazer o CupolaOS (agência de marketing) para dentro da plataforma de Consultoria

## Veredito: viável, com o mesmo modelo recomendado — uma plataforma, uma base

Analisei o código e o schema enviados. A ferramenta é tecnicamente **muito parecida com esta**: React 18, Vite, Tailwind, TypeScript, Supabase (mesmo SDK), Radix/shadcn, React Query. O código é bem organizado e documentado. A integração não exige reescrever do zero — é mais uma **mudança de endereço com adaptações** do que uma reconstrução.

## O que encontrei no CupolaOS

- **60 tabelas** no banco, 26 delas ligadas a clientes (mesmo conceito de "carteira" que usamos).
- **Frontend**: ~40 páginas — ficha de cliente, projetos, agentes de IA, criador de blog, redes sociais, cards de anúncios (Franciosi, Goes, Pantera, Porta8), inteligência de mercado, gestão.
- **Servidor próprio no Cloudflare Worker** (`servidor/`): chamadas de IA (Anthropic/Gemini), agente de blog, leitura de RSS, extratores de imóveis, leitura de pastas do Drive.
- **Integrações**: Anthropic, Gemini, Firecrawl, Google Drive (conta de serviço), RunRun.it.
- **20 usuários**, login próprio do Supabase deles, com permissões por cargo/squad em RLS própria.

## Conflitos a resolver (todos solucionáveis)

1. **Nomes de tabelas batem**: `clientes`, `contratos`, `projetos`, `documentos`, `reunioes`, `okrs`, `auditoria` e `mensagens` existem nos dois bancos com estruturas diferentes. Solução: colocar tudo da agência num **schema separado `agencia`** no nosso banco — isolamento total, zero risco para a consultoria, e a RLS deles (bem escrita, com funções security definer) migra quase intacta para dentro desse schema.
2. **Servidor Cloudflare Worker** → aqui o servidor é Supabase Edge Functions. As rotas do worker viram functions. **Decisão sua já registrada**: as chaves de IA são as deles (hoje Anthropic), gerenciadas numa aba própria em Configurações (ver seção "Chaves de IA" abaixo) — nada mais hardcoded.
3. **Usuários**: as 20 pessoas terão contas aqui (mesmo e-mail, senha nova definida no primeiro acesso, reaproveitando nosso fluxo de primeiro login). A tabela `pessoas` deles vira `agencia.pessoas`, ligada ao nosso login.
4. **Dados e arquivos**: precisamos de um dump SQL do banco de produção deles (o Giuliano roda `supabase db dump` — o schema do script já foi confirmado como igual) e da cópia dos arquivos do Storage.
5. **Integrações externas**: Firecrawl tem conector pronto aqui; Anthropic/Gemini entram via nosso gateway; a conta de serviço do Drive entra como segredo; RunRun.it e RSS rodam nas functions.

## Ambiente paralelo — como o modelo "desenvolvimento → produção" funciona aqui

A sua preocupação é legítima, e a boa notícia é que **o Lovable já opera exatamente nesse modelo**, sem precisar criar um projeto paralelo:

- **O que você vê aqui no editor é um ambiente de desenvolvimento completo**: ele tem o **próprio banco de dados**, separado do banco de produção. Tudo que eu construir — schema `agencia`, páginas, functions, migração de dados — acontece **só aqui**, no banco de desenvolvimento.
- **A ferramenta de consultoria em produção não recebe nenhuma alteração** enquanto trabalhamos. Nenhum usuário vê nada, nenhum dado de produção é tocado.
- **Testamos as duas ferramentas rodando juntas no ambiente de desenvolvimento** — inclusive com os dados migrados importados — antes de qualquer publicação.
- **O "Pull Request" é o botão Publicar**: só quando você validar tudo e aprovar, nós publicamos, e aí sim a versão nova (consultoria + agência) vai para produção, com o banco de produção recebendo as mudanças de estrutura de forma controlada.

Ou seja: **não precisamos de um segundo projeto**. Um projeto paralelo criaria na verdade o problema que você quer evitar — seriam dois bancos e dois códigos divergindo, e juntar tudo depois seria manual e arriscado (o Lovable não tem merge entre projetos). Aqui o isolamento já vem de graça e o "merge" é nativo.

**Único cuidado real**: os dados de produção de hoje (consultoria) não são copiados para o desenvolvimento automaticamente. Se quisermos testar a consultoria com dados reais no dev, importamos uma cópia — opcional e sob demanda. Os dados da agência serão importados no dev de qualquer forma (Fase 4), então a validação acontece com dados reais da agência.

## Etapas

### Fase 1 — Fundação (primeira entrega)
- Criar o schema `agencia` com as 60 tabelas adaptadas (tipo de ID, datas) + RLS deles traduzida, com GRANTs no padrão do projeto.
- Ajuste de pontes opcionais: um cliente da agência pode ser o mesmo da consultoria (tabela de vínculo) — avaliar depois.

### Fase 2 — Frontend da Agência
- Nova seção "Agência" no menu, com as páginas deles adaptadas ao visual dark da Cupola.
- Autenticação e permissões ligadas ao nosso sistema (papéis da agência mapeados nos nossos: admin/diretor/usuário).

### Fase 3 — Servidor, integrações e chaves de IA
- Portar o worker do Cloudflare para edge functions (agentes de IA, blog, RSS, extratores, Drive).
- **Nova aba "Chaves de IA" em Configurações** (visível só para admin e diretor): cadastro e edição de chave por provedor (Anthropic agora, outras no futuro — estrutura já preparada), seleção do modelo padrão por provedor a partir de lista curada, e teste de conexão com a chave. As chaves são gravadas via edge function e **nunca voltam para o navegador** (a tela mostra só que existe uma chave cadastrada, com valor mascarado). As functions de IA leem a chave dessa configuração em vez de qualquer valor fixo no código.
- Reconectar integrações (Firecrawl via conector, conta de serviço do Drive como segredo, RunRun.it e RSS nas functions).

### Fase 4 — Migração de dados e usuários
- Dump do banco de produção → import no schema `agencia`, com validação de contagens linha a linha.
- Copiar arquivos do Storage.
- Criar os logins das 20 pessoas.

### Fase 5 — Validação e corte (o "Pull Request")
- Validamos consultoria + agência rodando juntas **no ambiente de desenvolvimento**, com dados reais da agência.
- Checklist de aceite com o Giuliano (ele valida vendo a tela funcionar).
- Só então **publicamos** — o equivalente ao merge: produção recebe tudo de uma vez. O CupolaOS antigo no Cloudflare continua no ar como plano B até confirmarmos que está tudo certo, e desligamos por último.

## O que ainda preciso de você (não bloqueia a Fase 1)

1. **Dump do banco de produção** — peça ao Giuliano: `supabase db dump` (schema + dados) ou Cloud → Export data. O schema já temos; falta o **dados**.
2. **Acesso ao Storage** deles (lista de buckets e arquivos) para planejarmos a cópia.
3. ~~Decisões suas~~ — **resolvido**: as chaves de IA são as deles, gerenciadas na nova aba de Configurações (Anthropic primeiro, outros provedores depois). Sobra uma decisão: a ordem de prioridade dos módulos (sugiro começar por ficha de cliente + agentes de IA, o coração do dia a dia deles).

## Chaves de IA — a decisão e o que ela significa

- **Modelo escolhido**: chaves próprias do time da agência, gerenciadas na aba "Chaves de IA" em Configurações (admin/diretor). A fatura de IA continua na conta Anthropic deles; nenhum custo de IA da agência cai nos créditos deste workspace.
- **Nada hardcoded**: as chaves que hoje estão no código do CupolaOS saem do código e passam a viver numa tabela de configuração, acessível apenas por edge function com validação de admin/diretor. O navegador nunca recebe o valor da chave — só um indicador de "configurada".
- **Seleção de modelo por provedor**: cada provedor tem uma lista curada de modelos disponíveis e um modelo padrão selecionável na aba. Começamos só com Anthropic; a estrutura (provedor → chave → modelos) já nasce pronta para Google, OpenAI etc.
- **Fallback de segurança**: se nenhuma chave estiver configurada, os agentes avisam na tela que falta configurar (em vez de falhar silenciosamente).

## Riscos e mitigação

- **Volume**: 60 tabelas + ~40 páginas + um worker de servidores é grande; por isso o trabalho é em fases, com o CupolaOS antigo no ar até o fim.
- **Nomes conflitantes**: eliminados de cara pelo schema `agencia`.
- **Custo de IA**: fica na conta Anthropic deles, com a tabela de uso de IA deles (`uso_de_ia`) migrada junto — dá para acompanhar o gasto por agente dentro da própria ferramenta.
