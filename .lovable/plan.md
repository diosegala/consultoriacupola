

# Plano de Importação de Dados da Planilha

## Visão Geral

Vou criar uma **edge function** que processará os dados da planilha e inserirá diretamente no banco de dados. Isso é mais seguro e eficiente do que fazer pelo frontend.

---

## Dados a Importar

### 1. Clientes Ativos (28 registros)
| Campo Planilha | Campo Banco | Observação |
|----------------|-------------|------------|
| Nome do cliente | clientes.nome | Direto |
| Consultor | clientes.consultor_id | Lookup pelo nome |
| Cidade/UF | clientes.cidade + clientes.uf | Separar por "/" |
| Status | clientes.status | Converter para 'ativo' |

### 2. Contratos (28 registros)
| Campo Planilha | Campo Banco | Observação |
|----------------|-------------|------------|
| Tipo de Consultoria | contratos.tipo_consultoria_id | Lookup pelo nome |
| Prazo (em meses) | contratos.prazo_meses | Converter para integer |
| Inicio do Contrato | contratos.data_inicio | Converter formato DD/MM/YYYY |
| Renovação/Finalização | contratos.data_fim | Converter formato |
| Remuneração total | contratos.remuneracao_total | Limpar formatação R$ |
| Parcelas | contratos.parcelas | Integer |
| Vencimento Parcela | contratos.tipo_vencimento | Normalizar para 'antecipado'/'postecipado' |
| MRR | contratos.remuneracao_mensal | Limpar formatação |
| Momento | contratos.momento | Texto livre |
| Link Contrato | contratos.link_contrato | Direto |
| Particularidades | contratos.particularidades | Direto |

### 3. Onboarding (28 registros)
| Campo Planilha | Campo Banco | Observação |
|----------------|-------------|------------|
| Data Pré Onboarding | onboarding.data_pre_onboarding | Converter formato |
| etapa_atual | Definir como 'concluido' | Todos são clientes ativos |

### 4. Encerramentos (10 registros)
| Campo Planilha | Campo Banco | Observação |
|----------------|-------------|------------|
| Cliente | encerramentos.cliente_id | Criar cliente com status 'encerrado' |
| MMR | encerramentos.mrr_perdido | Limpar formatação |
| Classificação | encerramentos.classificacao | Normalizar 'churn'/'fim_contrato' |
| Justificativa | encerramentos.justificativa | Direto |
| N° clientes ativos | encerramentos.clientes_ativos_momento | Integer |
| Data encerramento | encerramentos.data_encerramento | Converter formato |

---

## Implementação Técnica

### Edge Function: `import-clientes`

```text
POST /functions/v1/import-clientes
Authorization: Bearer {service_role_key}
Content-Type: application/json

{
  "clientes": [...],
  "encerramentos": [...]
}
```

**Processo:**
1. Recebe array de clientes e encerramentos
2. Busca IDs de consultores e tipos de consultoria pelo nome
3. Insere clientes em lote
4. Insere contratos vinculados
5. Insere registros de onboarding
6. Insere registros de atendimentos (padrão: quinzenal)
7. Processa encerramentos (cria cliente + contrato inativo + registro de encerramento)
8. Retorna resumo da importação

### Tratamento de Dados

**Limpeza de valores monetários:**
```
"R$ 95,988.00" → 95988.00
"R$ 7.999,00" → 7999.00
```

**Normalização de datas:**
```
"21/01/2025" → "2025-01-21"
"5/7/2026" → "2026-07-05"
```

**Mapeamento de consultores:**
```
"Janile" → UUID do consultor Janile
"Vivan" / "Vivian" → UUID do consultor Vivian (tratar typos)
```

**Mapeamento de tipos de consultoria:**
```
"Consultoria Padrão" → UUID existente
"Diagnóstico de Funil + Assessoria" → Criar novo tipo se não existir
```

---

## Tratamento de Casos Especiais

| Caso | Tratamento |
|------|------------|
| Cidade sem UF (ex: "Viana e Moura") | Usar cidade vazia e UF vazia |
| Valores vazios de MRR | Usar 0 ou calcular (total/prazo) |
| Datas vazias | Deixar NULL |
| Tipos de consultoria não existentes | Criar automaticamente |
| Typos em nomes de consultores ("Vivan" vs "Vivian") | Normalizar automaticamente |

---

## Arquivos a Criar/Modificar

1. **`supabase/functions/import-clientes/index.ts`**
   - Edge function para processar e inserir os dados
   - Validação e normalização
   - Inserção em lote com transações

2. **Executar via Lovable**
   - Chamar a edge function com os dados extraídos da planilha
   - Exibir resultado da importação

---

## Resultado Esperado

Após a importação:
- **38 clientes** no banco (28 ativos + 10 encerrados)
- **38 contratos** (28 ativos + 10 inativos)
- **28 registros de onboarding** (clientes ativos)
- **28 registros de atendimentos** (clientes ativos)
- **10 registros de encerramentos**

O Dashboard mostrará automaticamente:
- Clientes Ativos: 28
- MRR Total: ~R$ 175.000
- Aguardando Renovação: X (baseado nas datas)
- Histórico de Churn disponível

