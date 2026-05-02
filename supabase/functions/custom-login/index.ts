import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Helpers ──────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateToken(userId: string, role: string, professorId: string, matricula: string) {
  const sessionId = crypto.randomUUID();
  const tokenPayload = {
    sub: professorId,
    uid: userId,
    role,
    mat: matricula,
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
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return btoa(payloadStr) + "." + sigHex;
}

async function checkRateLimit(ip: string, identifier: string): Promise<boolean> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .eq("success", false)
    .gte("created_at", fifteenMinAgo);

  return (count || 0) >= 5;
}

async function logAttempt(ip: string, success: boolean, cpf?: string, email?: string, matricula?: string) {
  await supabase.from("login_attempts").insert({
    ip_address: ip,
    cpf: cpf || null,
    email: email || null,
    matricula: matricula || null,
    success,
  });
}

// ── Main Handler ─────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const body = await req.json();
    const mode = String(body.mode || "professor").trim();

    // Rate limiting
    const rateLimited = await checkRateLimit(ip, mode === "admin" ? body.email : body.cpf);
    if (rateLimited) {
      return jsonResponse({ error: "Muitas tentativas. Tente novamente em 15 minutos." }, 429);
    }

    // ═══════════════════════════════════════════════════════
    // MODE: ADMIN (email + senha)
    // ═══════════════════════════════════════════════════════
    if (mode === "admin") {
      const email = String(body.email || "").trim().toLowerCase();
      const senha = String(body.senha || "").trim();

      if (!email || !senha || email.length > 200 || senha.length > 100) {
        return jsonResponse({ error: "E-mail e senha são obrigatórios." }, 400);
      }

      // Find user by email
      const { data: user, error: fetchErr } = await supabase
        .from("users")
        .select("id, cpf, email, senha_hash, role, status")
        .eq("email", email)
        .in("role", ["admin", "juridico"])
        .maybeSingle();

      if (fetchErr || !user || !user.senha_hash) {
        await logAttempt(ip, false, undefined, email);
        return jsonResponse({ error: "E-mail ou senha incorretos." }, 401);
      }

      // Verify password
      const { data: matchResult } = await supabase.rpc("verify_password", {
        plain_password: senha,
        hashed_password: user.senha_hash,
      });

      if (!matchResult) {
        await logAttempt(ip, false, undefined, email);
        return jsonResponse({ error: "E-mail ou senha incorretos." }, 401);
      }

      if (user.status === "Inativo") {
        return jsonResponse({ error: "Sua conta está inativa. Entre em contato com a administração." }, 403);
      }

      // Get the admin/juridico professor record (optional)
      const { data: prof } = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const professorData = prof || {
        id: user.id,
        nome: user.role === 'admin' ? "Administrador" : "Equipe Jurídica",
        cpf: user.cpf || "00000000000",
        matricula: user.role.toUpperCase(),
        data_nascimento: null,
        vinculo_inicio: null,
        vinculo_fim: null,
        total_cotas: 0,
        status: user.status,
        role: user.role,
        user_id: user.id
      };

      await logAttempt(ip, true, undefined, email);

      const token = await generateToken(user.id, user.role, professorData.id, professorData.matricula);

      return jsonResponse({
        success: true,
        token,
        professor: professorData,
      });
    }

    // ═══════════════════════════════════════════════════════
    // MODE: PROFESSOR (cpf + senha)
    // ═══════════════════════════════════════════════════════
    const cpf = String(body.cpf || "").trim().replace(/\D/g, "");
    const senha = String(body.senha || "").trim();
    const selectedMatriculaId = body.matricula_id || null;

    if (!cpf || !senha || cpf.length > 14 || senha.length > 100) {
      return jsonResponse({ error: "CPF e senha são obrigatórios." }, 400);
    }

    // Find user by CPF
    const { data: user, error: fetchErr } = await supabase
      .from("users")
      .select("id, cpf, senha_hash, role, status")
      .eq("cpf", cpf)
      .maybeSingle();

    if (fetchErr || !user || !user.senha_hash) {
      await logAttempt(ip, false, cpf);
      return jsonResponse({ error: "CPF ou senha incorretos." }, 401);
    }

    // Verify password
    const { data: matchResult } = await supabase.rpc("verify_password", {
      plain_password: senha,
      hashed_password: user.senha_hash,
    });

    if (!matchResult) {
      await logAttempt(ip, false, cpf);
      return jsonResponse({ error: "CPF ou senha incorretos." }, 401);
    }

    if (user.status === "Inativo") {
      return jsonResponse({ error: "Sua conta está inativa. Entre em contato com a administração." }, 403);
    }

    // Get all matrículas linked to this user
    const { data: matriculas, error: matErr } = await supabase
      .from("professors")
      .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, user_id")
      .eq("user_id", user.id)
      .order("vinculo_inicio", { ascending: false });

    if (matErr || !matriculas || matriculas.length === 0) {
      await logAttempt(ip, false, cpf);
      return jsonResponse({ error: "Nenhuma matrícula vinculada a este CPF." }, 401);
    }

    // If there's a specific matrícula selected
    if (selectedMatriculaId) {
      const selected = matriculas.find((m) => m.id === selectedMatriculaId);
      if (!selected) {
        return jsonResponse({ error: "Matrícula não encontrada." }, 404);
      }

      await logAttempt(ip, true, cpf, undefined, selected.matricula);
      const token = await generateToken(user.id, selected.role, selected.id, selected.matricula);
      const { user_id: _, ...safeProf } = selected;
      return jsonResponse({ professor: safeProf, token });
    }

    // If only one matrícula, log in directly
    if (matriculas.length === 1) {
      const prof = matriculas[0];
      await logAttempt(ip, true, cpf, undefined, prof.matricula);
      const token = await generateToken(user.id, prof.role, prof.id, prof.matricula);
      const { user_id: _, ...safeProf } = prof;
      return jsonResponse({ professor: safeProf, token });
    }

    // Multiple matrículas: return the list for the user to choose
    await logAttempt(ip, true, cpf);
    const safeMatriculas = matriculas.map(({ user_id: _, senha_hash: _h, ...rest }) => rest);
    return jsonResponse({
      multiple_matriculas: true,
      matriculas: safeMatriculas,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
