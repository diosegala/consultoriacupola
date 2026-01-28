
# Plano de Correção: Reimportação dos Dados Reais

## Problema Identificado
Os dados inseridos no banco de dados são de outra fonte (grandes construtoras como Cyrela, MRV, Even, Tenda) e **não correspondem** à planilha fornecida.

## Dados Reais da Planilha

### 28 Clientes Ativos
| Cliente | Consultor | Cidade/UF | Tipo Consultoria | MRR |
|---------|-----------|-----------|------------------|-----|
| Bertoni | Janile | Arapongas/PR | Consultoria Padrão | R$ 7.999 |
| Agulha no Celeiro | Cristiano | São Paulo/SP | Assessoria de Funil | R$ 5.274,90 |
| Lobato Machado | Dioner | Foz do Iguaçu/PR | Consultoria Padrão | R$ 7.700 |
| Redeplan | Dioner | Volta Redonda/RJ | Mapeamento | R$ 7.270 |
| Abias | Janile | São Carlos/SP | Consultoria de Locação | R$ 7.000 |
| Blue House | Cristiano | Curitiba/PR | Diagnóstico + Assessoria | - |
| Bortolini | Cristiano | Passo Fundo/RS | Assessoria de Funil | R$ 9.000 |
| AMO Imóveis | Dioner | Brusque/SC | Consultoria Padrão | R$ 6.960 |
| Exo Investimento | Vivian | Balneário Camboriu/SC | Consultoria de Vendas | R$ 6.900 |
| Campos Incorporadora | Cristiano | Marília/SP | Assessoria de Funil | R$ 9.600 |
| Citas | Vivian | São Paulo/SP | Consultoria de Locação | R$ 6.887,50 |
| Copa Azul | Cristiano | Rio de Janeiro/RJ | Diagnóstico + Assessoria | - |
| Jair Amintas | Janile | Montes Claros/MG | Consultoria Padrão | R$ 6.850 |
| Zireh | Dioner | Curitiba/PR | Consultoria Start Locação | R$ 6.666,67 |
| Helmer | Vivian | Linhares/ES | Consultoria Padrão | R$ 6.650 |
| JBem | Dioner | Santa Rosa/RS | Consultoria Padrão | R$ 6.550 |
| Bispo Imóveis | Vivian | Americana/SP | Consultoria Padrão | R$ 6.450 |
| Intermedial | Dioner | Boituva/SP | Consultoria Padrão | R$ 6.400 |
| Familia | Dioner | Santos/SP | Consultoria Padrão | R$ 6.300 |
| Recanto 21 | Vivian | São Paulo/SP | Consultoria Start Venda | R$ 6.166,67 |
| Marcovic Incorporadora | Cristiano | Campo Mourão/PR | Assessoria de Funil | R$ 7.500 |
| Buriti | Janile | Belo Horizonte/MG | Consultoria de Locação | R$ 6.000 |
| Verdi | Vivian | Passo Fundo/RS | Consultoria Padrão | R$ 5.400 |
| Valphi | Vivian | Curitiba/PR | Consultoria de Vendas | R$ 3.333,33 |
| Nuclear | Vivian | São Paulo/SP | Assessoria Alta Performance | R$ 2.273,75 |
| Campo Salles | Janile | Socorro/SP | Mapeamento Aluguel | R$ 4.571,43 |
| Goes | Emillyn | Criciúma/SC | Personalizado | - |
| Viana e Moura | Emillyn | (sem cidade) | Personalizado | - |

### 10 Encerramentos
| Cliente | Consultor | Data | MRR Perdido | Classificação |
|---------|-----------|------|-------------|---------------|
| Barreto MS | Vivian | Fev 2025 | R$ 6.500 | Fim de contrato |
| AE Patrimônio | Cristiano | Abr 2025 | R$ 8.800 | Churn |
| Vivali | Dioner | Mai 2025 | R$ 6.800 | Churn |
| Sant Imob | Dioner | Mai 2025 | R$ 6.750 | Fim de contrato |
| Toni | Natália | Jul 2025 | R$ 6.450 | Fim de contrato |
| Especiale | Dioner | Jul 2025 | R$ 7.700 | Fim de contrato |
| Valoriza | Vivian | Ago 2025 | R$ 6.450 | Churn |
| Castelucci | Vivian | Ago 2025 | R$ 7.400 | Fim de contrato |
| Colmeia | Dioner | Ago 2025 | R$ 7.700 | Fim de contrato |
| Bartholomeu | Dioner | Ago 2025 | R$ 7.900 | Fim de contrato |

---

## Etapas de Correção

### Etapa 1: Limpar Dados Incorretos
Deletar todos os registros das tabelas na ordem correta para respeitar as foreign keys:
1. encerramentos
2. ferramentas_cliente
3. atendimentos
4. onboarding
5. contratos
6. clientes

Manter apenas os consultores e tipos de consultoria originais (seeds).

### Etapa 2: Adicionar Tipos de Consultoria Faltantes
Criar os tipos que não existem no banco mas estão na planilha:
- "Diagnóstico de Funil + Assessoria"
- "Consultoria Start Venda"
- "Assessoria de Alta Performance em Captação"
- "Mapeamento de Performance e Oportunidades Aluguel"

### Etapa 3: Corrigir Consultores
- Manter os 9 consultores originais
- Remover os que foram criados erroneamente (Sonia, Gislane, Larissa)
- Adicionar "Natália" que aparece nos encerramentos (se não existir)

### Etapa 4: Atualizar Edge Function
Modificar a edge function `import-clientes` para:
- Usar os dados EXATOS da planilha
- Processar corretamente cada campo
- Validar antes de inserir

### Etapa 5: Executar Importação Correta
Chamar a edge function com os dados corretos extraídos da planilha.

---

## Resultado Esperado

Após a correção:
- **28 clientes ativos** com os nomes corretos (Bertoni, Lobato Machado, AMO Imóveis, etc.)
- **10 clientes encerrados** (Barreto MS, AE Patrimônio, etc.)
- **38 contratos** vinculados
- **MRR Total** calculado corretamente (~R$ 175.000)
- **Dashboard** exibindo dados reais

---

## Arquivos a Modificar

1. **`supabase/functions/import-clientes/index.ts`** - Atualizar com dados corretos
2. **Executar queries de limpeza** - Via ferramenta de migração
3. **Chamar edge function** - Com payload correto

