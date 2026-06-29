import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from './useConsultorUser';

export interface MinhaTarefaChecklist {
  kind: 'checklist';
  id: string;
  checklist_item_id: string;
  titulo: string;
  concluido: boolean;
  due_date: string | null;
  projeto_id: string;
  cliente_nome: string | null;
}

export interface MinhaTarefaTodo {
  kind: 'todo';
  id: string;
  titulo: string;
  concluido: boolean;
  due_date: string | null;
  projeto_id: string | null;
  cliente_nome: string | null;
  assigned_by: string | null;
  user_id: string;
}

export type MinhaTarefa = MinhaTarefaChecklist | MinhaTarefaTodo;

export function useMinhasTarefasChecklist() {
  const { data: consultorId } = useMyConsultorId();
  return useQuery({
    queryKey: ['minhas_tarefas', 'checklist', consultorId],
    enabled: !!consultorId,
    queryFn: async (): Promise<MinhaTarefaChecklist[]> => {
      const { data, error } = await supabase
        .from('projeto_checklist_responsaveis')
        .select(`
          id,
          checklist_item_id,
          projeto_checklist!inner(
            id, titulo, concluido, due_date, projeto_id,
            projetos!inner(id, clientes(nome))
          )
        `)
        .eq('consultor_id', consultorId!);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        kind: 'checklist' as const,
        id: r.id,
        checklist_item_id: r.checklist_item_id,
        titulo: r.projeto_checklist.titulo,
        concluido: r.projeto_checklist.concluido,
        due_date: r.projeto_checklist.due_date,
        projeto_id: r.projeto_checklist.projeto_id,
        cliente_nome: r.projeto_checklist.projetos?.clientes?.nome ?? null,
      }));
    },
  });
}

export function useMinhasTarefasTodo() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['minhas_tarefas', 'todo', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MinhaTarefaTodo[]> => {
      const { data, error } = await supabase
        .from('todo_pessoal')
        .select('id, user_id, assigned_by, titulo, concluido, due_date, projeto_id, cliente_id, cliente:clientes!todo_pessoal_cliente_id_fkey(nome), projetos(id, clientes(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.user_id === user!.id) // só as do próprio usuário (não as que ele atribuiu)
        .map((r: any) => ({
        kind: 'todo' as const,
        id: r.id,
        titulo: r.titulo,
        concluido: r.concluido,
        due_date: r.due_date,
        projeto_id: r.projeto_id,
        cliente_nome: r.cliente?.nome ?? r.projetos?.clientes?.nome ?? null,
        assigned_by: r.assigned_by,
        user_id: r.user_id,
      }));
    },
  });
}

export interface TarefaAtribuidaPorMim {
  id: string;
  titulo: string;
  concluido: boolean;
  due_date: string | null;
  user_id: string;
  responsavel_nome: string | null;
  cliente_nome: string | null;
  created_at: string;
}

export function useTarefasAtribuidasPorMim() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tarefas_atribuidas', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TarefaAtribuidaPorMim[]> => {
      const { data, error } = await supabase
        .from('todo_pessoal')
        .select('id, titulo, concluido, due_date, user_id, created_at, cliente:clientes!todo_pessoal_cliente_id_fkey(nome), projetos(id, clientes(nome))')
        .eq('assigned_by', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
      let nomeByUserId: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: links } = await supabase
          .from('consultor_user')
          .select('user_id, consultores(nome)')
          .in('user_id', userIds);
        (links ?? []).forEach((l: any) => {
          nomeByUserId[l.user_id] = l.consultores?.nome ?? '';
        });
      }
      return rows.map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        concluido: r.concluido,
        due_date: r.due_date,
        user_id: r.user_id,
        responsavel_nome: nomeByUserId[r.user_id] || null,
        cliente_nome: r.cliente?.nome ?? r.projetos?.clientes?.nome ?? null,
        created_at: r.created_at,
      }));
    },
  });
}

export interface ConsultorAtribuivel {
  user_id: string;
  consultor_id: string;
  nome: string;
}

export function useConsultoresAtribuiveis() {
  return useQuery({
    queryKey: ['consultores_atribuiveis'],
    queryFn: async (): Promise<ConsultorAtribuivel[]> => {
      const { data, error } = await supabase
        .from('consultor_user')
        .select('user_id, consultor_id, consultores(nome, ativo)');
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.consultores?.ativo !== false)
        .map((r: any) => ({
          user_id: r.user_id,
          consultor_id: r.consultor_id,
          nome: r.consultores?.nome ?? '—',
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}