
## Objetivo

Substituir a planilha de pré-onboarding/onboarding por um formulário web amigável. O consultor gera um link único, envia ao cliente; o cliente preenche ao longo de vários dias (com progresso salvo automaticamente e barra de progresso); as respostas ficam disponíveis nas páginas do **Cliente** e do **Contrato**.

Esta primeira fase entrega a infraestrutura completa com **um template fixo de exemplo**. Depois você revisa os question_arios e me passa as perguntas reais — eu só atualizo o template, sem refazer a base.

---

## Fluxo de uso

1. Admin/consultor abre a página do cliente → aba **Onboarding** (existente) ganha um bloco "Question_ario do cliente".
2. Clica em **Gerar link de preenchimento** → sistema cria um token único e mostra link copiável (`/q/{token}`).
3. Cliente abre o link (sem login). Vê tela amigável com:
   - Cabeçalho com nome do cliente e logo CUPOLA.
   - Barra de progresso (% preenchido) fixa no topo.
   - Seções navegáveis (sidebar ou stepper).
   - Cada campo salva automaticamente ao sair do foco (debounce ~800ms). Indicador "Salvo às HH:MM".
   - Botão **Salvar e continuar depois** + **Enviar respostas** (só habilita quando todas as obrigatórias estão preenchidas).
4. Consultor vê na plataforma:
   - Badge de status (Não iniciado / Em andamento / Concluído) + % de preenchimento.
   - Botão **Ver respostas** abre modal com leitura organizada por seção.
   - Quando cliente finaliza → badge muda + (e-mail fica em stand-by até dom_inio CUPOLA estar pronto; já deixo o gatilho pronto e desativado).

---

## Modelagem de dados

Tabelas novas (todas em `public`, com RLS e GRANTs):

- **`questionarios_template`** — versões do template
  - `nome`, `versao` (int), `ativo` (bool), `estrutura` (jsonb — seções e perguntas)
  - Pe_rmite ter v1 fixa agora e v2 configurável no futuro sem migrar dados antigos.

- **`questionarios`** — instância por cliente
  - `cliente_id` (FK → clientes), `template_id`, `token` (uuid único), `status` (`nao_iniciado` | `em_andamento` | `concluido`), `progresso_pct` (int 0-100), `respostas` (jsonb), `iniciado_em`, `concluido_em`, `ultimo_salvamento_em`, `expira_em` (nullable).
  - Único por `cliente_id` ativo (1 question_ario ativo por cliente).

**RLS:**
- `questionarios_template`: leitura para `authenticated`; escrita só `admin`/`diretor`.
- `questionarios`: leitura para `authenticated` que tenham acesso ao cliente; escrita autorizada via função `is_authorized_user`.
- Acesso público pelo token **não usa RLS direto** → vai por edge function pública (ver abaixo).

**Estrutura do JSON `estrutura` do template** (resumo):
```json
{
  "secoes": [
    {
      "id": "empresa",
      "titulo": "Sobre a empresa",
      "descricao": "...",
      "perguntas": [
        { "id": "razao_social", "tipo": "texto_curto", "label": "...", "obrigatorio": true },
        { "id": "faturamento", "tipo": "numero", "label": "...", "sufixo": "R$" },
        { "id": "segmento", "tipo": "escolha_unica", "opcoes": ["B2B","B2C","Ambos"] }
      ]
    }
  ]
}
```
Tipos suportados na fase 1: `texto_curto`, `texto_longo`, `numero`, `data`, `escolha_unica`, `escolha_multipla`, `sim_nao`, `escala_1_10`. (Upload de arquivo fica para fase 2.)

---

## Acesso público pelo token

Duas edge functions públicas (`verify_jwt = false`):

- **`questionario-get`** — recebe `token`, devolve `{ cliente_nome, template_estrutura, respostas, status, progresso_pct }`. Retorna 404/410 se token inválido ou question_ario já concluído/expirado.
- **`questionario-save`** — recebe `{ token, respostas, finalizar?: boolean }`. Valida com Zod, recalcula `progresso_pct`, atualiza `respostas`, `ultimo_salvamento_em`. Se `finalizar=true` e todas obrigatórias preenchidas → muda status para `concluido` e dispara gancho de notificação (desativado por ora).

Vantagem: o cliente nunca toca direto no banco; toda validação é server-side.

---

## UI

### Cliente (público) — rota `/q/:token`
- Página standalone (fora do layout admin), tema claro, tipografia limpa.
- Layout 2 colunas no desktop: sidebar de seções (com check ao concluir) + área principal de perguntas.
- Mobile: stepper horizontal.
- Barra de progresso global fixa no topo.
- Auto-save com `react-hook-form` + watch + debounce, indicador "Salvo às HH:MM" no canto.
- Tela final: "Obrigado! Suas respostas foram enviadas. O time CUPOLA entrará em contato."

### Admin — página do Cliente, aba **Onboarding**
Bloco novo "Question_ario do cliente":
- Se inexistente: botão **Gerar question_ario** (cria registro + token).
- Se existente: status badge, barra de progresso, data último salvamento, botões **Copiar link**, **Ver respostas** (modal read-only por seção), **Reenviar/Regenerar token** (gera novo token, invalida o antigo).

### Admin — página do Contrato
Card resumido (somente leitura) com status + % + botão **Ver respostas** que abre o mesmo modal. Sem geração de link aqui — vínculo é por cliente, conforme decidido.

---

## Notificação por e-mail (preparado, desativado)

- Edge function `questionario-save` já chama um helper `notificarConsultorOnboardingConcluido(cliente_id)` que hoje só faz `console.log`.
- Quando o domínio CUPOLA estiver pronto, basta plugar `send-transactional-email` no helper + criar template `onboarding-concluido.tsx`. Sem refatoração.

---

## Fora do escopo desta fase
- Editor visual de templates (vem na fase 2 com "configurável por admin").
- Upload de arquivos / anexos.
- E-mail real ao concluir (depende do domínio CUPOLA).
- Lógica condicional entre perguntas (ex.: "se sim, mostrar..."). Avaliamos quando você trouxer as perguntas reais.
- Multi-idioma.

---

## Entregáveis

1. Migração com `questionarios_template` + `questionarios` + RLS + GRANTs + seed de 1 template fixo de exemplo.
2. Edge functions `questionario-get` e `questionario-save` (públicas, com Zod).
3. Rota pública `/q/:token` com auto-save, barra de progresso, navegação por seções.
4. Bloco "Question_ario do cliente" na aba Onboarding do cliente (gerar/copiar/ver).
5. Card resumo no detalhe do contrato (status + ver respostas).
6. Helper de notificação stub para plugar e-mail depois.

Após validarmos esse esqueleto com o template de exemplo, você me passa as perguntas reais e eu atualizo o seed do template (sem mexer em mais nada).
