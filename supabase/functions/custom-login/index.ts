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
    const tipo = String(body.tipo || "").trim().toLowerCase(); // "admin" ou vazio
    const rawId = String(body.identificador || body.email || body.cpf || body.matricula || "").trim();
    const senha = String(body.senha || "").trim();

    if (!rawId || !senha || rawId.length > 100 || senha.length > 100) {
      return new Response(
        JSON.stringify({ error: "Credenciais obrigatórias." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let professor: any = null;
    let fetchErr: any = null;

    if (tipo === "admin" || rawId.includes("@")) {
      // Login por e-mail (admin/jurídico) na tabela users
      const email = rawId.toLowerCase();
      const u = await supabase
        .from("users")
        .select("id, email, role, status, senha_hash")
        .ilike("email", email)
        .maybeSingle();
      if (u.data) {
        professor = {
          id: u.data.id,
          nome: u.data.role === "admin" ? "Administrador" : "Jurídico",
          cpf: "",
          matricula: u.data.email,
          data_nascimento: null,
          vinculo_inicio: null,
          vinculo_fim: null,
          total_cotas: 0,
          status: u.data.status,
          role: u.data.role,
          senha_hash: u.data.senha_hash,
        };
      }
      fetchErr = u.error;
    } else {
      // Login professor por CPF (com fallback matrícula)
      const identificador = rawId.replace(/\D/g, "") || rawId;
      const r = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, senha_hash")
        .eq("cpf", identificador)
        .maybeSingle();
      professor = r.data;
      fetchErr = r.error;
      if (!professor) {
        const fb = await supabase
          .from("professors")
          .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, senha_hash")
          .eq("matricula", identificador)
          .maybeSingle();
        professor = fb.data;
        fetchErr = fb.error;
      }
    }

    if (fetchErr || !professor || !professor.senha_hash) {
      await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: false });
      return new Response(
        JSON.stringify({ error: "Credenciais incorretas." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password with bcrypt via database function
    const { data: matchResult } = await supabase.rpc("verify_password", {
      plain_password: senha,
      hashed_password: professor.senha_hash,
    });

    if (!matchResult) {
      await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: false });
      return new Response(
        JSON.stringify({ error: "Credenciais incorretas." }),
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
    await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: true });

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
