# Trava anti-duplicidade na sincronização de reuniões

## O que existe hoje

Existe uma trava, mas ela é frágil:

- `reunioes_importadas_log.google_file_id` tem constraint `UNIQUE` (verificado no banco).
- Antes de importar, a sync lê os logs da pasta e pula os arquivos com status `importado`.

## Por que ainda duplica

A ordem das operações é: verifica log → cria a reunião → grava o log. Como a verificação e a
gravação não são atômicas, duas execuções sobrepostas (sync diária + importação manual, ou dois
disparos da sync) veem "ainda não importado", ambas criam a reunião, e só a segunda falha ao
gravar o log — deixando uma reunião órfã, sem log e com `status_analise = 'pendente'`.

Evidência no banco atual:

- 573 reuniões, 106 grupos duplicados, 123 linhas excedentes.
- Em cada grupo: uma reunião com log e já analisada, e outra criada 2–3 segundos depois, sem log
  e pendente. Concentradas em dois eventos: 26/06 e 18/08.
- Não há nenhuma constraint de unicidade na própria tabela `reunioes`.

## O que fazer

1. **Reservar antes de importar (as duas funções: `google-drive-sync-diario` e
   `google-drive-importar-arquivo`)**: inserir primeiro a linha do log com status `importando`.
   Se o insert bater na constraint `UNIQUE`, o arquivo já está sendo tratado por outra execução →
   pular. Só depois exportar o texto e criar a reunião, atualizando o log para `importado` com o
   `reuniao_id`. Em caso de erro, marcar o log como `erro` (continua sendo reavaliado nas próximas
   syncs, como hoje).

2. **Rede de segurança no banco**: índice único em `reunioes` por
   (`cliente_id`, `data_reuniao`, hash da transcrição) para transcrições não nulas, de modo que a
   mesma transcrição nunca entre duas vezes, mesmo que algum caminho novo escape da trava.

3. **Limpeza dos duplicados existentes**: migração que remove as 123 reuniões excedentes, mantendo
   sempre a versão com log de importação / já analisada, e apagando os vínculos dependentes
   (trechos indexados e compromissos) das linhas removidas.

## Detalhes técnicos

- Reserva via `insert ... select` e checagem do código de erro `23505` para detectar a corrida.
- O índice único usa expressão `md5(transcricao)` com cláusula `where transcricao is not null`.
- Após a limpeza, os contadores de reuniões e de "pendentes" na página Reuniões cairão para o
  número real.
