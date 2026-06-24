import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_DATABASES = [
  "1a035c7b74608022a85fe26026dbb2d9",
];

async function notionFetch(url: string, key: string, body?: unknown) {
  return fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function plainTextFromRich(rich: any[]): string {
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => r?.plain_text ?? "").join("");
}

function titleFromProperties(props: Record<string, any>): string {
  for (const key of Object.keys(props || {})) {
    const p = props[key];
    if (p?.type === "title") return plainTextFromRich(p.title);
  }
  return "(Sem título)";
}

async function fetchAllBlocks(pageId: string, key: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const res = await notionFetch(url.toString(), key);
    if (!res.ok) break;
    const data = await res.json();
    blocks.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function blocksToText(blocks: any[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    const t = b?.type;
    if (!t) continue;
    const node = b[t];
    if (node?.rich_text) {
      const text = plainTextFromRich(node.rich_text);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const notionKey = Deno.env.get("NOTION_API_KEY");
    if (!notionKey) {
      return new Response(JSON.stringify({ error: "NOTION_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autenticação: apenas admins
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const service = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas admins podem sincronizar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const databases: string[] = Array.isArray(body?.databases) && body.databases.length > 0
      ? body.databases
      : DEFAULT_DATABASES;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const databaseId of databases) {
      let cursor: string | undefined;
      do {
        const queryRes = await notionFetch(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          notionKey,
          { page_size: 100, start_cursor: cursor },
        );
        if (!queryRes.ok) {
          const errText = await queryRes.text();
          console.error("Notion query error:", queryRes.status, errText);
          break;
        }
        const queryData = await queryRes.json();
        for (const page of queryData.results || []) {
          const pageId = page.id;
          const title = titleFromProperties(page.properties || {});
          const blocks = await fetchAllBlocks(pageId, notionKey);
          const content = blocksToText(blocks);

          const { data: existing } = await service
            .from("notion_documents")
            .select("id, last_edited_time")
            .eq("notion_page_id", pageId)
            .maybeSingle();

          if (existing) {
            if (existing.last_edited_time && existing.last_edited_time === page.last_edited_time) {
              skipped++;
              continue;
            }
            await service
              .from("notion_documents")
              .update({
                title, content, url: page.url,
                last_edited_time: page.last_edited_time,
                data_source_id: databaseId,
              })
              .eq("id", existing.id);
            updated++;
          } else {
            await service.from("notion_documents").insert({
              notion_page_id: pageId,
              data_source_id: databaseId,
              title, content, url: page.url,
              last_edited_time: page.last_edited_time,
            });
            inserted++;
          }
        }
        cursor = queryData.has_more ? queryData.next_cursor : undefined;
        if (cursor) await new Promise((r) => setTimeout(r, 200));
      } while (cursor);
    }

    return new Response(JSON.stringify({ inserted, updated, skipped, databases }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oraculo-sync-notion error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});