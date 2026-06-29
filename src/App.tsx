import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import MeuPainel from "./pages/MeuPainel";
import Agentes from "./pages/Agentes";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
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
              <Route path="/meu-painel" element={<MeuPainel />} />
              <Route path="/agentes" element={<Agentes />} />
              <Route path="/integracoes" element={<MinhasIntegracoes />} />
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
);

export default App;
