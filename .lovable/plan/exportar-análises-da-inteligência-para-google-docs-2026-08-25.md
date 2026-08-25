# Exportar análises da Inteligência para Google Docs

Hoje a aba "Dores e temas recorrentes" tem apenas um botão que baixa um arquivo `.md`. Vamos trocar por um botão que cria o documento direto no Google Docs e abre em nova aba — e adicionar o mesmo botão na aba "Perfil ideal & oportunidades", que hoje não tem exportação.

## O que muda

- Botão "Abrir no Google Docs" em cada aba, ao lado do botão de gerar/atualizar análise.
- Ao clicar: monta o conteúdo em markdown a partir da última análise, cria o documento na conta Google do usuário logado e abre a URL em nova aba.
- Estado de carregamento no botão e mensagens de erro claras (ex.: conta Google não conectada ou sem permissão de Docs → orientar a reconectar em Minhas Integrações).
- O download em markdown deixa de ser oferecido (substituído pelo Google Docs).

## Detalhes técnicos

- Reaproveitar a edge function existente `criar-gdoc`, que já cria o documento a partir de `{ titulo, conteudo_markdown }` e devolve `url`. Nenhuma mudança de backend, banco ou permissões.
- Em `src/pages/Inteligencia.tsx`:
  - Extrair a montagem do markdown de `DoresSection` para uma função `doresParaMarkdown(insight)` e criar `perfilParaMarkdown(insight)` (perfil ideal, perfil de risco e oportunidades de produto).
  - Novo helper local `abrirComoGdoc(titulo, markdown)` que invoca `criar-gdoc`, lê a mensagem de erro do corpo da resposta (mesmo padrão de `useCriarGdocRetro`) e faz `window.open(url, '_blank')`.
  - Título gerado: "Inteligência — Dores e Temas Recorrentes (dd/mm/aaaa)" e "Inteligência — Perfil Ideal e Oportunidades (dd/mm/aaaa)".
- Sem novas dependências.
