import { supabase } from '@/integrations/supabase/client';

/**
 * Acesso ao schema `agencia` (unidade de negócio Agência de Marketing).
 *
 * Usa a MESMA conexão e a MESMA sessão de login da consultoria — apenas aponta
 * as consultas para o schema `agencia`, cujas regras de linha (RLS) já decidem
 * o que cada pessoa enxerga. Os tipos gerados cobrem só o schema `public`, por
 * isso o cast: as tabelas da agência ainda não estão no arquivo de tipos.
 */
export const agencia = () => (supabase as any).schema('agencia');
