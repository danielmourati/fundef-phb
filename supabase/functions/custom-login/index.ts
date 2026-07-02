import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const onlyDigits = (value: string | null | undefined) => String(value || "").replace(/\D/g, "");

const passwordMatchesBirthDate = (input: string, birthDate: string | null | undefined) => {
  const senhaDigits = onlyDigits(input);
  const dateDigits = onlyDigits(birthDate);
  if (!senhaDigits || dateDigits.length !== 8) return false;

  const rawDate = String(birthDate || "").trim();
  const iso = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return senhaDigits === `${iso[3]}${iso[2]}${iso[1]}`;

  return senhaDigits === dateDigits;
};

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
    const tipoRaw = String(body.tipo || "").trim().toLowerCase(); // "admin" | "efetivo" | "contratado" | ""
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
    let requires_password_change = false;
    // Tabela de origem do login (para incluir na claim do token)
    let sourceTipo: "efetivo" | "contratado" | "admin" = "efetivo";

    if (tipoRaw === "admin" || rawId.includes("@")) {
      // Login por e-mail (admin/jurídico) na tabela users
      sourceTipo = "admin";
      const email = rawId.toLowerCase();
      const u = await supabase
        .from("users")
        .select("id, email, role, senha_hash")
        .ilike("email", email)
        .maybeSingle();
      if (u.data) {
        professor = {
          id: u.data.id,
          nome: u.data.role === "admin" ? "Administrador" : "Jurídico",
          email: u.data.email,
          cpf: "",
          matricula: u.data.email,
          data_nascimento: null,
          vinculo_inicio: null,
          vinculo_fim: null,
          total_cotas: 0,
          role: u.data.role,
          senha_hash: u.data.senha_hash,
        };
      }
      fetchErr = u.error;
    } else if (tipoRaw === "contratado") {
      // Login professor contratado por CPF na tabela contratados (+ períodos)
      sourceTipo = "contratado";
      const identificador = rawId.replace(/\D/g, "") || rawId;
      const r = await supabase
        .from("contratados")
        .select("id, nome, cpf, matricula, data_nascimento, carga_horaria, total_cotas, cargo, vinculo, role, status, senha_hash")
        .eq("cpf", identificador)
        .order("matricula", { ascending: true });
      let candidates = r.data || [];
      fetchErr = r.error;
      if (candidates.length === 0) {
        const fb = await supabase
          .from("contratados")
          .select("id, nome, cpf, matricula, data_nascimento, carga_horaria, total_cotas, cargo, vinculo, role, status, senha_hash")
          .eq("matricula", identificador);
        candidates = fb.data || [];
        fetchErr = fb.error;
      }
      for (const c of candidates) {
        let ok = false;
        if (c.senha_hash) {
          const { data } = await supabase.rpc("verify_password", {
            plain_password: senha,
            hashed_password: c.senha_hash,
          });
          ok = !!data;
        }
        if (!ok && (passwordMatchesBirthDate(senha, c.data_nascimento) || onlyDigits(senha) === onlyDigits(c.cpf))) {
          ok = true;
        }
        if (ok) {
          professor = { ...c, vinculo_inicio: null, vinculo_fim: null };
          if (onlyDigits(senha) === onlyDigits(c.cpf)) requires_password_change = true;
          break;
        }
      }
    } else {
      // Login professor efetivo por CPF na tabela professors (comportamento atual)
      sourceTipo = "efetivo";
      const identificador = rawId.replace(/\D/g, "") || rawId;
      const r = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, carga_horaria, total_cotas, cargo, role, status, senha_hash")
        .eq("cpf", identificador)
        .order("matricula", { ascending: true });
      let candidates = r.data || [];
      fetchErr = r.error;
      if (candidates.length === 0) {
        const fb = await supabase
          .from("professors")
          .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, carga_horaria, total_cotas, cargo, role, status, senha_hash")
          .eq("matricula", identificador);
        candidates = fb.data || [];
        fetchErr = fb.error;
      }

      // Encontrar a primeira linha cuja senha bata
      for (const c of candidates) {
        let ok = false;
        if (c.senha_hash) {
          const { data } = await supabase.rpc("verify_password", {
            plain_password: senha,
            hashed_password: c.senha_hash,
          });
          ok = !!data;
        }

        if (!ok && (passwordMatchesBirthDate(senha, c.data_nascimento) || onlyDigits(senha) === onlyDigits(c.cpf))) {
          ok = true;
        }
        if (ok) {
          professor = c;
          if (onlyDigits(senha) === onlyDigits(c.cpf)) {
            requires_password_change = true;
          }
          break;
        }
      }
    }


    if (fetchErr || !professor) {
      await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: false });
      return new Response(
        JSON.stringify({ error: "Credenciais incorretas." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Para admin/juridico ainda precisamos validar senha (não passou no loop acima)
    if (professor.role === "admin" || professor.role === "juridico") {
      let matchResult = false;
      if (professor.senha_hash) {
        const { data } = await supabase.rpc("verify_password", {
          plain_password: senha,
          hashed_password: professor.senha_hash,
        });
        matchResult = !!data;
      }
      if (!matchResult) {
        await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: false });
        return new Response(
          JSON.stringify({ error: "Credenciais incorretas." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // (status field removed — no inactive blocking by status)

    // Log successful attempt
    await supabase.from("login_attempts").insert({ ip_address: ip, matricula: rawId, success: true });

    // Helper para gerar token HMAC por matrícula (8h)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SERVICE_ROLE_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sessionId = crypto.randomUUID();
    const signToken = async (sub: string, role: string, mat: string) => {
      const payload = { sub, role, mat, sid: sessionId, tipo: sourceTipo, exp: Date.now() + 8 * 60 * 60 * 1000 };
      const payloadStr = JSON.stringify(payload);
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
      const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
      return btoa(payloadStr) + "." + sigHex;
    };

    // Para professor efetivo: buscar TODAS as matrículas vinculadas ao mesmo CPF
    let matriculas: Array<any> = [];
    if (sourceTipo === "efetivo" && professor.role === "professor" && professor.cpf) {
      const all = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, carga_horaria, total_cotas, cargo, role, status")
        .eq("cpf", professor.cpf)
        .order("matricula", { ascending: true });
      const rows = all.data || [];
      matriculas = await Promise.all(rows.map(async (r) => ({
        ...r,
        token: await signToken(r.id, r.role, r.matricula),
      })));
    }

    // Para contratado: anexar os períodos trabalhados do contratado logado
    let periodos: Array<{ inicio: string; fim: string; ordem: number }> = [];
    if (sourceTipo === "contratado") {
      const { data: pers } = await supabase
        .from("contratado_periodos")
        .select("inicio, fim, ordem")
        .eq("contratado_id", professor.id)
        .order("ordem", { ascending: true });
      periodos = pers || [];
    }

    const token = await signToken(professor.id, professor.role, professor.matricula);

    // Return professor data (without sensitive fields) + token + matriculas + periodos + tipo
    const { senha_hash: _, ...safeProf } = professor;
    return new Response(
      JSON.stringify({ professor: { ...safeProf, tipo: sourceTipo, periodos }, token, matriculas, requires_password_change, tipo: sourceTipo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
