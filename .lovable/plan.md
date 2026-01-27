

# Sistema de Gestão de Clientes - Cupola Consultoria

## Visão Geral
Sistema completo de gestão de clientes de consultoria imobiliária com tema escuro, cores da marca Cupola (verde #b0f90a e preto), integração com Pipedrive via webhook, e controle de MRR/Churn.

---

## Fase 1: Fundação

### 1.1 Configuração do Backend
- Ativar Lovable Cloud para banco de dados e edge functions
- Criar todas as tabelas conforme modelo de dados (clientes, contratos, onboarding, atendimentos, ferramentas_cliente, consultores, encerramentos, tipos_consultoria, crms, webhook_logs)
- Configurar políticas de segurança (RLS)

### 1.2 Autenticação
- Tela de login com email/senha (tema escuro Cupola)
- Autenticação para diretores (todos veem todos os clientes)
- Proteção de rotas - redireciona para login se não autenticado

### 1.3 Dados Iniciais
- Seed dos 9 consultores (Janile, Cristiano, Dioner, etc.)
- Seed dos 11 tipos de consultoria
- Seed dos 8 CRMs
- Script de migração para os 28 clientes ativos

---

## Fase 2: Estrutura Principal

### 2.1 Layout e Navegação
- Sidebar escuro com logo Cupola
- Menu: Dashboard, Clientes, Consultores, Configurações
- Header com indicador de usuário logado e botão de logout

### 2.2 Dashboard
- **4 Cards de KPI**: Clientes Ativos, MRR Total, Aguardando Renovação, Churn do Mês
- **Gráfico de linha**: Evolução do MRR (últimos 12 meses)
- **Tabela de Alertas**: Contratos vencendo, reuniões atrasadas, onboarding pendente
- Filtro por consultor

### 2.3 Listagem de Clientes
- Busca por nome
- Filtros: Status, Consultor, Tipo de Consultoria, Cidade/UF
- Tabela ordenável e paginada (20 por página)
- Badges coloridos por status (Novo=azul, Ativo=verde, Aguardando=amarelo, Encerrado=cinza)

---

## Fase 3: Gestão de Clientes

### 3.1 Detalhe do Cliente (4 abas)
- **Aba Contrato**: Dados do contrato ativo, histórico de contratos, botões Editar/Renovar/Encerrar
- **Aba Onboarding**: Timeline visual das etapas (Pré-onboarding → Imersões 1, 2, 3 → Concluído)
- **Aba Atendimento**: Periodicidade, datas de reuniões, cliente oculto, OKRs
- **Aba Ferramentas**: CRM utilizado, links de dashboards, ConectaLead

### 3.2 Formulário de Cliente/Contrato
- Seções organizadas: Dados do Cliente, Contrato, Onboarding
- Cálculo automático de MRR (valor total ÷ prazo)
- Cálculo automático de data fim (data início + prazo)
- Validações conforme especificado

### 3.3 Fluxos de Contrato
- **Renovação**: Cria novo contrato, desativa anterior, incrementa "momento"
- **Encerramento**: Modal com classificação (Churn/Fim de Contrato) e justificativa
- **Registro de Reunião**: Atualiza última reunião, calcula próxima baseado na periodicidade

---

## Fase 4: Webhook e Integração

### 4.1 Edge Function para Pipedrive
- Endpoint POST /functions/v1/pipedrive-webhook
- Valida payload e status "won"
- Cria cliente com status "novo"
- Registra em webhook_logs para auditoria
- Tratamento de duplicatas (mesmo deal_id)

---

## Fase 5: Administração

### 5.1 Gestão de Consultores
- Listagem com clientes ativos e MRR sob gestão
- Cadastro/edição de consultores
- Proteção contra exclusão de consultor com clientes

### 5.2 Configurações (Cadastros Auxiliares)
- CRUD de Tipos de Consultoria
- CRUD de CRMs

---

## Estilo Visual
- **Tema escuro** como padrão
- **Cores**: Verde #b0f90a (primária), Preto #000000 (fundo), Cards em #121212
- **Tipografia**: Inter
- **Componentes**: shadcn/ui com personalização para tema escuro

