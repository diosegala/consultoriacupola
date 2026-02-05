import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PipedrivePayload {
  meta?: {
    action?: string;
    object?: string;
    id?: number;
    // Pipedrive-specific metadata
    v?: number;
    timestamp?: number;
    company_id?: number;
    user_id?: number;
    host?: string;
    webhook_id?: string;
    trans_pending?: boolean;
    permitted_user_ids?: number[];
    is_bulk_update?: boolean;
  };
  current?: {
    id?: number;
    title?: string;
    status?: string;
    value?: number;
    org_id?: { name?: string } | number | null;
    person_id?: { name?: string } | number | null;
    // Custom fields - keys are field IDs like "abc123_field_name"
    [key: string]: unknown;
  };
  previous?: {
    status?: string;
    [key: string]: unknown;
  };
}

// Validate that the payload looks like a legitimate Pipedrive webhook
function isValidPipedrivePayload(payload: unknown): payload is PipedrivePayload {
  if (!payload || typeof payload !== 'object') {
    console.log('Payload inválido: não é um objeto');
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Must have 'meta' object with expected Pipedrive fields
  if (!p.meta || typeof p.meta !== 'object') {
    console.log('Payload inválido: sem campo meta');
    return false;
  }

  const meta = p.meta as Record<string, unknown>;

  // Check for Pipedrive-specific meta fields
  // Pipedrive webhooks always include these fields
  if (typeof meta.action !== 'string') {
    console.log('Payload inválido: meta.action não é string');
    return false;
  }

  // Valid actions in Pipedrive: added, updated, deleted, merged
  const validActions = ['added', 'updated', 'deleted', 'merged'];
  if (!validActions.includes(meta.action)) {
    console.log('Payload inválido: action não reconhecido:', meta.action);
    return false;
  }

  // Must have 'object' field
  if (typeof meta.object !== 'string') {
    console.log('Payload inválido: meta.object não é string');
    return false;
  }

  // For deal webhooks, object must be 'deal'
  if (meta.object !== 'deal') {
    console.log('Payload ignorado: object não é deal:', meta.object);
    return false;
  }

  // Must have 'current' object for non-delete actions
  if (meta.action !== 'deleted') {
    if (!p.current || typeof p.current !== 'object') {
      console.log('Payload inválido: sem campo current para action:', meta.action);
      return false;
    }

    const current = p.current as Record<string, unknown>;

    // current must have an id
    if (typeof current.id !== 'number' || current.id <= 0) {
      console.log('Payload inválido: current.id inválido');
      return false;
    }
  }

  // Additional Pipedrive-specific checks
  // Pipedrive v2 webhooks include a version field
  if (meta.v !== undefined && typeof meta.v !== 'number') {
    console.log('Payload inválido: meta.v não é número');
    return false;
  }

  // Check for company_id (present in all Pipedrive webhooks)
  if (meta.company_id !== undefined && typeof meta.company_id !== 'number') {
    console.log('Payload inválido: meta.company_id não é número');
    return false;
  }

  console.log('Payload validado como Pipedrive webhook');
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let payload: PipedrivePayload;
  let logId: string | null = null;

  try {
    const rawBody = await req.text();
    
    // Try to parse JSON
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('Falha ao parsear JSON do body');
      return jsonResponse({ error: 'Body inválido - JSON malformado' }, 400);
    }

    console.log('Webhook recebido:', JSON.stringify(payload, null, 2));

    // ========== PAYLOAD VALIDATION ==========
    // Validate that this looks like a legitimate Pipedrive webhook
    if (!isValidPipedrivePayload(payload)) {
      console.error('Payload rejeitado - não parece ser um webhook válido do Pipedrive');
      return jsonResponse({ error: 'Payload inválido - estrutura não reconhecida' }, 400);
    }

    // 1. Register webhook log immediately (before processing)
    const { data: logData, error: logError } = await supabase
      .from('webhook_logs')
      .insert({ 
        payload: payload as Record<string, unknown>,
        processado: false 
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    } else {
      logId = logData?.id;
      console.log('Log registrado com ID:', logId);
    }

    // 2. Validate this is a "deal won" event
    const isDealWon = checkIfDealWon(payload);
    if (!isDealWon) {
      console.log('Evento ignorado - não é deal won');
      return jsonResponse({ message: 'Evento ignorado - não é deal won' }, 200);
    }

    // 3. Extract deal ID
    const dealId = String(payload.current?.id || payload.meta?.id);
    if (!dealId || dealId === 'undefined') {
      console.error('Deal ID não encontrado no payload');
      await updateLogError(supabase, logId, 'Deal ID não encontrado');
      return jsonResponse({ error: 'Deal ID não encontrado' }, 400);
    }

    // 4. Check for duplicates
    const { data: existingCliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('pipedrive_deal_id', dealId)
      .maybeSingle();

    if (existingCliente) {
      console.log('Deal já processado anteriormente:', dealId);
      await updateLogProcessed(supabase, logId, existingCliente.id);
      return jsonResponse({ message: 'Deal já processado', cliente_id: existingCliente.id }, 200);
    }

    // 5. Extract data from payload
    const clienteData = extractClienteData(payload);
    const contratoData = extractContratoData(payload);

    console.log('Dados do cliente:', clienteData);
    console.log('Dados do contrato:', contratoData);

    // 6. Create cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .insert({
        nome: clienteData.nome,
        cidade: clienteData.cidade,
        uf: clienteData.uf,
        pipedrive_deal_id: dealId,
        status: 'novo',
      })
      .select()
      .single();

    if (clienteError) {
      console.error('Erro ao criar cliente:', clienteError);
      await updateLogError(supabase, logId, `Erro ao criar cliente: ${clienteError.message}`);
      return jsonResponse({ error: 'Erro ao criar cliente', details: clienteError.message }, 500);
    }

    console.log('Cliente criado:', cliente.id);

    // 7. Create contrato
    const dataInicio = new Date();
    const prazoMeses = contratoData.prazoMeses || 12;
    const dataFim = new Date(dataInicio);
    dataFim.setMonth(dataFim.getMonth() + prazoMeses);

    const remuneracaoTotal = contratoData.remuneracaoTotal || 0;
    const parcelas = prazoMeses;
    const remuneracaoMensal = parcelas > 0 ? remuneracaoTotal / parcelas : 0;

    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .insert({
        cliente_id: cliente.id,
        prazo_meses: prazoMeses,
        data_inicio: dataInicio.toISOString().split('T')[0],
        data_fim: dataFim.toISOString().split('T')[0],
        remuneracao_total: remuneracaoTotal,
        parcelas: parcelas,
        remuneracao_mensal: remuneracaoMensal,
        ativo: true,
        pausado: false,
        tipo_vencimento: 'postecipado',
      })
      .select()
      .single();

    if (contratoError) {
      console.error('Erro ao criar contrato:', contratoError);
      await updateLogError(supabase, logId, `Erro ao criar contrato: ${contratoError.message}`);
      // Continue anyway - cliente was created
    } else {
      console.log('Contrato criado:', contrato?.id);
    }

    // 8. Create auxiliary records in parallel
    const auxiliaryPromises = [
      // Create atendimento
      supabase.from('atendimentos').insert({
        cliente_id: cliente.id,
        periodicidade: 'quinzenal',
      }),
      // Create onboarding
      supabase.from('onboarding').insert({
        cliente_id: cliente.id,
        contrato_id: contrato?.id || null,
        etapa_atual: 'pre_onboarding',
      }),
      // Create ferramentas_cliente
      supabase.from('ferramentas_cliente').insert({
        cliente_id: cliente.id,
        tem_conectalead: false,
      }),
    ];

    const results = await Promise.allSettled(auxiliaryPromises);
    results.forEach((result, index) => {
      const tableName = ['atendimento', 'onboarding', 'ferramentas_cliente'][index];
      if (result.status === 'rejected') {
        console.error(`Erro ao criar ${tableName}:`, result.reason);
      } else if (result.value.error) {
        console.error(`Erro ao criar ${tableName}:`, result.value.error);
      } else {
        console.log(`${tableName} criado com sucesso`);
      }
    });

    // 9. Update log as processed
    await updateLogProcessed(supabase, logId, cliente.id);

    console.log('Processamento concluído com sucesso para cliente:', cliente.id);

    return jsonResponse({
      success: true,
      cliente_id: cliente.id,
      contrato_id: contrato?.id,
      message: 'Cliente criado com sucesso via Pipedrive',
    }, 201);

  } catch (err) {
    const error = err as Error;
    console.error('Erro ao processar webhook:', error);
    if (logId) {
      await updateLogError(supabase, logId, `Erro: ${error.message}`);
    }
    return jsonResponse({ error: 'Erro interno ao processar webhook', details: error.message }, 500);
  }
});

// Helper functions
function jsonResponse(data: unknown, status: number) {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

function checkIfDealWon(payload: PipedrivePayload): boolean {
  // Check if current status is 'won'
  if (payload.current?.status === 'won') {
    // For updates, check if it was just changed to won
    if (payload.meta?.action === 'updated') {
      // If previous status was also 'won', it's not a new win
      if (payload.previous?.status === 'won') {
        return false;
      }
    }
    return true;
  }
  return false;
}

function extractClienteData(payload: PipedrivePayload): { nome: string; cidade: string; uf: string } {
  const current = payload.current || {};
  
  // Try to get name from organization or deal title
  let nome = 'Cliente Pipedrive';
  if (typeof current.org_id === 'object' && current.org_id?.name) {
    nome = current.org_id.name;
  } else if (current.title) {
    nome = current.title;
  }

  // Default values for cidade/uf - these should be mapped from custom fields
  // Custom fields in Pipedrive have keys like "abc123_cidade" or similar
  let cidade = 'Não informada';
  let uf = 'SP';

  // Try to find custom fields for cidade and UF
  // Look for common patterns in custom field keys
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === 'string') {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('cidade') || keyLower.includes('city')) {
        cidade = value;
      }
      if (keyLower.includes('estado') || keyLower.includes('uf') || keyLower.includes('state')) {
        // Handle UF - could be full state name or abbreviation
        uf = value.length <= 2 ? value.toUpperCase() : value.substring(0, 2).toUpperCase();
      }
    }
  }

  return { nome, cidade, uf };
}

function extractContratoData(payload: PipedrivePayload): { prazoMeses: number; remuneracaoTotal: number } {
  const current = payload.current || {};
  
  // Get value from deal
  const remuneracaoTotal = typeof current.value === 'number' ? current.value : 0;

  // Default prazo - look for custom fields
  let prazoMeses = 12;

  for (const [key, value] of Object.entries(current)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('prazo') || keyLower.includes('meses') || keyLower.includes('duracao')) {
      const numValue = parseInt(String(value), 10);
      if (!isNaN(numValue) && numValue > 0) {
        prazoMeses = numValue;
      }
    }
  }

  return { prazoMeses, remuneracaoTotal };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateLogError(supabase: SupabaseClient<any, any, any>, logId: string | null, erro: string) {
  if (!logId) return;
  
  await supabase
    .from('webhook_logs')
    .update({ erro, processado: false })
    .eq('id', logId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateLogProcessed(supabase: SupabaseClient<any, any, any>, logId: string | null, clienteId: string) {
  if (!logId) return;
  
  await supabase
    .from('webhook_logs')
    .update({ processado: true, cliente_id: clienteId })
    .eq('id', logId);
}
