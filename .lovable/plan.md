

## Upload de arquivos modelo (.pdf/.docx) na aba Agentes IA

### O que muda

Na aba "Agentes IA" em Configurações, cada card de agente ganha um botão de upload ao lado da textarea de "Documento Modelo". O admin pode:
- Continuar colando texto manualmente na textarea (como já funciona)
- **OU** clicar em "Enviar arquivo" para selecionar um .pdf ou .docx
- O arquivo é enviado à edge function `parse-documento` (já existente) para extração de texto
- O texto extraído é inserido automaticamente na textarea de documento modelo
- O admin pode revisar/editar antes de salvar

### Fluxo
1. Admin clica no botão de upload (.pdf, .docx)
2. Frontend converte para base64 e chama `parse-documento`
3. Texto extraído preenche a textarea de documento modelo
4. Admin salva normalmente

### Alterações

| Arquivo | Ação |
|---------|------|
| `src/pages/Configuracoes.tsx` | Adicionar botão de upload + lógica de parsing por agente |

Nenhuma mudança de banco ou edge function — tudo já existe.

### Detalhes técnicos
- Reutiliza o hook `useParseDocumento` de `src/hooks/useProjetoDocumentos.ts`
- Aceita `.pdf` e `.docx` (input file com accept)
- Loading spinner durante o parsing
- O texto extraído substitui o conteúdo atual da textarea (com confirmação se já houver texto)

