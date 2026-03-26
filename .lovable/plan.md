

## Corrigir notas dos criterios no relatorio

### Causa raiz

Na funcao `transformReunioes` (linha 256 de `RelatorioConsultor.tsx`):
```
const criterios = analise?.criterios || {};
```

Porem o edge function `analisar-reuniao` salva os scores **no nivel raiz** de `analise_ia`:
```json
{ "empatia": 8, "clareza": 9, "proatividade": 8, ... }
```

Nao existe wrapper `criterios`. Por isso `criterios` e sempre `{}` e todas as notas ficam 0.

### Correcao

**`src/pages/RelatorioConsultor.tsx`** (linha 256)

Trocar:
```ts
const criterios = analise?.criterios || {};
```
Por:
```ts
const criterios = analise || {};
```

Uma unica linha. Isso faz o mapeamento ler `analise.empatia`, `analise.clareza`, etc. diretamente, que e onde os dados estao.

