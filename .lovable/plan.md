# Corrigir a cor principal para o verde Cupola

## O que foi confirmado
- O aplicativo ativa permanentemente o modo escuro.
- No design system anexado, a paleta clara usa verde, mas os tokens do modo escuro ainda usam azul/cinza azulado.
- As telas usam corretamente os tokens semânticos (`primary`, `ring` e `sidebar-primary`); portanto, a origem do azul está nos valores escuros desses tokens, não em cada botão individual.

## O que será alterado
- Manter o visual escuro atual e definir, na camada de tema do aplicativo, os equivalentes escuros de `primary`, `ring`, `brand` e `sidebar-primary` com o verde Cupola.
- Ajustar os respectivos contrastes para preservar a leitura de textos e ícones.
- Remover usos azuis pontuais apenas quando representarem a ação principal; cores informativas e gráficos continuarão semanticamente distintas.
- Não editar os arquivos gerenciados do design system anexado.

## Validação
- Conferir Contratos, menu lateral, botões, campos e estados selecionados em tela.
- Verificar contraste, consistência visual e ausência de erros de compilação.

## Nota técnica
A correção será aplicada depois do tema anexado, na camada própria do projeto, para que futuras atualizações do design system não apaguem a identidade verde.
