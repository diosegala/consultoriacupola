import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Email, senha e papel são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role !== "consultor" && role !== "director") {
      return new Response(JSON.stringify({ error: "Papel inválido. Use 'consultor' ou 'director'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with admin API. If the email already exists in auth.users
    // (e.g. the role row was deleted but the auth user wasn't), reuse it and
    // reset the password so the admin's chosen password takes effect.
    let userId: string | null = null;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        msg.includes("duplicate");
      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Find the existing auth user by email and reset their password.
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers();
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: "Usuário já existe mas não foi possível localizá-lo." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = existing.id;
    } else {
      userId = newUser.user.id;
    }

    // Upsert role with force_password_change
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: userId, role, force_password_change: true },
        { onConflict: "user_id,role" }
      );

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
