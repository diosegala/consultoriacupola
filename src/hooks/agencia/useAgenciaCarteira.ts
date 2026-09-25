import { useQuery } from '@tanstack/react-query';
import { agencia } from '@/integrations/supabase/agencia';
import { supabase } from '@/integrations/supabase/client';
import type { AgenciaCliente } from './useAgencia';

export interface AgenciaSquad {
  id: string;
  nome: string;
  cor: string | null;
  logo: string | null;
  logoUrl: string | null;
}

export interface CarteiraSquads {
  squads: AgenciaSquad[];
  squadsPorCliente: Record<string, string[]>;
  pessoasPorSquad: Record<string, string[]>;
}

/** Squads, quais contas cada squad atende e quem está em cada squad. */
export function useCarteiraSquads() {
  return useQuery({
    queryKey: ['agencia', 'carteira-squads'],
    queryFn: async (): Promise<CarteiraSquads> => {
      const [sq, sc, ps] = await Promise.all([
        agencia().from('squads').select('*'),
        agencia().from('squad_clientes').select('*'),
        agencia().from('pessoa_squads').select('*'),
      ]);
      if (sq.error) throw sq.error;
      const lista = (sq.data ?? []) as Array<Omit<AgenciaSquad, 'logoUrl'>>;
      const caminhos = lista.map((s) => s.logo).filter(Boolean) as string[];
      const urls: Record<string, string> = {};
      if (caminhos.length) {
        const { data } = await supabase.storage.from('retratos').createSignedUrls(caminhos, 3600);
        (data ?? []).forEach((d) => {
          if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
        });
      }
      const squadsPorCliente: Record<string, string[]> = {};
      ((sc.data ?? []) as Array<{ squad_id: string; cliente_id: string }>).forEach((r) => {
        (squadsPorCliente[r.cliente_id] ??= []).push(r.squad_id);
      });
      const pessoasPorSquad: Record<string, string[]> = {};
      ((ps.data ?? []) as Array<{ squad_id: string; pessoa_id: string }>).forEach((r) => {
        (pessoasPorSquad[r.squad_id] ??= []).push(r.pessoa_id);
      });
      return {
        squads: lista.map((s) => ({ ...s, logoUrl: s.logo ? urls[s.logo] ?? null : null })),
        squadsPorCliente,
        pessoasPorSquad,
      };
    },
  });
}

export interface RegraConta {
  id: string;
  tipo: string | null;
  texto: string;
  porque: string | null;
  termos: string[] | null;
  desde: string | null;
}

export function useRegrasConta(clienteId?: string) {
  return useQuery({
    queryKey: ['agencia', 'regras', clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<RegraConta[]> => {
      const { data, error } = await agencia()
        .from('regras')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('desde', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegraConta[];
    },
  });
}

const CAMPOS_FICHA: Array<keyof AgenciaCliente> = [
  'resumo', 'setor_descricao', 'publico_alvo', 'tom_de_voz', 'produtos_servicos',
  'posicionamento', 'diferenciais', 'concorrencia', 'palavras_chave', 'contato_nome',
  'contato_email', 'cidade', 'tipo',
];

/** Quanto da ficha do cliente está preenchido (0–100). */
export function percentualCadastro(c: AgenciaCliente): number {
  const cheios = CAMPOS_FICHA.filter((k) => {
    const v = c[k];
    return typeof v === 'string' ? v.trim().length > 0 : !!v;
  }).length;
  return Math.round((cheios / CAMPOS_FICHA.length) * 100);
}

export function siglaDe(c: Pick<AgenciaCliente, 'sigla' | 'nome'>): string {
  return (c.sigla || c.nome.slice(0, 3)).toUpperCase();
}

export function iniciaisDe(nome: string, iniciais?: string | null): string {
  if (iniciais) return iniciais.toUpperCase();
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export const TIPO_LABEL: Record<string, string> = {
  imobiliaria: 'Imobiliária',
  incorporadora: 'Incorporadora',
  servicos: 'Serviços',
};

export const STATUS_CONTRATO: Record<string, string> = {
  ativo: 'Contrato ativo',
  renovacao: 'Em renovação',
  encerrado: 'Encerrado',
};

/** Agentes que servem a uma conta e para onde cada um leva. */
export function rotaDoAgente(agente: { slug: string }, contaSlug: string, clienteId: string) {
  if (agente.slug.includes('redes')) return `/agencia/contas/${contaSlug}/redes`;
  if (agente.slug.includes('blog') && !agente.slug.includes('news')) return `/agencia/contas/${contaSlug}/blog`;
  return `/agencia/agentes/${agente.slug}?conta=${clienteId}`;
}
