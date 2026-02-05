import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========== ZOD VALIDATION SCHEMAS ==========
const PipedriveMetaSchema = z.object({
  action: z.enum(['added', 'updated', 'deleted', 'merged']),
  object: z.literal('deal'),
  id: z.number().int().positive().optional(),
  v: z.number().optional(),
  timestamp: z.number().optional(),
  company_id: z.number().optional(),
  user_id: z.number().optional(),
  host: z.string().optional(),
  webhook_id: z.string().optional(),
  trans_pending: z.boolean().optional(),
  permitted_user_ids: z.array(z.number()).optional(),
  is_bulk_update: z.boolean().optional(),
});

const PipedriveCurrentSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().optional(),
  status: z.string().optional(),
  value: z.number().optional(),
  org_id: z.union([
    z.object({ name: z.string().optional() }),
    z.number(),
    z.null()
  ]).optional(),
  person_id: z.union([
    z.object({ name: z.string().optional() }),
    z.number(),
    z.null()
  ]).optional(),
}).passthrough(); // Allow custom fields

const PipedrivePreviousSchema = z.object({
  status: z.string().optional(),
}).passthrough();

const PipedrivePayloadSchema = z.object({
  meta: PipedriveMetaSchema,
  current: PipedriveCurrentSchema.optional(),
  previous: PipedrivePreviousSchema.optional(),
}).refine(
  (data) => {
    // For non-delete actions, current is required
    if (data.meta.action !== 'deleted' && !data.current) {
      return false;
    }
    return true;
  },
  { message: "Campo 'current' é obrigatório para ações que não são 'deleted'" }
);

type ValidatedPipedrivePayload = z.infer<typeof PipedrivePayloadSchema>;

// ========== WEBHOOK SECRET VALIDATION ==========
async function verifyWebhookSecret(req: Request): Promise<boolean> {
  const webhookSecret = Deno.env.get('PIPEDRIVE_WEBHOOK_SECRET');
  
  // If no secret is configured, log warning but allow (for backwards compatibility)
  // In production, you should always configure a secret
  if (!webhookSecret) {
    console.warn('⚠️ PIPEDRIVE_WEBHOOK_SECRET não configurado - validação de segredo ignorada');
    return true;
  }

  // Check for secret in query parameter (Pipedrive supports this)
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret');
  
  if (querySecret === webhookSecret) {
    console.log('Webhook autenticado via query parameter');
    return true;
  }

  // Check for secret in custom header
  const headerSecret = req.headers.get('x-webhook-secret');
  
  if (headerSecret === webhookSecret) {
    console.log('Webhook autenticado via header');
    return true;
  }

  console.error('Falha na autenticação do webhook - segredo inválido ou ausente');
  return false;
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

  let logId: string | null = null;

  try {
    // ========== WEBHOOK SECRET VERIFICATION ==========
    const isAuthenticated = await verifyWebhookSecret(req);
    if (!isAuthenticated) {
      return jsonResponse({ error: 'Unauthorized - Segredo do webhook inválido' }, 401);
    }

    const rawBody = await req.text();
    
    // Try to parse JSON
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      console.error('Falha ao parsear JSON do body');
      return jsonResponse({ error: 'Body inválido - JSON malformado' }, 400);
    }

    console.log('Webhook recebido:', JSON.stringify(rawPayload, null, 2));

    // ========== PAYLOAD VALIDATION WITH ZOD ==========
    const parseResult = PipedrivePayloadSchema.safeParse(rawPayload);
    
    if (!parseResult.success) {
      console.error('Payload inválido:', parseResult.error.errors);
      return jsonResponse({ 
        error: 'Payload inválido - estrutura não reconhecida',
        details: parseResult.error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }, 400);
    }

    const payload = parseResult.data;
    console.log('Payload validado com sucesso');

    // 1. Register webhook log immediately (before processing)
    const { data: logData, error: logError } = await supabase
      .from('webhook_logs')
      .insert({ 
        payload: rawPayload as Record<string, unknown>,
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
    const dealId = String(payload.current?.id || payload.meta.id);
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

function checkIfDealWon(payload: ValidatedPipedrivePayload): boolean {
  // Check if current status is 'won'
  if (payload.current?.status === 'won') {
    // For updates, check if it was just changed to won
    if (payload.meta.action === 'updated') {
      // If previous status was also 'won', it's not a new win
      if (payload.previous?.status === 'won') {
        return false;
      }
    }
    return true;
  }
  return false;
}

function extractClienteData(payload: ValidatedPipedrivePayload): { nome: string; cidade: string; uf: string } {
  const current = payload.current;
  
  if (!current) {
    return { nome: 'Cliente Pipedrive', cidade: 'Não informada', uf: 'SP' };
  }

  // Try to get name from organization or deal title
  let nome = 'Cliente Pipedrive';
  if (typeof current.org_id === 'object' && current.org_id?.name) {
    nome = current.org_id.name;
  } else if (current.title) {
    nome = current.title;
  }

  // Sanitize nome - remove potentially harmful characters
  nome = nome.substring(0, 255).replace(/[<>'"]/g, '');

  // Default values for cidade/uf - these should be mapped from custom fields
  let cidade = 'Não informada';
  let uf = 'SP';

  // Try to find custom fields for cidade and UF
  // Look for common patterns in custom field keys
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === 'string' && value.length <= 255) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('cidade') || keyLower.includes('city')) {
        cidade = value.replace(/[<>'"]/g, '');
      }
      if (keyLower.includes('estado') || keyLower.includes('uf') || keyLower.includes('state')) {
        // Handle UF - could be full state name or abbreviation
        const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
        uf = sanitizedValue.length <= 2 ? sanitizedValue.toUpperCase() : sanitizedValue.substring(0, 2).toUpperCase();
      }
    }
  }

  return { nome, cidade, uf };
}

function extractContratoData(payload: ValidatedPipedrivePayload): { prazoMeses: number; remuneracaoTotal: number } {
  const current = payload.current;
  
  if (!current) {
    return { prazoMeses: 12, remuneracaoTotal: 0 };
  }

  // Get value from deal - validate it's a reasonable number
  let remuneracaoTotal = 0;
  if (typeof current.value === 'number' && current.value >= 0 && current.value <= 100000000) {
    remuneracaoTotal = current.value;
  }

  // Default prazo - look for custom fields
  let prazoMeses = 12;

  for (const [key, value] of Object.entries(current)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('prazo') || keyLower.includes('meses') || keyLower.includes('duracao')) {
      const numValue = parseInt(String(value), 10);
      // Validate prazo is within reasonable bounds
      if (!isNaN(numValue) && numValue > 0 && numValue <= 120) {
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
