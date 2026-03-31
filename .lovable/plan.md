

## Upload de arquivos e links do Google Drive nos agentes de IA

### Abordagem

Transformar o dialog de contexto dos agentes para aceitar 3 formas de input:

1. **Texto colado** (como ja funciona)
2. **Upload de arquivos** (.docx, .pdf) -- extraidos no backend via edge function
3. **Link do Google Drive** -- buscado via API publica (arquivos com compartilhamento publico) ou futuramente via OAuth

### Fluxo

1. Consultor abre o dialog do agente
2. Pode colar texto na textarea E/OU arrastar/selecionar arquivos E/OU colar um link do Google Drive
3. Ao clicar "Gerar", os arquivos sao enviados primeiro para uma edge function de parsing que extrai o texto
4. O texto extraido e concatenado com o texto colado e enviado ao agente

### Arquitetura

```text
┌─────────────────────────────┐
│  Dialog do Agente (UI)      │
│  - Textarea (texto livre)   │
│  - Input de arquivos        │
│  - Campo de link GDrive     │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Edge Function              │
│  parse-documento            │
│  - Recebe arquivo (base64)  │
│  - PDF: pdfparse            │
│  - DOCX: mammoth            │
│  - GDrive: fetch export     │
│  - Retorna texto extraido   │
└────────────┬────────────────┘
             │ texto
             ▼
┌─────────────────────────────┐
│  Edge Function              │
│  agente-projeto             │
│  (ja existente, sem mudanca)│
└─────────────────────────────┘
```

### Alteracoes

#### 1. Nova edge function `parse-documento`
- Recebe arquivo em base64 + tipo (pdf/docx) OU url do Google Drive
- Para PDF: usa `pdf-parse` (npm) para extrair texto
- Para DOCX: usa `mammoth` (npm) para converter para texto
- Para Google Drive: extrai o file ID do link, faz fetch para `https://docs.google.com/document/d/{id}/export?format=txt` (funciona para docs publicos/com link)
- Retorna o texto extraido
- Auth: requer JWT valido

#### 2. UI -- `ProjetoDetalheSheet.tsx`
- Adicionar ao dialog do agente:
  - Zona de upload de arquivos (aceita .pdf, .docx) com drag-and-drop
  - Campo de texto para link do Google Drive
  - Lista de arquivos adicionados com botao de remover
  - Indicador de progresso durante parsing
- Ao clicar "Gerar":
  1. Se houver arquivos/links, chama `parse-documento` para cada um
  2. Concatena os textos extraidos + texto da textarea
  3. Envia tudo como `contexto_usuario` ao `agente-projeto`

#### 3. Hook `useProjetoDocumentos.ts`
- Adicionar mutation `useParseDocumento` que chama a edge function `parse-documento`

### Limitacoes e proximos passos
- Google Drive: funciona apenas com arquivos compartilhados publicamente (com link). Para acesso privado, seria necessario integrar OAuth (ja mapeado no roadmap)
- Tamanho maximo de arquivo: ~10MB (limite da edge function)
- Formatos suportados inicialmente: .pdf e .docx

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/parse-documento/index.ts` | Criar -- parsing de PDF/DOCX/GDrive |
| `src/components/projetos/ProjetoDetalheSheet.tsx` | Editar -- upload + link GDrive no dialog |
| `src/hooks/useProjetoDocumentos.ts` | Editar -- mutation de parsing |

