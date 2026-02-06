

## Alterar para Gráfico de Barras Empilhadas

### Objetivo
Transformar o gráfico de barras lado a lado em um gráfico de barras empilhadas, onde:
- **Encerrados** ficam na base (parte de baixo)
- **Novos** ficam empilhados em cima

### Alteração

No arquivo `src/pages/Dashboard.tsx`, modificar o `BarChart` (linhas 211-244):

**De (barras lado a lado):**
```tsx
<Bar dataKey="novos" name="Novos" fill="..." />
<Bar dataKey="encerrados" name="Encerrados" fill="..." />
```

**Para (barras empilhadas):**
```tsx
<Bar dataKey="encerrados" name="Encerrados" fill="..." stackId="contratos" />
<Bar dataKey="novos" name="Novos" fill="..." stackId="contratos" />
```

### Detalhes Técnicos

A propriedade `stackId` do Recharts agrupa as barras com o mesmo ID em uma pilha. A ordem de renderização determina a posição visual:
1. Primeiro `<Bar>` = base da pilha (encerrados)
2. Segundo `<Bar>` = topo da pilha (novos)

```text
ANTES (lado a lado)          DEPOIS (empilhadas)
                             
  ██  ▒▒   ██  ▒▒              ██       ██    
  ██  ▒▒   ██  ▒▒              ██       ██    
  ██  ▒▒   ██  ▒▒              ▒▒       ▒▒    
  ────────────────             ────────────── 
  jan     fev                  jan     fev    
                             
  ██ Novos  ▒▒ Encerrados      ██ Novos (topo)
                               ▒▒ Encerrados (base)
```

### Ajuste no Radius

Como agora as barras são empilhadas:
- Encerrados (base): `radius={[0, 0, 0, 0]}` - sem arredondamento
- Novos (topo): `radius={[4, 4, 0, 0]}` - arredondamento apenas no topo

### Arquivo a Editar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Adicionar `stackId` nas barras e ajustar ordem de renderização |

