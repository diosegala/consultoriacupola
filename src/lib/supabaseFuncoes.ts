import { supabase } from '@/integrations/supabase/client';

// O .env saiu do repositório (commit 515fa25), então no build do Lovable
// `import.meta.env.VITE_SUPABASE_*` chega vazio e um fetch montado com ele vira
// `undefined/functions/v1/...`: vai para o próprio site, volta o HTML do app com
// status 200 e a chamada "funciona" sem nunca chegar ao Supabase.
// O cliente gerado já carrega o endereço e a chave publicável; a fonte é ele.
const cliente = supabase as unknown as { supabaseUrl: string; supabaseKey: string };

export const SUPABASE_URL = cliente.supabaseUrl;
export const SUPABASE_CHAVE_PUBLICA = cliente.supabaseKey;

/** Endereço de uma edge function, para as chamadas que precisam de `fetch` (stream, SSE). */
export const urlDaFuncao = (nome: string) => `${SUPABASE_URL}/functions/v1/${nome}`;
