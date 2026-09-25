import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/design-system/design-system-hub-ba3841/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import ClienteNovo from "./pages/ClienteNovo";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Contratos from "./pages/Contratos";
import Consultores from "./pages/Consultores";
import ConsultorDetalhe from "./pages/ConsultorDetalhe";
import RelatorioConsultor from "./pages/RelatorioConsultor";
import RelatorioCliente from "./pages/RelatorioCliente";
import Configuracoes from "./pages/Configuracoes";
import Projetos from "./pages/Projetos";
import ResetPassword from "./pages/ResetPassword";
import TrocarSenha from "./pages/TrocarSenha";
import MinhasIntegracoes from "./pages/MinhasIntegracoes";
import MinhasTarefas from "./pages/MinhasTarefas";
import Reunioes from "./pages/Reunioes";
import GoogleCallback from "./pages/GoogleCallback";
import NotFound from "./pages/NotFound";
import QuestionarioPublico from "./pages/QuestionarioPublico";
import Agenda from "./pages/Agenda";
import Oraculo from "./pages/Oraculo";
import OraculoBase from "./pages/OraculoBase";
import OraculoAdmin from "./pages/OraculoAdmin";
import MeuPainel from "./pages/MeuPainel";
import Agentes from "./pages/Agentes";
import Inteligencia from "./pages/Inteligencia";
import PesquisaReunioes from "./pages/PesquisaReunioes";
import Mensagens from "./pages/Mensagens";
import AgenciaClientes from "./pages/agencia/AgenciaClientes";
import AgenciaConta from "./pages/agencia/AgenciaConta";
import AgenciaContaRedes from "./pages/agencia/AgenciaContaRedes";
import AgenciaContaBlog from "./pages/agencia/AgenciaContaBlog";
import AgenciaAgentes from "./pages/agencia/AgenciaAgentes";
import AgenciaAgenteConversa from "./pages/agencia/AgenciaAgenteConversa";
import AgenciaEquipe from "./pages/agencia/AgenciaEquipe";
import AgenciaMercado from "./pages/agencia/AgenciaMercado";
import AgenciaRedesMes from "./pages/agencia/AgenciaRedesMes";
import AgenciaInicio from "./pages/agencia/AgenciaInicio";
import AgenciaProjetos from "./pages/agencia/AgenciaProjetos";
import AgenciaSessoes from "./pages/agencia/AgenciaSessoes";
import AgenciaSessao from "./pages/agencia/AgenciaSessao";
import AgenciaSkills from "./pages/agencia/AgenciaSkills";
import AgenciaProdutos from "./pages/agencia/AgenciaProdutos";
import AgenciaNews from "./pages/agencia/AgenciaNews";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="cupola-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trocar-senha" element={<TrocarSenha />} />
            <Route path="/google-callback" element={<GoogleCallback />} />
            <Route path="/q/:token" element={<QuestionarioPublico />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/clientes/novo" element={<ClienteNovo />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/contratos" element={<Contratos />} />
              <Route path="/consultores" element={<Consultores />} />
              <Route path="/consultores/:id" element={<ConsultorDetalhe />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/projetos" element={<Projetos />} />
              <Route path="/minhas-tarefas" element={<MinhasTarefas />} />
              <Route path="/reunioes" element={<Reunioes />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/oraculo" element={<Oraculo />} />
              <Route path="/oraculo/base" element={<OraculoBase />} />
              <Route path="/oraculo/admin" element={<OraculoAdmin />} />
              <Route path="/pesquisa-reunioes" element={<PesquisaReunioes />} />
              <Route path="/meu-painel" element={<MeuPainel />} />
              <Route path="/agentes" element={<Agentes />} />
              <Route path="/inteligencia" element={<Inteligencia />} />
              <Route path="/mensagens" element={<Mensagens />} />
              <Route path="/integracoes" element={<MinhasIntegracoes />} />
              <Route path="/agencia/contas" element={<AgenciaClientes />} />
              <Route path="/agencia/contas/:slug" element={<AgenciaConta />} />
              <Route path="/agencia/contas/:slug/redes" element={<AgenciaContaRedes />} />
              <Route path="/agencia/contas/:slug/blog" element={<AgenciaContaBlog />} />
              <Route path="/agencia/agentes" element={<AgenciaAgentes />} />
              <Route path="/agencia/agentes/news" element={<AgenciaNews />} />
              <Route path="/agencia/agentes/:slug" element={<AgenciaAgenteConversa />} />
              <Route path="/agencia/news" element={<AgenciaNews />} />
              <Route path="/agencia/news/:slug" element={<AgenciaNews />} />
              <Route path="/agencia/news/:slug/:mes" element={<AgenciaNews />} />
              <Route path="/agencia/equipe" element={<AgenciaEquipe />} />
              <Route path="/agencia/mercado" element={<AgenciaMercado />} />
              <Route path="/agencia/redes" element={<AgenciaRedesMes />} />
              <Route path="/agencia" element={<AgenciaInicio />} />
              <Route path="/agencia/projetos" element={<AgenciaProjetos />} />
              <Route path="/agencia/sessoes" element={<AgenciaSessoes />} />
              <Route path="/agencia/sessoes/:id" element={<AgenciaSessao />} />
              <Route path="/agencia/skills" element={<AgenciaSkills />} />
              <Route path="/agencia/produtos" element={<AgenciaProdutos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            <Route path="/consultores/:id/relatorio" element={<RelatorioConsultor />} />
            <Route path="/clientes/:id/relatorio" element={<RelatorioCliente />} />
            </Routes>
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
