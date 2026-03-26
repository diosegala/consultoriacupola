

## Relatorio PDF de Analises de Reunioes do Consultor

### O que sera feito

Adicionar um botao "Gerar Relatorio PDF" na pagina `/consultores/:id` que gera e baixa um PDF com:

- Cabecalho com nome do consultor, data de geracao, status
- Score medio geral e total de reunioes analisadas
- Media por criterio (empatia, clareza, proatividade, dominio tecnico, orientacao a resultados) com barras visuais
- Para cada reuniao analisada: cliente, data, score geral, notas por criterio, pontos fortes e pontos de melhoria

### Abordagem tecnica

Usar a biblioteca **jsPDF** (client-side) para gerar o PDF diretamente no navegador, sem necessidade de backend. Os dados ja estao disponiveis via `useReunioesByConsultor` (reunioes com `analise_ia`) e `useScoreConsultor`.

### Alteracoes

| Arquivo | Acao |
|---------|------|
| `package.json` | Adicionar `jspdf` |
| `src/utils/gerarRelatorioPDF.ts` | Criar -- funcao que recebe consultor + reunioes e gera o PDF |
| `src/pages/ConsultorDetalhe.tsx` | Adicionar botao "Gerar Relatorio" que chama a funcao |

### Conteudo do PDF

1. **Capa/cabecalho**: "Relatorio de Desempenho — [Nome do Consultor]", data de geracao
2. **Resumo geral**: score medio, total de reunioes, media por criterio (tabela)
3. **Detalhamento por reuniao**: para cada reuniao com `status_analise = 'concluido'`:
   - Cliente, data, duracao
   - Score geral + notas por criterio
   - Pontos fortes (lista)
   - Pontos de melhoria (lista)
   - Separador entre reunioes

### Detalhes

- O botao so aparece se houver pelo menos 1 reuniao analisada
- Filtrar apenas reunioes com `status_analise === 'concluido'`
- Usar cores no PDF: verde para scores >= 8, amarelo >= 6, vermelho < 6
- O PDF e gerado e baixado instantaneamente (blob download)

