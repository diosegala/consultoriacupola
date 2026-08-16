# Scroll no sino + ciclo de decisão no Meu Painel

## 1. Scroll das notificações no sininho
A lista usa uma área de rolagem com altura apenas "máxima", o que na prática não ativa a barra de rolagem — notificações antigas ficam cortadas.

- Definir altura fixa da área rolável (400px) para a barra funcionar de fato.
- Aumentar o limite de 30 para 50 notificações carregadas.
- Manter o cabeçalho ("Notificações" / "Marcar todas") fixo acima da área rolável.

## 2. Aprovar / Editar / Rejeitar no Meu Painel
Hoje o card "Ações sugeridas" só tem "Marcar como resolvida". Passará a ter o mesmo ciclo de decisão do sininho.

- Extrair o bloco de decisão hoje embutido no sino para um componente reutilizável (`NotificacaoDecisaoActions`), usado nos dois lugares, com o mesmo visual atual (Textarea + botões shadcn).
- No card "Ações sugeridas": para os tipos decidíveis, exibir Aprovar / Editar / Rejeitar no lugar de "Marcar como resolvida"; os demais botões existentes (Copiar mensagem, Abrir, Registrar contato, Gerar balanço) permanecem.
- Aplicar a todos os tipos proativos listados no painel: `sem_contato`, `checklist_parado`, `okr_sem_progresso`, `contrato_sem_renovacao`, `score_cliente_em_queda`. Para tipos sem mensagem sugerida, "Editar" abre o texto da descrição.
- Após decidir, a notificação sai da lista de pendentes (já marca `lida`), e o painel mostra um toast de confirmação.
- Também aplicar o ciclo aos alertas de gestão do diretor (seção Gestão da Equipe) que vêm de notificações — mesmos botões, mesmo componente.

## Detalhes técnicos
- `src/components/layout/NotificationBell.tsx`: `ScrollArea` com `h-[400px]`; extrair `NotificacaoDecisao` para `src/components/notificacoes/NotificacaoDecisao.tsx`.
- `src/hooks/useNotificacoes.ts`: reaproveitar `useDecidirNotificacao`; invalidar também a query `['meu-painel','acoes-sugeridas']` no `onSuccess`.
- `src/pages/MeuPainel.tsx`: incluir `decisao`/`decisao_texto` no select de `useAcoesSugeridas` e renderizar o componente de decisão.
- Sem alterações de banco (colunas de decisão já existem) e sem mexer em `gerar-alertas-proativos`.
