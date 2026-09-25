# CupolaOS (versão atual do GitHub) x Agência aqui — o que falta

## Resumo da comparação

O CupolaOS tem cerca de 60 telas. Aqui na Agência temos 8: Clientes, Cliente, Blog da conta, Redes da conta, Agentes, Conversa com agente, Equipe e Mercado.

### Já existe aqui (pode ter diferenças visuais)
- Clientes, página do cliente, Agentes, Mercado, Equipe, Custos de IA, Blog (básico), Redes (básico), Conversas com agente

### Falta: telas do dia a dia
1. **Início / Meu dia / Jornada**: painel pessoal do colaborador
2. **Projetos**: lista, novo projeto e página do projeto (hoje ficam só dentro da conta)
3. **Produtos**: catálogo de produtos da agência
4. **Skills (CupoSkills)**: biblioteca de habilidades
5. **Sessões**: histórico de conversas com os agentes
6. **Cadastro / Nova conta / Editar cliente**: fluxos em páginas próprias (aqui são janelas)

### Falta: agentes especializados (cada um é uma ferramenta própria)
7. **Criador de Blog** completo: por conta e mês, com revisão, estilo, refino e experimentos
8. **News**: newsletter por conta e mês
9. **Conteúdo de Redes** por conta e mês, mais o **agente JBA Design** (o maior de todos: caminhos criativos, banco de fotos, regras, calibração, entrega)
10. **Cards por cliente**: Dia F Franciosi, Franciosi padrão, Porta 8, Pantera (vitrine), Góes (carrossel), Formato Story
11. **Criador de Pastas** (Drive)
12. **Imagens Planejamento** (pranchas Google)

### Falta: gestão e administração
13. **Gestão**: Assinaturas, Entregas, Equipamentos, Fornecedores, Recrutamento
14. **Admin**: Acessos, Acesso a agentes, Auditoria, Métricas, Squads, Contexto, Egresso, Guarda, Keychain, Crons, Limites de chat
15. **Conectores**: parcialmente coberto pela nossa tela de Integrações

### Falta no banco (tabelas novas desde a primeira exportação)
- Agentes por cliente, experimentos do blog, pranchas Google (histórico e criação), responsáveis por squad, criador de pastas, imagens de planejamento, design system no menu

### Observações do próprio Giuliano (arquivo de sugestões)
Pontos de segurança: exigir login nas chamadas de IA, limitar Drive por cliente e impedir que alguém entre sozinho num squad. Nossa versão já exige login nas funções e usa regras de acesso, mas vou conferir os três pontos antes de trazer as telas.

## Proposta de ordem (em etapas, uma por vez)

1. **Banco**: trazer as tabelas novas e uma exportação nova dos dados (com a VKR)
2. **Navegação**: menu lateral no estilo CupolaOS, Início/Meu dia, Projetos, Sessões, Skills, Produtos
3. **Agentes de conteúdo**: Criador de Blog completo, News, Conteúdo de Redes por mês
4. **Agentes de cliente**: JBA Design, cards Franciosi/Porta 8/Pantera/Góes/Story
5. **Gestão e Admin**: telas de gestão, auditoria, métricas, squads, limites
6. **Integrações**: Criador de Pastas e Imagens Planejamento (dependem do Drive/Google, que ficou para depois)

Cada etapa segue o nosso design system e o verde Cupola, e reaproveita a lógica do código do Giuliano.

## Detalhes técnicos
- O CupolaOS usa um servidor próprio (Cloudflare Worker em `servidor/`, cerca de 60 módulos). Aqui essa lógica vira funções do backend, com chaves lidas via `lerCredenciais`.
- Migrações 15 a 25 do repositório serão adaptadas ao schema `agencia`.
- Os agentes em `src/agentes/redes-sociais-jba-design` (cerca de 40 arquivos) serão portados como módulo próprio.
