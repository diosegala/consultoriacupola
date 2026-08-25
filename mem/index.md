# Project Memory

## Core
Dark theme (bg #000000, cards #121212), Cupola green (#B0F90A). Inter font. Desktop-first.
Supabase, Edge Functions, React Hook Form, Zod, shadcn/ui, @hello-pangea/dnd.
RLS via `is_authorized_user()` (SECURITY DEFINER). Edge functions check admin privileges.
No public signup. Passwords >=8 chars + 1 special. Force change on first login.
System-only notifications (no emails). No data/report exports. Hard deletes use CASCADE.

## Memories

### Style & UI
- [Status Badges](mem://style/status-badges) — Colors for New, Active, Awaiting Renewal, Closed
- [Report Design System](mem://style/report-design-system) — Barlow Condensed, dark/light contrast rules for print reports

### Dashboard & UI Interactions
- [Dashboard Features](mem://ui/dashboard-features) — Interactive KPIs, multi-select filter, stacked charts
- [Dashboard Client Engagement](mem://ui/dashboard-client-engagement) — Horizontal bar chart ranking client engagement
- [MRR Projection Chart](mem://ui/mrr-projection-chart) — Dashed line for 3/6/12 mo future MRR estimates
- [Contracts View Defaults](mem://ui/contracts-view-defaults) — /contratos default: active only, alphabetical
- [Contracts KPI Interaction](mem://ui/contracts-kpi-interaction) — KPI cards open filtered modals, doesn't filter main table
- [Contract Detail Interaction](mem://ui/contract-detail-interaction) — Modal with inline edit instead of redirect

### Clients & Contracts
- [Client Detail Structure](mem://features/client-detail-structure) — Tabs: Contrato, Onboarding, Atendimento, Ferramentas
- [Client Management Rules](mem://features/client-management-rules) — Auto status transitions (New -> Active -> Closed)
- [Contracts Consolidated View](mem://features/contracts-consolidated-view) — Global grid for active/inactive contracts
- [Contract Renewal Flow](mem://features/contract-renewal-flow) — Deactivates old, creates new, cascades data
- [Contract Pause Extension](mem://features/contract-pause-extension) — Auto-extends end date by paused days
- [Contract Date Automation](mem://features/contract-date-automation) — Auto-calculates end date from duration
- [Contract Consultant Assignment](mem://features/contract-consultant-assignment) — Syncs consultant across client and contract edit
- [Permanent Deletion Logic](mem://features/permanent-deletion-logic) — ON DELETE CASCADE dependencies
- [Consultancy Types Stats](mem://features/consultancy-types-stats) — Shows active contract volume per type
- [Consultancy Types Integrity](mem://technical/data-integrity-consultancy-types) — UNIQUE constraint on names

### Financial & Services
- [Financial Monitoring](mem://features/financial-monitoring) — MRR calculation = total / installments
- [Travel Expense Tracking](mem://features/travel-expense-tracking) — MRR * months - expenses = net result
- [Service Management](mem://features/service-management) — Meeting periodicity tracking, OKRs, Cliente Oculto
- [Onboarding Management](mem://features/onboarding-management) — Vertical timeline, 3 immersions

### Projects & Kanban
- [Project Kanban Board](mem://features/project-kanban-board) — 7 fixed stages via dnd
- [Project Management Flow](mem://features/project-management-flow) — Creation constraints for consultants vs admins
- [Kanban Project Details](mem://features/kanban-project-details) — 2-col dialog, checklists, comments, single due date

### AI Agents & Scoring
- [Consultant Performance Analysis](mem://features/consultant-performance-analysis) — AI transcript scoring (0-10) in 5 criteria
- [Client Engagement Analysis](mem://features/client-engagement-analysis) — AI scores client participation and interest
- [Dual AI Analysis](mem://technical/dual-ai-analysis) — 2 sequential AI calls per meeting transcript
- [Consultant Score Display](mem://features/consultant-score-display) — Arithmetic mean, 1 decimal point
- [Consultant Performance Report](mem://features/consultant-performance-report) — High fidelity HTML to PDF view
- [Client Performance View](mem://features/client-performance-view) — Tab and print report for client engagement history
- [Project AI Agents](mem://features/project-ai-agents) — 3 agents (Diagnóstico, OKRs, Briefing), doc extraction
- [Agentes: feedback e anti-truncamento](mem://features/agentes-feedback-loop) — marcador de fim, continuações, feedbacks, diretrizes aprendidas
- [Risco de churn por engajamento](mem://features/risco-churn-engajamento) — Regras do bloco Risco de churn e alerta score_cliente_em_queda
- [Políticas de Decisão](mem://features/politicas-decisao) — Limiares de risco de churn editáveis via tabela politicas_decisao
- [Pesquisa de Reuniões](mem://features/pesquisa-reunioes) — Chat com busca semântica nas transcrições de reuniões, fontes citadas, escopo por carteira
- [Inteligência por Operação](mem://features/inteligencia-por-operacao) — Dores/oportunidades segmentadas em vendas, locação e transversal; relatório visual com gráfico e sub-abas
- [AI Agent Management](mem://features/ai-agent-management) — Admin config for prompts, ref docs, Gemini/GPT-4o
- [AI Engine Integration](mem://technical/ai-engine-integration) — Gemini fallback logic + GPT-4o secret handling

### Auth & Integrations
- [RBAC Roles Access](mem://auth/rbac-roles-access) — Admin/director vs consultant access rules
- [User Management UI](mem://auth/user-management-ui) — Admin mapping auth -> consultant with temp passwords
- [Password Management](mem://auth/password-management) — Reset via /reset-password
- [Onboarding Security](mem://auth/onboarding-security) — force_password_change flag on first login
- [Edge Functions Security](mem://technical/edge-functions-security) — Admin RLS + Zod on critical functions
- [Pipedrive Webhook Automation](mem://integrations/pipedrive-webhook-automation) — Auto-creates client/contract on Deal Won
- [Pipedrive Webhook Security](mem://integrations/pipedrive-webhook-security) — HTTP Basic Auth + Zod
- [Pipedrive V2 Compatibility](mem://integrations/pipedrive-v2-compatibility) — Handles 'data'/'current' and 'change'->'won' mappings
