import { useQuery } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { useAuth } from '@/contexts/AuthContext';

export interface AgenciaPessoa {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string | null;
  iniciais: string | null;
  funcao: string | null;
  area_id: string | null;
  lider_id: string | null;
  papel: string | null;
  ativa: boolean | null;
  espaco_de_trabalho_liberado: boolean | null;
  foto: string | null;
}

export interface AgenciaCliente {
  id: string;
  slug: string;
  nome: string;
  sigla: string | null;
  tipo: string | null;
  cidade: string | null;
  cor: string | null;
  desde: string | null;
  resumo: string | null;
  setor_descricao: string | null;
  publico_alvo: string | null;
  tom_de_voz: string | null;
  produtos_servicos: string | null;
  posicionamento: string | null;
  diferenciais: string | null;
  concorrencia: string | null;
  palavras_chave: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  capa: string | null;
  atendimento_id: string | null;
  atualizado_em: string | null;
}

export interface AgenciaContrato {
  cliente_id: string;
  status: string | null;
  modalidade: string | null;
  inicio: string | null;
  renovacao: string | null;
  horas_mes: number | null;
  horas_usadas: number | null;
  escopo: string[] | null;
  responsavel: string | null;
  valor_mensal: number | null;
}

export interface AgenciaAgente {
  id: string;
  slug: string;
  nome: string;
  resumo: string | null;
  descricao: string | null;
  glifo: string | null;
  espaco_id: string | null;
  destaque: boolean | null;
  beta: boolean | null;
  oculto: boolean | null;
  por_conta: boolean | null;
  cliente_id: string | null;
  ordem: number | null;
}

export interface AgenciaProjeto {
  id: string;
  slug: string;
  nome: string;
  cliente_id: string | null;
  status: string | null;
  resumo: string | null;
  espaco_id: string | null;
  atualizado_em: string | null;
}

/** A ficha da pessoa na agência, ligada ao login atual. */
export function useAgenciaPessoa() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agencia', 'pessoa', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AgenciaPessoa | null> => {
      const { data, error } = await agencia()
        .from('pessoas')
        .select('*')
        .eq('auth_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as AgenciaPessoa) ?? null;
    },
  });
}

/** Quem pode ver a seção Agência: quem tem ficha ativa lá. */
export function useTemAcessoAgencia() {
  const { data, isLoading } = useAgenciaPessoa();
  return { temAcesso: !!data && data.ativa !== false, isLoading, pessoa: data ?? null };
}

export function useAgenciaClientes() {
  return useQuery({
    queryKey: ['agencia', 'clientes'],
    queryFn: async (): Promise<AgenciaCliente[]> => {
      const { data, error } = await agencia().from('clientes').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as AgenciaCliente[];
    },
  });
}

export function useAgenciaCliente(slug?: string) {
  return useQuery({
    queryKey: ['agencia', 'cliente', slug],
    enabled: !!slug,
    queryFn: async (): Promise<AgenciaCliente | null> => {
      const { data, error } = await agencia()
        .from('clientes')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return (data as AgenciaCliente) ?? null;
    },
  });
}

export function useAgenciaContratos() {
  return useQuery({
    queryKey: ['agencia', 'contratos'],
    queryFn: async (): Promise<AgenciaContrato[]> => {
      const { data, error } = await agencia().from('contratos').select('*');
      if (error) throw error;
      return (data ?? []) as AgenciaContrato[];
    },
  });
}

export function useAgenciaProjetos() {
  return useQuery({
    queryKey: ['agencia', 'projetos'],
    queryFn: async (): Promise<AgenciaProjeto[]> => {
      const { data, error } = await agencia()
        .from('projetos')
        .select('*')
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgenciaProjeto[];
    },
  });
}

export function useAgenciaAgentes(incluirOcultos = false) {
  return useQuery({
    queryKey: ['agencia', 'agentes', incluirOcultos],
    queryFn: async (): Promise<AgenciaAgente[]> => {
      const { data, error } = await agencia()
        .from('agentes')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as AgenciaAgente[]).filter((a) => incluirOcultos || !a.oculto);
    },
  });
}

export function useAgenciaPessoas() {
  return useQuery({
    queryKey: ['agencia', 'pessoas'],
    queryFn: async (): Promise<AgenciaPessoa[]> => {
      const { data, error } = await agencia().from('pessoas').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as AgenciaPessoa[];
    },
  });
}

export interface AgenciaEspaco {
  id: string;
  nome: string;
  tipo: string | null;
  cor: string | null;
}

export function useAgenciaEspacos() {
  return useQuery({
    queryKey: ['agencia', 'espacos'],
    queryFn: async () => {
      const { data, error } = await agencia().from('espacos').select('*').order('nome');
      if (error) throw error;
      return (data ?? []) as AgenciaEspaco[];
    },
  });
}

export function useAgenciaEntregaveis(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'entregaveis', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await agencia()
        .from('entregaveis')
        .select('*')
        .eq('cliente_id', clienteId);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; nome: string; status: string | null; prazo: string | null; responsavel_id: string | null;
      }>;
    },
  });
}

export function useAgenciaConhecimento(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'conhecimento', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await agencia()
        .from('cliente_conhecimento')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('enviado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; nome: string; origem: string | null; texto: string | null;
        enviado_em: string | null; url: string | null; tipo_arquivo: string | null;
        caminho: string | null;
      }>;
    },
  });
}
