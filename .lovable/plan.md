

## Trocar o Favicon para o Icone da CUPOLA

### O que sera feito
Substituir o favicon padrao do app pelo icone verde da CUPOLA que voce enviou.

### Passos

1. Copiar a imagem enviada (`icone_cupola_verde.png`) para a pasta `public/` do projeto
2. Atualizar o `index.html` para referenciar o novo favicon em formato PNG

### Arquivo a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `public/favicon.png` | Novo arquivo (copia da imagem enviada) |
| `index.html` | Adicionar `<link rel="icon" href="/favicon.png" type="image/png">` |

