import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TodoPessoalRow {
  id: string;
  user_id: string;
  projeto_id: string | null;
  titulo: string;
  concluido: boolean;
  due_date: string | null;
  ordem: number;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  projeto?: {
    id: string;
    clientes: { nome: string } | null;
  } | null;
}

/**
 * To-do pessoal do usuário logado. Se `projetoId` for passado, filtra por projeto.
 * RLS já garante que só vê as próprias tarefas.
 */
export function useTodoPessoal(projetoId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['todo_pessoal', user?.id, projetoId ?? 'all'],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('todo_pessoal')
        .select('*, projeto:projetos(id, clientes(nome))')
        .order('ordem')
        .order('created_at');
      if (projetoId !== undefined) {
        if (projetoId === null) query = query.is('projeto_id', null);
        else query = query.eq('projeto_id', projetoId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TodoPessoalRow[];
    },
  });
}

export function useCreateTodoPessoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ titulo, projeto_id, cliente_id, due_date, assigned_to_user_id }: { titulo: string; projeto_id?: string | null; cliente_id?: string | null; due_date?: string | null; assigned_to_user_id?: string | null }) => {
      if (!user) throw new Error('Não autenticado');
      const isAssign = !!assigned_to_user_id && assigned_to_user_id !== user.id;
      const { error } = await supabase
        .from('todo_pessoal')
        .insert({
          user_id: assigned_to_user_id ?? user.id,
          titulo,
          projeto_id: projeto_id ?? null,
          cliente_id: cliente_id ?? null,
          due_date: due_date ?? null,
          assigned_by: isAssign ? user.id : null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todo_pessoal'] });
      qc.invalidateQueries({ queryKey: ['minhas_tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas_atribuidas'] });
    },
  });
}

export function useUpdateTodoPessoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; titulo?: string; concluido?: boolean; due_date?: string | null }) => {
      const { error } = await supabase
        .from('todo_pessoal')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todo_pessoal'] });
      qc.invalidateQueries({ queryKey: ['minhas_tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas_atribuidas'] });
    },
  });
}

export function useDeleteTodoPessoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('todo_pessoal').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['todo_pessoal'] });
      qc.invalidateQueries({ queryKey: ['minhas_tarefas'] });
      qc.invalidateQueries({ queryKey: ['tarefas_atribuidas'] });
    },
  });
}