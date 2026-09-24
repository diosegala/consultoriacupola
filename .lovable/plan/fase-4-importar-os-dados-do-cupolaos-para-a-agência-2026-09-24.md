# Fase 4 — Importar os dados do CupolaOS para a Agência

## O que chegou nos arquivos
O banco da agência veio completo: 19 contas, 25 pessoas, 28 agentes, 91 materiais de conta, 19 posts de blog, 271 peças de anúncios, 52 mensagens, 110 regras, 249 registros de uso de IA e outras tabelas menores. Também veio a lista de 174 arquivos guardados (imagens, logos, PDFs) — só a lista; os arquivos em si não vêm no dump.

## Como será feito (só no ambiente de desenvolvimento)
1. **Limpar os dados de exemplo** que criei na fase 1 (espaços, squads, pessoas, agentes de teste), para não duplicar.
2. **Importar tabela por tabela** para a área da Agência, mantendo os mesmos identificadores, para que as ligações (conta ↔ material ↔ blog ↔ peças) fiquem intactas.
3. **Logins**: não importo senhas nem sessões antigas. Cada pessoa é ligada ao login desta plataforma pelo e-mail; quem ainda não tiver conta aqui recebe uma com senha provisória e troca no primeiro acesso (fluxo já existente).
4. **Histórico de uso de IA** entra junto e aparece no painel de custos como "Agência".
5. **Conferência**: comparo a contagem de cada tabela com o dump e abro as telas (Contas, Agentes, Time, Blog, Redes) para confirmar que os dados aparecem.

## O que fica para depois
- **Arquivos (imagens, logos, PDFs)**: precisam ser baixados do Supabase deles. Em projeto gratuito dá para baixar pela tela Storage de cada bucket (2 buckets). Posso preparar um passo a passo quando você quiser. Até lá, os materiais aparecem com o texto, mas a pré-visualização do arquivo fica indisponível.

## Detalhes técnicos
- Dados do schema `public` do dump → schema `agencia`; colunas que não existirem no nosso schema são ignoradas; conversão por script em /tmp gerando INSERTs, executados via migração/SQL com `session_replication_role = replica` para respeitar a ordem das chaves.
- `pessoas.auth_id` remapeado pelo e-mail para `auth.users` locais; demais referências a `auth_id` (sessoes, uso_de_ia, mensagens) remapeadas com o mesmo mapa ou deixadas nulas.
- `storage.objects` não é importado agora; caminhos são preservados para o upload posterior casar sozinho.
