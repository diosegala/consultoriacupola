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
        .select('id, titulo, concluido, due_date, projeto_id, projetos(id, clientes(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        kind: 'todo' as const,
        id: r.id,
        titulo: r.titulo,
        concluido: r.concluido,
        due_date: r.due_date,
        projeto_id: r.projeto_id,
        cliente_nome: r.projetos?.clientes?.nome ?? null,
      }));
    },
  });
}