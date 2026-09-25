# Trazer as telas de Clientes da Agência para o padrão do CupolaOS

Refazer a lista de clientes e a página de cada cliente seguindo os prints do CupolaOS, usando os dados reais que já importamos (contas, pessoas, contratos, regras, materiais, agentes, leituras de mercado). Cores continuam as nossas (verde Cupola, tema claro/escuro).

## 1. Lista de Clientes (Agência → Contas, renomeada para "Clientes")
- Cabeçalho "Carteira / Clientes" com frase "Você atende os N clientes da carteira".
- Filtros em pílulas: Todos, Meu squad, Precisam de atenção (com contagem).
- Busca, ordenação (mais recentes, A–Z) e alternância entre grade e lista.
- Cartão de cada cliente: selo com sigla (ou logotipo), nome, cidade-UF, segmento, linha "Contrato ativo · N projetos · N agentes", coordenação/atendimento e squad responsável, barra "Cadastro X%" e link "Abrir cliente".

## 2. Página do cliente
- Topo: caminho "Clientes / Nome", selo, nome grande, squad, cidade, etiqueta do contrato e botão "Compartilhar" (copia o link).
- Abas: Visão geral, Entregáveis, Mercado, Agentes.
- **Visão geral**:
  - 4 cartões resumidos: Sobre o cliente, Tom de voz, Público principal, Cidade (com nº de leituras de mercado), cada um com botão que abre o texto completo.
  - Identidade visual (cores, fontes, logotipo) ou aviso de "ainda não cadastrada".
  - Informações estratégicas: Posicionamento, Diferenciais, Concorrência, Palavras-chave.
  - Quem atende: pílulas com iniciais, nome e cargo das pessoas.
  - Regras da conta: lista com ícone, selo (NUNCA / POSIÇÃO etc.), explicação, termos "conferido na saída" e data.
  - Coluna lateral: Contrato atual (início, renovação, responsável), Contato principal, Documentos (os materiais que a IA lê, abrindo como hoje).
- **Entregáveis**: projetos e entregáveis da conta (reaproveita o que já existe).
- **Mercado**: leituras de mercado da cidade da conta.
- **Agentes**: grade de cartões grandes coloridos (área, ícone, nome, resumo) que abrem o agente já dentro da conta; link "Ver a biblioteca". Lateral com Contexto, Anexos e Regras recolhíveis.

## 3. Fora deste passo
Menu lateral no estilo CupolaOS, CupoSkills, Histórico de conversas e a busca global (⌘K) — ficam para uma próxima etapa, se você quiser.

## Detalhes técnicos
- Reescrever `src/pages/agencia/AgenciaClientes.tsx` e `AgenciaConta.tsx`, quebrando a página do cliente em componentes em `src/components/agencia/cliente/`.
- Novos hooks em `useAgencia.ts`: regras da conta (tabela de regras importada), pessoas que atendem a conta, contagem de projetos/agentes por conta, % de cadastro (campos preenchidos da ficha + identidade).
- Usar Tabs, Button, Dialog, Input, Select do design system; cores só por tokens (`primary`, `muted`, `card`, `chart-*` para os cartões de agentes por área).
- Conferir antes de construir quais colunas as tabelas de regras e identidade têm; verificar no navegador as 19 contas, não só uma.
