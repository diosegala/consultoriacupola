

## Logo na Sidebar + Logo e melhorias no PDF

### 1. Logo na Sidebar

Copiar `user-uploads://Logo_cupola_con_H_lima_1.png` para `src/assets/cupola-logo.png`.

**`src/components/layout/Sidebar.tsx`**
- Importar a logo: `import cupolaLogo from '@/assets/cupola-logo.png'`
- Substituir o bloco de texto "CUPOLA / CONSULTORIA" (linhas 48-51) por `<img src={cupolaLogo}>`
- Quando collapsed, mostrar apenas o ícone (manter o "C" ou usar versão reduzida)

### 2. Logo no PDF

**`src/utils/gerarRelatorioPDF.ts`**
- Copiar a logo também para `public/cupola-logo.png` para uso no PDF
- No header do PDF, adicionar a logo com `doc.addImage()` ao lado do título "Relatório de Desempenho"
- Ajustar posicionamento do texto para acomodar a imagem

### 3. Gráfico de evolução do score no PDF

Usar a biblioteca **jspdf** pura (sem dependências extras) para desenhar um gráfico de linhas simples:
- Eixo X: datas das reuniões (ordenadas cronologicamente)
- Eixo Y: score de 0 a 10
- Linha conectando os pontos com cores baseadas no score
- Adicionar seção "Evolução do Score" entre o "Resumo Geral" e o "Detalhamento por Reunião"
- Desenhar com `doc.line()`, `doc.circle()`, `doc.text()` nativos do jsPDF

### 4. Resumo da reunião no PDF

**`src/utils/gerarRelatorioPDF.ts`**
- No bloco de detalhamento de cada reunião, adicionar o campo `resumo_ia` (já disponível em `ReuniaoComDetalhes`)
- Exibir abaixo do header da reunião, antes dos critérios
- Usar `doc.splitTextToSize()` para quebrar o texto longo

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/assets/cupola-logo.png` | Criar (copiar upload) |
| `public/cupola-logo.png` | Criar (copiar upload para PDF) |
| `src/components/layout/Sidebar.tsx` | Editar -- usar imagem da logo |
| `src/utils/gerarRelatorioPDF.ts` | Editar -- logo, gráfico de evolução, resumo |

