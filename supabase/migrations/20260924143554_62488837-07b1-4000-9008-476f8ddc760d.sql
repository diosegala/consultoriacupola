alter table agencia.blog_posts drop constraint if exists blog_posts_passo_atual_check;
alter table agencia.blog_posts add constraint blog_posts_passo_atual_check check (passo_atual between 1 and 10);
alter table agencia.uso_de_ia drop constraint if exists uso_de_ia_provedor_check;
alter table agencia.uso_de_ia add constraint uso_de_ia_provedor_check check (provedor = any (array['anthropic','gemini','magnific','openrouter','openai','deepseek','outros','lovable']));