# Adicionar temas claro e escuro com a identidade Cupola

## O que foi confirmado
- O aplicativo ativa permanentemente o modo escuro.
- No design system anexado, a paleta clara usa verde, mas os tokens do modo escuro ainda usam azul/cinza azulado.
- As telas usam corretamente os tokens semânticos (`primary`, `ring` e `sidebar-primary`); portanto, a origem do azul está nos valores escuros desses tokens, não em cada botão individual.

## O que será alterado
- Adicionar um botão de sol/lua no canto superior direito, ao lado das notificações, com descrição ao passar o cursor.
- Permitir alternar imediatamente entre tema claro e tema escuro em todas as páginas.
- Salvar a escolha neste navegador; para quem ainda não escolheu, preservar o tema escuro atual como padrão.
- Usar o verde Cupola em ações, seleções, foco e destaques nos dois temas, corrigindo os tokens escuros que hoje aparecem azuis.
- Ajustar os contrastes de texto, superfícies e ícones nos dois temas.
- Remover usos azuis pontuais apenas quando representarem a ação principal; cores informativas e gráficos continuarão semanticamente distintas.
- Não editar os arquivos gerenciados do design system anexado.

## Validação
- Conferir a troca de tema em Contratos e em outra página interna, incluindo a permanência da escolha após recarregar.
- Verificar menu lateral, botões, campos, estados selecionados e notificações nos dois temas.
- Validar contraste, ausência de sobreposições e compilação.

## Nota técnica
A seleção usará o suporte de tema já instalado no projeto. Os ajustes de identidade serão aplicados na camada própria do aplicativo, depois do tema anexado, para não editar arquivos gerenciados nem perder a correção em futuras atualizações.
