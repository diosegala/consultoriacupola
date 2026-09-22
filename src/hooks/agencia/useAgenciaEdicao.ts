import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agencia } from '@/integrations/supabase/agencia';
import type {
  AgenciaAgente,
  AgenciaCliente,
  AgenciaContrato,
  AgenciaPessoa,
} from './useAgencia';

/** Converte um texto em identificador curto (ex.: "Studio Alpha" → "studio-alpha"). */
export function slugDe(texto: string) {
  const base = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `novo-${Date.now().toString(36)}`;
}

/** Garante que o identificador não repita um que já existe. */
export function garantirUnico(base: string, usados: string[]) {
  if (!usados.includes(base)) return base;
  let n = 2;
  while (usados.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['agencia'] });
}

export interface ContaDados {
  nome: string;
  sigla: string;
  tipo: string;
  cidade: string;
  desde: string;
  resumo: string;
  setor_descricao: string;
  publico_alvo: string;
  tom_de_voz: string;
  produtos_servicos: string;
  posicionamento: string;
  diferenciais: string;
  concorrencia: string;
  palavras_chave: string;
  contato_nome: string;
  contato_cargo: string;
  contato_email: string;
  contato_telefone: string;
}

export function useSalvarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conta,
      dados,
      existentes,
    }: {
      conta?: AgenciaCliente | null;
      dados: ContaDados;
      existentes: string[];
    }) => {
      if (conta) {
        const { error } = await agencia().from('clientes').update(dados).eq('id', conta.id);
        if (error) throw error;
        return conta.slug;
      }
      const id = garantirUnico(slugDe(dados.nome), existentes);
      const { error } = await agencia()
        .from('clientes')
        .insert({ id, slug: id, cor: '', ...dados });
      if (error) throw error;
      return id;
    },
    onSuccess: (_, vars) => {
      invalidar(qc);
      toast.success(vars.conta ? 'Conta atualizada.' : 'Conta criada.');
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar a conta: ${e.message}`),
  });
}

export function useSalvarContrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clienteId,
      contrato,
      dados,
    }: {
      clienteId: string;
      contrato?: AgenciaContrato | null;
      dados: Partial<AgenciaContrato>;
    }) => {
      if (contrato) {
        const { error } = await agencia()
          .from('contratos')
          .update(dados)
          .eq('cliente_id', clienteId);
        if (error) throw error;
        return;
      }
      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await agencia().from('contratos').insert({
        cliente_id: clienteId,
        status: 'ativo',
        modalidade: '',
        inicio: hoje,
        renovacao: hoje,
        escopo: [],
        responsavel: '',
        ...dados,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar(qc);
      toast.success('Contrato salvo.');
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar o contrato: ${e.message}`),
  });
}

export interface ProjetoDados {
  nome: string;
  cliente_id: string;
  espaco_id: string;
  status: string;
  resumo: string;
  contexto: string;
}

export function useSalvarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projeto,
      dados,
      pessoaId,
      existentes,
    }: {
      projeto?: { id: string } | null;
      dados: ProjetoDados;
      pessoaId: string;
      existentes: string[];
    }) => {
      if (projeto) {
        const { error } = await agencia().from('projetos').update(dados).eq('id', projeto.id);
        if (error) throw error;
        return;
      }
      const id = garantirUnico(slugDe(dados.nome), existentes);
      const { error } = await agencia().from('projetos').insert({
        id,
        slug: id,
        criado_por_id: pessoaId,
        ...dados,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidar(qc);
      toast.success(vars.projeto ? 'Projeto atualizado.' : 'Projeto criado.');
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar o projeto: ${e.message}`),
  });
}

export interface PessoaDados {
  nome: string;
  email: string;
  iniciais: string;
  funcao: string;
  area_id: string;
  lider_id: string | null;
  papel: string;
  ativa: boolean;
  espaco_de_trabalho_liberado: boolean;
}

export function useSalvarPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pessoa,
      dados,
      existentes,
    }: {
      pessoa?: AgenciaPessoa | null;
      dados: PessoaDados;
      existentes: string[];
    }) => {
      if (pessoa) {
        const { error } = await agencia().from('pessoas').update(dados).eq('id', pessoa.id);
        if (error) throw error;
        return;
      }
      const id = garantirUnico(slugDe(dados.nome), existentes);
      const { error } = await agencia().from('pessoas').insert({ id, ...dados });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidar(qc);
      toast.success(vars.pessoa ? 'Pessoa atualizada.' : 'Pessoa cadastrada.');
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar: ${e.message}`),
  });
}

export function useSalvarAgente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agente,
      dados,
    }: {
      agente: AgenciaAgente;
      dados: Partial<AgenciaAgente>;
    }) => {
      const { error } = await agencia().from('agentes').update(dados).eq('id', agente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar(qc);
      toast.success('Agente atualizado.');
    },
    onError: (e: Error) => toast.error(`Não foi possível salvar o agente: ${e.message}`),
  });
}
