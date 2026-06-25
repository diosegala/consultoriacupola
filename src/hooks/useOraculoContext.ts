import { useLocation, useParams, matchPath } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OraculoContexto {
  resumo: string;
  origem: { tipo: string; id?: string; nome?: string };
}

export function useOraculoContext(): { contexto: OraculoContexto | null; loading: boolean } {
  const location = useLocation();
  const path = location.pathname;

  const clienteMatch = matchPath("/clientes/:id", path);
  const consultorMatch = matchPath("/consultores/:id", path);

  const clienteId = clienteMatch?.params?.id;
  const consultorId = consultorMatch?.params?.id;

  const clienteQuery = useQuery({
    queryKey: ["oraculo-ctx-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, cidade, uf, status")
        .eq("id", clienteId!)
        .maybeSingle();
      return data;
    },
  });

  const consultorQuery = useQuery({
    queryKey: ["oraculo-ctx-consultor", consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("id", consultorId!)
        .maybeSingle();
      return data;
    },
  });

  if (clienteId && clienteQuery.data) {
    const c = clienteQuery.data as any;
    return {
      contexto: {
        resumo: `Cliente: ${c.nome}${c.cidade ? ` (${c.cidade}/${c.uf})` : ""}. Status: ${c.status ?? "n/d"}.`,
        origem: { tipo: "cliente", id: c.id, nome: c.nome },
      },
      loading: false,
    };
  }
  if (consultorId && consultorQuery.data) {
    const c = consultorQuery.data as any;
    return {
      contexto: {
        resumo: `Consultor em análise: ${c.nome}.`,
        origem: { tipo: "consultor", id: c.id, nome: c.nome },
      },
      loading: false,
    };
  }
  if (path.startsWith("/projetos")) {
    return {
      contexto: { resumo: "O consultor está visualizando o quadro de projetos.", origem: { tipo: "projetos" } },
      loading: false,
    };
  }
  if (path.startsWith("/reunioes")) {
    return {
      contexto: { resumo: "O consultor está na tela de reuniões.", origem: { tipo: "reunioes" } },
      loading: false,
    };
  }
  if (path.startsWith("/agenda")) {
    return {
      contexto: { resumo: "O consultor está na agenda do Google.", origem: { tipo: "agenda" } },
      loading: false,
    };
  }
  return { contexto: null, loading: clienteQuery.isLoading || consultorQuery.isLoading };
}