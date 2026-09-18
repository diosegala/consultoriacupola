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
2. **Servidor Cloudflare Worker** → aqui o servidor é Supabase Edge Functions. As rotas do worker viram functions. **Decisão sua já registrada**: uma única chave de IA para as duas unidades — a do gateway de IA que a consultoria já usa — com monitoramento de uso e custo por unidade, agente, cliente e usuário (ver seção "Chaves de IA" abaixo). Nada hardcoded.
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

### Fase 3 — Servidor, integrações e IA
- Portar o worker do Cloudflare para edge functions (agentes de IA, blog, RSS, extratores, Drive). Todas as chamadas de IA saem pela **chave única do gateway**, nenhuma chave fixa no código.
- **Nova aba "Inteligência Artificial" em Configurações** (visível só para admin e diretor): seleção de modelo padrão por provedor a partir de lista curada e **painel de uso e custo de IA** com filtros por unidade de negócio (consultoria/agência), agente, cliente, usuário e período.
- **Medição unificada de uso**: toda chamada de IA registra unidade, agente, cliente e usuário. A consultoria já grava uso hoje; estendemos com essas dimensões e o registro de uso da agência (`uso_de_ia`) converge para a mesma visão.
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

- **Modelo escolhido**: **uma única chave para consultoria e agência** — a do gateway de IA que a consultoria já usa. Nenhuma chave de Anthropic/Google separada, nada hardcoded. O custo de IA das duas unidades entra nos créditos deste workspace.
- **Monitoramento vira peça central**: como o gasto é único, cada chamada de IA é etiquetada com **unidade de negócio, agente, cliente e usuário**, e a nova aba em Configurações mostra o custo recortado por cada uma dessas dimensões — você responde "quanto a agência gastou com o agente de blog para o cliente X neste mês" na hora.
- **Seleção de modelo por provedor**: a aba também permite escolher o modelo padrão por provedor dentro da lista curada. Os agentes da agência hoje rodam em Anthropic; no gateway usaremos os modelos equivalentes disponíveis, adaptando os prompts. Se um dia a Anthropic for requisito real (diferença de qualidade comprovada), a aba já comporta chave por provedor como extensão.
- **A tabela de uso da agência (`uso_de_ia`) migra junto**, para o histórico de gasto deles não se perder.

## Riscos e mitigação

- **Volume**: 60 tabelas + ~40 páginas + um worker de servidores é grande; por isso o trabalho é em fases, com o CupolaOS antigo no ar até o fim.
- **Nomes conflitantes**: eliminados de cara pelo schema `agencia`.
- **Custo de IA**: chave única com medição por unidade/agente/cliente/usuário desde o primeiro dia — sem surpresa de fatura e com visibilidade por unidade de negócio.
