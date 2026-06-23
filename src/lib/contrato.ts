import type { ContratoComTipo } from '@/hooks/useContratos';

/**
 * Returns the display name for a contract's consultancy type.
 * When the type is "Personalizado" and a custom name was provided,
 * the custom name takes precedence.
 */
export function getTipoConsultoriaLabel(
  contrato:
    | Pick<ContratoComTipo, 'tipo_consultoria' | 'tipo_consultoria_personalizado'>
    | null
    | undefined,
  fallback = '-'
): string {
  if (!contrato) return fallback;
  const personalizado = (contrato as any).tipo_consultoria_personalizado as string | null | undefined;
  const tipoNome = contrato.tipo_consultoria?.nome;
  if (tipoNome?.toLowerCase() === 'personalizado' && personalizado?.trim()) {
    return personalizado.trim();
  }
  return tipoNome || fallback;
}

export const TIPO_CONSULTORIA_PERSONALIZADO_NOME = 'Personalizado';