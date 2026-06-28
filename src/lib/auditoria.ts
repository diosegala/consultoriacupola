import { supabase } from '@/integrations/supabase/client';

export type AuditoriaOrigem = 'mover_projeto' | 'encerrar_contrato' | 'renovar_contrato';

export interface AuditoriaInput {
  clienteId: string;
  origem: AuditoriaOrigem;
  projetoId?: string | null;
  contratoId?: string | null;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  etapaAnteriorId?: string | null;
  etapaNovaId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra uma entrada de auditoria. Nunca lança — falhas de log não devem
 * quebrar a ação de negócio que as originou.
 */
export async function registrarAuditoriaStatusCliente(input: AuditoriaInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    await supabase.from('auditoria_status_cliente').insert({
      cliente_id: input.clienteId,
      projeto_id: input.projetoId ?? null,
      contrato_id: input.contratoId ?? null,
      origem: input.origem,
      status_anterior: input.statusAnterior ?? null,
      status_novo: input.statusNovo ?? null,
      etapa_anterior_id: input.etapaAnteriorId ?? null,
      etapa_nova_id: input.etapaNovaId ?? null,
      user_id: userId,
      metadata: (input.metadata as any) ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[auditoria] falha ao registrar log', e);
  }
}