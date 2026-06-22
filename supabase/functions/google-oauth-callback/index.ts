import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "code e redirect_uri obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find consultor for this user
    const { data: cu } = await admin
      .from("consultor_user").select("consultor_id").eq("user_id", userId).maybeSingle();
    if (!cu?.consultor_id) {
      return new Response(JSON.stringify({ error: "Usuário não está vinculado a um consultor" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for tokens
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed", tokens);
      return new Response(JSON.stringify({ error: tokens.error_description || "Falha ao trocar code por tokens" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token, refresh_token, expires_in, scope } = tokens;
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: "Refresh token não recebido. Tente revogar o acesso e reconectar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const email = userInfo.email as string;

    // Find Meet Recordings folder — prefer folder owned by the connected account
    const folderFields = "files(id,name,webViewLink,owners(emailAddress))";
    async function findFolder(query: string) {
      const r = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) +
        "&fields=" + encodeURIComponent(folderFields),
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const d = await r.json();
      return (d.files || [])[0] || null;
    }
    let folder = await findFolder(
      "name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'me' in owners"
    );
    if (!folder) {
      folder = await findFolder(
        "name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false"
      );
    }
    const folderId: string | null = folder?.id || null;
    const folderNome: string | null = folder?.name || null;
    const folderLink: string | null = folder?.webViewLink || null;
    const folderOwner: string | null = folder?.owners?.[0]?.emailAddress || null;

    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();

    // Upsert
    const { error: upErr } = await admin
      .from("consultor_google_tokens")
      .upsert({
        consultor_id: cu.consultor_id,
        email_google: email,
        access_token,
        refresh_token,
        expires_at: expiresAt,
        escopo: scope || "",
        pasta_meet_id: folderId,
        pasta_meet_nome: folderNome,
        pasta_meet_link: folderLink,
        pasta_meet_owner_email: folderOwner,
        ativo: true,
      }, { onConflict: "consultor_id" });

    if (upErr) {
      console.error("Upsert error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true, email, pasta_meet_encontrada: !!folderId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});