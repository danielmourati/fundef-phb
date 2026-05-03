import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate limiting: check IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("cf-connecting-ip") || "unknown";

    // Count recent failed attempts from this IP (last 15 min)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("success", false)
      .gte("created_at", fifteenMinAgo);

    if ((count || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em 15 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const body = await req.json();
    // Aceita "identificador" (CPF preferencial) ou os campos legados "cpf"/"matricula"
    const rawId = String(body.identificador || body.cpf || body.matricula || "").trim();
    const senha = String(body.senha || "").trim();
    const identificador = rawId.replace(/\D/g, "") || rawId; // normaliza CPF removendo pontuação

    if (!identificador || !senha || identificador.length > 50 || senha.length > 50) {
      return new Response(
        JSON.stringify({ error: "CPF e senha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca por CPF (forma padrão); fallback por matrícula para compatibilidade
    let { data: professor, error: fetchErr } = await supabase
      .from("professors")
      .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, senha_hash")
      .eq("cpf", identificador)
      .maybeSingle();

    if (!professor) {
      const fb = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, senha_hash")
        .eq("matricula", identificador)
        .maybeSingle();
      professor = fb.data;
      fetchErr = fb.error;
    }

    if (fetchErr || !professor || !professor.senha_hash) {
      await supabase.from("login_attempts").insert({ ip_address: ip, matricula: identificador, success: false });
      return new Response(
        JSON.stringify({ error: "CPF ou senha incorretos." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password with bcrypt via database function
    const { data: matchResult } = await supabase.rpc("verify_password", {
      plain_password: senha,
      hashed_password: professor.senha_hash,
    });

    if (!matchResult) {
      await supabase.from("login_attempts").insert({ ip_address: ip, matricula: identificador, success: false });
      return new Response(
        JSON.stringify({ error: "CPF ou senha incorretos." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block inactive users
    if (professor.status === "Inativo") {
      return new Response(
        JSON.stringify({ error: "Sua conta está inativa. Entre em contato com a administração." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful attempt
    await supabase.from("login_attempts").insert({ ip_address: ip, matricula, success: true });

    // Generate a simple session token (HMAC-based)
    const sessionId = crypto.randomUUID();
    const tokenPayload = {
      sub: professor.id,
      role: professor.role,
      mat: professor.matricula,
      sid: sessionId,
      exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
    };

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SERVICE_ROLE_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const payloadStr = JSON.stringify(tokenPayload);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
    const token = btoa(payloadStr) + "." + sigHex;

    // Return professor data (without sensitive fields) + token
    const { senha_hash: _, ...safeProf } = professor;
    return new Response(
      JSON.stringify({ professor: safeProf, token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
