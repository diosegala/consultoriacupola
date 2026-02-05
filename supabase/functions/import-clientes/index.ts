import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== ZOD VALIDATION SCHEMAS ==========
const ClienteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255, "Nome muito longo"),
  consultor: z.string().min(1, "Consultor é obrigatório"),
  cidadeUf: z.string().min(1, "Cidade/UF é obrigatório"),
  tipoConsultoria: z.string().min(1, "Tipo de consultoria é obrigatório"),
  prazoMeses: z.number().int().min(1).max(120).default(12),
  dataInicio: z.string().regex(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/, "Data de início inválida"),
  dataFim: z.string().regex(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/, "Data de fim inválida"),
  remuneracaoTotal: z.number().min(0, "Remuneração total deve ser positiva").default(0),
  parcelas: z.number().int().min(1).default(12),
  tipoVencimento: z.string().default("postecipado"),
  remuneracaoMensal: z.number().min(0).default(0),
  momento: z.string().optional().default(""),
  linkContrato: z.string().optional().default(""),
  particularidades: z.string().optional().default(""),
  dataPreOnboarding: z.string().optional().default(""),
});

const EncerramentoSchema = z.object({
  cliente: z.string().min(1, "Nome do cliente é obrigatório"),
  mrrPerdido: z.number().min(0, "MRR perdido deve ser positivo").default(0),
  classificacao: z.string().min(1, "Classificação é obrigatória"),
  justificativa: z.string().optional().default(""),
  clientesAtivosMomento: z.number().int().optional().nullable(),
  dataEncerramento: z.string().min(1, "Data de encerramento é obrigatória"),
});

const ImportRequestSchema = z.object({
  clientes: z.array(ClienteSchema).default([]),
  encerramentos: z.array(EncerramentoSchema).default([]),
});

type ValidatedCliente = z.infer<typeof ClienteSchema>;
type ValidatedEncerramento = z.infer<typeof EncerramentoSchema>;

// Normalizar nome do consultor (tratar typos)
function normalizeConsultorName(name: string): string {
  const normalized = name.trim();
  const mappings: Record<string, string> = {
    "Vivan": "Vivian",
    "vivan": "Vivian",
  };
  return mappings[normalized] || normalized;
}

// Separar cidade e UF
function parseCidadeUf(cidadeUf: string): { cidade: string; uf: string } {
  if (!cidadeUf || cidadeUf.trim() === "") {
    return { cidade: "", uf: "" };
  }
  
  const parts = cidadeUf.split("/");
  if (parts.length === 2) {
    return { cidade: parts[0].trim(), uf: parts[1].trim() };
  }
  
  // Se não tem "/", tenta encontrar UF no final (2 letras maiúsculas)
  const match = cidadeUf.match(/^(.+?)\s*[-\/]?\s*([A-Z]{2})$/);
  if (match) {
    return { cidade: match[1].trim(), uf: match[2] };
  }
  
  return { cidade: cidadeUf.trim(), uf: "" };
}

// Normalizar tipo de vencimento
function normalizeTipoVencimento(tipo: string): "antecipado" | "postecipado" {
  const normalized = tipo.toLowerCase().trim();
  if (normalized.includes("antecipado") || normalized.includes("antec")) {
    return "antecipado";
  }
  return "postecipado";
}

// Normalizar classificação de encerramento
function normalizeClassificacao(classificacao: string): "churn" | "fim_contrato" {
  const normalized = classificacao.toLowerCase().trim();
  if (normalized.includes("churn")) {
    return "churn";
  }
  return "fim_contrato";
}

// Converter data DD/MM/YYYY para YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  
  // Se já está no formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Formato DD/MM/YYYY ou D/M/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Requisição sem token de autenticação");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Token de autenticação ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token for auth verification
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the token and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Token inválido:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Usuário autenticado:", userId);

    // ========== AUTHORIZATION CHECK (Admin role required) ==========
    // Use service role to check user_roles (since RLS might block this)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: userRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError) {
      console.error("Erro ao verificar role:", roleError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userRole || userRole.role !== "admin") {
      console.error("Acesso negado - usuário não é admin:", userId);
      return new Response(
        JSON.stringify({ error: "Forbidden - Acesso restrito a administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Usuário autorizado como admin:", userId);

    // ========== INPUT VALIDATION ==========
    let rawData: unknown;
    try {
      rawData = await req.json();
    } catch {
      console.error("Erro ao parsear JSON do body");
      return new Response(
        JSON.stringify({ error: "Body inválido - JSON malformado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parseResult = ImportRequestSchema.safeParse(rawData);
    
    if (!parseResult.success) {
      console.error("Erro de validação:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados de entrada inválidos", 
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientes, encerramentos } = parseResult.data;

    console.log(`Iniciando importação: ${clientes.length} clientes ativos, ${encerramentos.length} encerramentos`);

    // ========== CONTINUE WITH IMPORT LOGIC ==========
    // Now use service role for the actual import operations
    const supabase = adminClient;

    // Buscar consultores existentes
    const { data: consultores, error: consultoresError } = await supabase
      .from("consultores")
      .select("id, nome");
    
    if (consultoresError) throw new Error(`Erro ao buscar consultores: ${consultoresError.message}`);
    
    const consultorMap = new Map<string, string>();
    consultores?.forEach(c => {
      consultorMap.set(c.nome.toLowerCase(), c.id);
    });

    // Buscar tipos de consultoria existentes
    const { data: tiposConsultoria, error: tiposError } = await supabase
      .from("tipos_consultoria")
      .select("id, nome");
    
    if (tiposError) throw new Error(`Erro ao buscar tipos de consultoria: ${tiposError.message}`);
    
    const tipoConsultoriaMap = new Map<string, string>();
    tiposConsultoria?.forEach(t => {
      tipoConsultoriaMap.set(t.nome.toLowerCase(), t.id);
    });

    const results = {
      clientesInseridos: 0,
      contratosInseridos: 0,
      onboardingInseridos: 0,
      atendimentosInseridos: 0,
      encerradosInseridos: 0,
      tiposConsultoriaCriados: [] as string[],
      erros: [] as string[],
    };

    // Processar clientes ativos
    for (const cliente of clientes) {
      try {
        await processCliente(supabase, cliente, consultorMap, tipoConsultoriaMap, results);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.erros.push(`Erro ao processar cliente ${cliente.nome}: ${message}`);
      }
    }

    // Processar encerramentos
    for (const encerramento of encerramentos) {
      try {
        await processEncerramento(supabase, encerramento, results);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.erros.push(`Erro ao processar encerramento ${encerramento.cliente}: ${message}`);
      }
    }

    console.log("Importação concluída:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    console.error("Erro na importação:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// ========== HELPER FUNCTIONS ==========

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processCliente(
  supabase: any,
  cliente: ValidatedCliente,
  consultorMap: Map<string, string>,
  tipoConsultoriaMap: Map<string, string>,
  results: { 
    clientesInseridos: number;
    contratosInseridos: number;
    onboardingInseridos: number;
    atendimentosInseridos: number;
    tiposConsultoriaCriados: string[];
    erros: string[];
  }
) {
  // Encontrar consultor
  const consultorNome = normalizeConsultorName(cliente.consultor);
  const consultorId = consultorMap.get(consultorNome.toLowerCase());
  
  if (!consultorId) {
    console.log(`Consultor não encontrado: ${cliente.consultor}`);
    results.erros.push(`Consultor não encontrado: ${cliente.consultor}`);
    return;
  }

  // Encontrar ou criar tipo de consultoria
  let tipoConsultoriaId = tipoConsultoriaMap.get(cliente.tipoConsultoria.toLowerCase());
  
  if (!tipoConsultoriaId && cliente.tipoConsultoria) {
    const { data: novoTipo, error: tipoError } = await supabase
      .from("tipos_consultoria")
      .insert({ nome: cliente.tipoConsultoria })
      .select("id")
      .single();
    
    if (tipoError) {
      console.log(`Erro ao criar tipo de consultoria: ${tipoError.message}`);
    } else {
      tipoConsultoriaId = novoTipo.id;
      tipoConsultoriaMap.set(cliente.tipoConsultoria.toLowerCase(), novoTipo.id);
      results.tiposConsultoriaCriados.push(cliente.tipoConsultoria);
    }
  }

  // Separar cidade e UF
  const { cidade, uf } = parseCidadeUf(cliente.cidadeUf);

  // Inserir cliente
  const { data: novoCliente, error: clienteError } = await supabase
    .from("clientes")
    .insert({
      nome: cliente.nome,
      consultor_id: consultorId,
      cidade,
      uf,
      status: "ativo",
    })
    .select("id")
    .single();

  if (clienteError) {
    results.erros.push(`Erro ao inserir cliente ${cliente.nome}: ${clienteError.message}`);
    return;
  }

  results.clientesInseridos++;

  // Inserir contrato
  const dataInicio = parseDate(cliente.dataInicio);
  const dataFim = parseDate(cliente.dataFim);
  
  if (!dataInicio || !dataFim) {
    results.erros.push(`Datas inválidas para cliente ${cliente.nome}`);
    return;
  }

  const { data: novoContrato, error: contratoError } = await supabase
    .from("contratos")
    .insert({
      cliente_id: novoCliente.id,
      tipo_consultoria_id: tipoConsultoriaId,
      prazo_meses: cliente.prazoMeses || 12,
      data_inicio: dataInicio,
      data_fim: dataFim,
      remuneracao_total: cliente.remuneracaoTotal || 0,
      parcelas: cliente.parcelas || 12,
      tipo_vencimento: normalizeTipoVencimento(cliente.tipoVencimento),
      remuneracao_mensal: cliente.remuneracaoMensal || (cliente.remuneracaoTotal / (cliente.prazoMeses || 12)),
      momento: cliente.momento || null,
      link_contrato: cliente.linkContrato || null,
      particularidades: cliente.particularidades || null,
      ativo: true,
    })
    .select("id")
    .single();

  if (contratoError) {
    results.erros.push(`Erro ao inserir contrato para ${cliente.nome}: ${contratoError.message}`);
  } else {
    results.contratosInseridos++;
    
    // Inserir onboarding
    const dataPreOnboarding = parseDate(cliente.dataPreOnboarding);
    
    const { error: onboardingError } = await supabase
      .from("onboarding")
      .insert({
        cliente_id: novoCliente.id,
        contrato_id: novoContrato.id,
        data_pre_onboarding: dataPreOnboarding,
        etapa_atual: "concluido",
      });

    if (onboardingError) {
      results.erros.push(`Erro ao inserir onboarding para ${cliente.nome}: ${onboardingError.message}`);
    } else {
      results.onboardingInseridos++;
    }
  }

  // Inserir atendimento padrão
  const { error: atendimentoError } = await supabase
    .from("atendimentos")
    .insert({
      cliente_id: novoCliente.id,
      periodicidade: "quinzenal",
    });

  if (atendimentoError) {
    results.erros.push(`Erro ao inserir atendimento para ${cliente.nome}: ${atendimentoError.message}`);
  } else {
    results.atendimentosInseridos++;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processEncerramento(
  supabase: any,
  encerramento: ValidatedEncerramento,
  results: { 
    encerradosInseridos: number;
    erros: string[];
  }
) {
  // Criar cliente com status encerrado
  const { data: novoCliente, error: clienteError } = await supabase
    .from("clientes")
    .insert({
      nome: encerramento.cliente,
      cidade: "",
      uf: "",
      status: "encerrado",
    })
    .select("id")
    .single();

  if (clienteError) {
    results.erros.push(`Erro ao inserir cliente encerrado ${encerramento.cliente}: ${clienteError.message}`);
    return;
  }

  // Criar contrato inativo
  const dataEncerramento = parseDate(encerramento.dataEncerramento) || new Date().toISOString().split("T")[0];
  
  const { data: novoContrato, error: contratoError } = await supabase
    .from("contratos")
    .insert({
      cliente_id: novoCliente.id,
      prazo_meses: 12,
      data_inicio: dataEncerramento,
      data_fim: dataEncerramento,
      remuneracao_total: encerramento.mrrPerdido * 12,
      parcelas: 12,
      remuneracao_mensal: encerramento.mrrPerdido,
      ativo: false,
    })
    .select("id")
    .single();

  if (contratoError) {
    results.erros.push(`Erro ao inserir contrato para encerrado ${encerramento.cliente}: ${contratoError.message}`);
    return;
  }

  // Criar registro de encerramento
  const { error: encerramentoError } = await supabase
    .from("encerramentos")
    .insert({
      cliente_id: novoCliente.id,
      contrato_id: novoContrato.id,
      data_encerramento: dataEncerramento,
      classificacao: normalizeClassificacao(encerramento.classificacao),
      justificativa: encerramento.justificativa || null,
      mrr_perdido: encerramento.mrrPerdido || 0,
      clientes_ativos_momento: encerramento.clientesAtivosMomento || null,
    });

  if (encerramentoError) {
    results.erros.push(`Erro ao inserir encerramento para ${encerramento.cliente}: ${encerramentoError.message}`);
  } else {
    results.encerradosInseridos++;
  }
}
