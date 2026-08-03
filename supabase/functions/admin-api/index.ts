import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Aceita "40", "40H", "20/40", "20 / 40H" -> "40", "20/40"
function normCarga(v: unknown): string | null {
  const s = String(v ?? "").toUpperCase().replace(/[^0-9/]/g, "");
  const m = s.match(/^\d{1,3}(?:\/\d{1,3})*/);
  return m ? m[0] : null;
}

async function verifyToken(authHeader: string | null): Promise<{ sub: string; role: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 0) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigHex = token.slice(dotIdx + 1);

  try {
    const payloadStr = atob(payloadB64);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(SERVICE_ROLE_KEY),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadStr));
    if (!valid) return null;

    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await verifyToken(req.headers.get("authorization"));
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Acesso negado." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET professors (paginated, server-side)
    if (req.method === "GET" && action === "professors") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
      const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10) || 50;
      const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 50;
      const search = (url.searchParams.get("search") || "").trim();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("professors")
        .select(
          "id, matricula, nome, cpf, data_nascimento, vinculo_inicio, vinculo_fim, carga_horaria, total_cotas, cargo, status, role",
          { count: "exact" },
        )
        .order("nome")
        .range(from, to);

      if (search) {
        const digits = search.replace(/\D/g, "");
        const ors = [
          `nome.ilike.%${search}%`,
          `matricula.ilike.%${search}%`,
          `cargo.ilike.%${search}%`,
        ];
        if (digits) ors.push(`cpf.ilike.%${digits}%`);
        q = q.or(ors.join(","));
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return jsonResponse({ rows: data || [], total: count || 0, page, pageSize });
    }

    // GET professors stats (count only)
    if (req.method === "GET" && action === "professors_stats") {
      const [pRes, cRes] = await Promise.all([
        supabase.from("professors").select("id", { count: "exact", head: true }),
        supabase.from("contratados").select("id", { count: "exact", head: true }),
      ]);
      if (pRes.error) throw pRes.error;
      return jsonResponse({ total: pRes.count || 0, totalContratados: cRes.count || 0 });
    }

    // ============================================================
    // ==================== CONTRATADOS ===========================
    // ============================================================

    // GET contratados (paginated)
    if (req.method === "GET" && action === "contratados") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
      const rawSize = parseInt(url.searchParams.get("pageSize") || "50", 10) || 50;
      const pageSize = [25, 50, 100].includes(rawSize) ? rawSize : 50;
      const search = (url.searchParams.get("search") || "").trim();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from("contratados")
        .select("id, nome, cpf, matricula, data_nascimento, carga_horaria, total_cotas, cargo, vinculo, status, role", { count: "exact" })
        .order("nome")
        .range(from, to);

      if (search) {
        const digits = search.replace(/\D/g, "");
        const ors = [
          `nome.ilike.%${search}%`,
          `matricula.ilike.%${search}%`,
          `cargo.ilike.%${search}%`,
        ];
        if (digits) ors.push(`cpf.ilike.%${digits}%`);
        q = q.or(ors.join(","));
      }

      const { data, error, count } = await q;
      if (error) throw error;

      // Anexa períodos de cada contratado
      const ids = (data || []).map((r: any) => r.id);
      const periodosByContratado: Record<string, any[]> = {};
      if (ids.length > 0) {
        const { data: pers } = await supabase
          .from("contratado_periodos")
          .select("id, contratado_id, inicio, fim, ordem")
          .in("contratado_id", ids)
          .order("ordem", { ascending: true });
        for (const p of pers || []) {
          (periodosByContratado[p.contratado_id] ||= []).push(p);
        }
      }
      const rows = (data || []).map((r: any) => ({ ...r, periodos: periodosByContratado[r.id] || [] }));
      return jsonResponse({ rows, total: count || 0, page, pageSize });
    }

    // GET contratados stats
    if (req.method === "GET" && action === "contratados_stats") {
      const { count, error } = await supabase.from("contratados").select("id", { count: "exact", head: true });
      if (error) throw error;
      return jsonResponse({ total: count || 0 });
    }

    // GET all contratados (chunked, for import dedup)
    if (req.method === "GET" && action === "contratados_all") {
      const all: any[] = [];
      const chunk = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("contratados")
          .select("id, cpf, matricula")
          .order("nome")
          .range(from, from + chunk - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < chunk) break;
        from += chunk;
      }
      return jsonResponse(all);
    }

    // POST create contratado
    if (req.method === "POST" && action === "create_contratado") {
      const body = await req.json();
      const cpf = String(body.cpf || "").replace(/\D/g, "");
      if (!body.nome || !cpf) throw new Error("Nome e CPF são obrigatórios.");
      const senha = body.senha || cpf;
      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });
      const { data: inserted, error } = await supabase.from("contratados").insert({
        nome: String(body.nome).trim(),
        cpf,
        matricula: body.matricula || null,
        data_nascimento: body.data_nascimento || null,
        carga_horaria: normCarga(body.carga_horaria) || "20",
        total_cotas: Number(body.total_cotas) || 0,
        cargo: body.cargo || "PROFESSOR(A) EJA",
        vinculo: body.vinculo || "Contratado",
        status: (body.status || "ATIVO").toUpperCase(),
        senha_hash: hashData,
        role: "professor",
      }).select("id").single();
      if (error) throw error;
      const periodos = Array.isArray(body.periodos) ? body.periodos : [];
      const perRows = periodos
        .filter((p: any) => p && p.inicio && p.fim)
        .map((p: any, i: number) => ({
          contratado_id: inserted.id,
          inicio: String(p.inicio).trim(),
          fim: String(p.fim).trim(),
          ordem: i,
        }));
      if (perRows.length > 0) {
        const { error: pe } = await supabase.from("contratado_periodos").insert(perRows);
        if (pe) throw pe;
      }
      return jsonResponse({ success: true, id: inserted.id });
    }

    // PUT update contratado
    if (req.method === "PUT" && action === "update_contratado") {
      const body = await req.json();
      const id = body.id;
      if (!id) throw new Error("ID obrigatório.");
      const cpf = String(body.cpf || "").replace(/\D/g, "");
      const update: Record<string, unknown> = {
        nome: body.nome, cpf, matricula: body.matricula || null,
        data_nascimento: body.data_nascimento || null,
        carga_horaria: normCarga(body.carga_horaria) || "20",
        total_cotas: Number(body.total_cotas) || 0,
        cargo: body.cargo || "PROFESSOR(A) EJA",
        vinculo: body.vinculo || "Contratado",
        status: (body.status || "ATIVO").toUpperCase(),
      };
      if (body.senha && body.senha !== "***") {
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: body.senha });
        update.senha_hash = hashData;
      }
      const { error } = await supabase.from("contratados").update(update).eq("id", id);
      if (error) throw error;
      // Substitui períodos
      await supabase.from("contratado_periodos").delete().eq("contratado_id", id);
      const periodos = Array.isArray(body.periodos) ? body.periodos : [];
      const perRows = periodos
        .filter((p: any) => p && p.inicio && p.fim)
        .map((p: any, i: number) => ({
          contratado_id: id, inicio: String(p.inicio).trim(), fim: String(p.fim).trim(), ordem: i,
        }));
      if (perRows.length > 0) {
        const { error: pe } = await supabase.from("contratado_periodos").insert(perRows);
        if (pe) throw pe;
      }
      return jsonResponse({ success: true });
    }

    // DELETE contratado
    if (req.method === "DELETE" && action === "delete_contratado") {
      const id = url.searchParams.get("id");
      if (!id) throw new Error("ID obrigatório.");
      const { error } = await supabase.from("contratados").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // POST import contratados
    if (req.method === "POST" && action === "import_contratados") {
      const body = await req.json();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      // Agrupa por CPF: mesmo CPF gera 1 contratado com múltiplos períodos
      const groups = new Map<string, { data: any; periodos: Array<{ inicio: string; fim: string }> }>();
      for (const r of rows) {
        const cpf = String(r.cpf || "").replace(/\D/g, "");
        if (!cpf || cpf.length !== 11) continue;
        if (!groups.has(cpf)) {
          groups.set(cpf, {
            data: {
              nome: String(r.nome || "").trim(),
              cpf,
              matricula: (r.matricula || "").toString().trim() || null,
              data_nascimento: r.data_nascimento || null,
              carga_horaria: normCarga(r.carga_horaria) || "20",
              total_cotas: Math.min(parseInt(String(r.total_cotas || "").replace(/\D/g, "")) || 0, 10000),
              cargo: (r.cargo && String(r.cargo).trim()) || "PROFESSOR(A) EJA",
              vinculo: r.vinculo || "Contratado",
              status: (r.status || "ATIVO").toString().toUpperCase(),
            },
            periodos: [],
          });
        }
        const g = groups.get(cpf)!;
        // Períodos vindos como "MM/AAAA a MM/AAAA; MM/AAAA a MM/AAAA" ou já parseados
        const periodosStr = String(r.periodos || r.periodo_trabalhado || r.periodo || "").trim();
        if (periodosStr) {
          const parts = periodosStr.split(/[;|\n]/).map(s => s.trim()).filter(Boolean);
          for (const p of parts) {
            const m = p.match(/(\d{2}\/\d{4})\s*(?:a|até|-|→)\s*(\d{2}\/\d{4})/i);
            if (m) g.periodos.push({ inicio: m[1], fim: m[2] });
          }
        }
        // Aceita também array de períodos já estruturado
        if (Array.isArray(r.periodos_parsed)) {
          for (const p of r.periodos_parsed) {
            if (p?.inicio && p?.fim) g.periodos.push({ inicio: p.inicio, fim: p.fim });
          }
        }
      }

      // Filtra já existentes (por CPF)
      const cpfs = [...groups.keys()];
      let skipped = 0;
      if (cpfs.length === 0) return jsonResponse({ success: true, count: 0, skipped: 0 });
      const { data: existing } = await supabase.from("contratados").select("cpf").in("cpf", cpfs);
      const existSet = new Set((existing || []).map((r: any) => r.cpf));
      const toInsert: any[] = [];
      const orderedGroups: Array<{ cpf: string; periodos: Array<{ inicio: string; fim: string }> }> = [];
      for (const [cpf, g] of groups) {
        if (existSet.has(cpf)) { skipped++; continue; }
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: cpf });
        toInsert.push({ ...g.data, senha_hash: hashData, role: "professor" });
        orderedGroups.push({ cpf, periodos: g.periodos });
      }
      if (toInsert.length === 0) return jsonResponse({ success: true, count: 0, skipped });
      const { data: inserted, error } = await supabase.from("contratados").insert(toInsert).select("id, cpf");
      if (error) throw error;
      const idByCpf = new Map((inserted || []).map((r: any) => [r.cpf, r.id]));
      const periodoRows: any[] = [];
      for (const g of orderedGroups) {
        const id = idByCpf.get(g.cpf);
        if (!id) continue;
        g.periodos.forEach((p, i) => periodoRows.push({ contratado_id: id, inicio: p.inicio, fim: p.fim, ordem: i }));
      }
      if (periodoRows.length > 0) {
        const { error: pe } = await supabase.from("contratado_periodos").insert(periodoRows);
        if (pe) throw pe;
      }
      return jsonResponse({ success: true, count: inserted?.length || 0, skipped });
    }

    // POST clear contratados (requires admin password)
    if ((req.method === "DELETE" || req.method === "POST") && action === "delete_all_contratados") {
      let cbody: { password?: string } = {};
      try { cbody = await req.json(); } catch { /* allow empty */ }
      const password = String(cbody.password || "");
      if (!password) throw new Error("Senha de administrador obrigatória.");
      let { data: adminRow } = await supabase
        .from("users").select("id, role, senha_hash").eq("id", user.sub).maybeSingle();
      if (!adminRow) {
        const { data: pa } = await supabase
          .from("professors").select("id, role, senha_hash").eq("id", user.sub).maybeSingle();
        adminRow = pa;
      }
      if (!adminRow || adminRow.role !== "admin" || !adminRow.senha_hash) {
        throw new Error("Administrador não encontrado.");
      }
      const { data: pwOk } = await supabase.rpc("verify_password", {
        plain_password: password, hashed_password: adminRow.senha_hash,
      });
      if (!pwOk) return new Response(JSON.stringify({ error: "Senha incorreta." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const { error } = await supabase.from("contratados").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // ============================================================


    // GET all professors (chunked, for export / bulk ops)
    if (req.method === "GET" && action === "professors_all") {
      const all: any[] = [];
      const chunk = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("professors")
          .select("id, matricula, nome, cpf, data_nascimento, vinculo_inicio, vinculo_fim, carga_horaria, total_cotas, cargo, status, role")
          .order("nome")
          .range(from, from + chunk - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < chunk) break;
        from += chunk;
      }
      return jsonResponse(all);
    }

    // GET contestacoes
    if (req.method === "GET" && action === "contestacoes") {
      const { data, error } = await supabase
        .from("contestacoes")
        .select("id, motivo, descricao, whatsapp, status, created_at, professor_id, protocolo, resposta, documento_path, documento_nome")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const profIds = [...new Set((data || []).map(c => c.professor_id))];
      const { data: profs } = await supabase
        .from("professors")
        .select("id, nome, matricula")
        .in("id", profIds);

      const profMap = new Map((profs || []).map(p => [p.id, p]));
      const enrichedBase = (data || []).map(c => ({
        ...c,
        professors: profMap.get(c.professor_id) || null,
      }));
      // Attach signed URLs for documento_path
      const enriched = [];
      for (const c of enrichedBase) {
        if (c.documento_path) {
          const { data: signed } = await supabase.storage
            .from("contestacao-documentos")
            .createSignedUrl(c.documento_path, 600);
          enriched.push({ ...c, documento_url: signed?.signedUrl || null });
        } else {
          enriched.push({ ...c, documento_url: null });
        }
      }
      return jsonResponse(enriched);
    }

    // GET settings
    if (req.method === "GET" && action === "settings") {
      const { data } = await supabase.from("system_settings").select("key, value");
      return jsonResponse(data);
    }

    // GET messages
    if (req.method === "GET" && action === "messages") {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse(data);
    }

    // GET professors_lookup (for "specific users" picker)
    if (req.method === "GET" && action === "professors_lookup") {
      const q = (url.searchParams.get("q") || "").trim();
      const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10) || 20);
      let query = supabase
        .from("professors")
        .select("id, nome, matricula, cargo, role")
        .order("nome")
        .limit(limit);
      if (q) {
        const digits = q.replace(/\D/g, "");
        const ors = [`nome.ilike.%${q}%`, `matricula.ilike.%${q}%`];
        if (digits) ors.push(`cpf.ilike.%${digits}%`);
        query = query.or(ors.join(","));
      }
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse(data || []);
    }

    // GET cargos_distinct
    if (req.method === "GET" && action === "cargos_distinct") {
      const set = new Set<string>();
      let from = 0;
      const chunk = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("professors")
          .select("cargo")
          .not("cargo", "is", null)
          .range(from, from + chunk - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          const c = (r as any).cargo;
          if (c && String(c).trim()) set.add(String(c).trim());
        }
        if (data.length < chunk) break;
        from += chunk;
      }
      return jsonResponse([...set].sort());
    }

    // GET professors_by_ids (resolve chips on edit)
    if (req.method === "GET" && action === "professors_by_ids") {
      const ids = (url.searchParams.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return jsonResponse([]);
      const { data, error } = await supabase
        .from("professors")
        .select("id, nome, matricula, cargo, role")
        .in("id", ids);
      if (error) throw error;
      return jsonResponse(data || []);
    }


    // POST professor (create)
    if (req.method === "POST" && action === "create_professor") {
      const body = await req.json();
      const senha = body.senha || body.cpf?.replace(/\D/g, "") || "";
      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });
      const payload = {
        nome: body.nome, cpf: body.cpf, matricula: body.matricula,
        senha_hash: hashData,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        carga_horaria: normCarga(body.carga_horaria),
        total_cotas: Number(body.total_cotas) || 0,
        cargo: body.cargo || null,
        role: body.role || "professor",
        status: (body.status || "ATIVO").toUpperCase(),
      };
      const { error } = await supabase.from("professors").insert(payload);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // PUT professor (update)
    if (req.method === "PUT" && action === "update_professor") {
      const body = await req.json();
      const update: Record<string, unknown> = {
        nome: body.nome, cpf: body.cpf, matricula: body.matricula,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        carga_horaria: normCarga(body.carga_horaria),
        total_cotas: Number(body.total_cotas) || 0,
        cargo: body.cargo || null,
        role: body.role || "professor",
        status: (body.status || "ATIVO").toUpperCase(),
      };
      if (body.senha && body.senha !== "***") {
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: body.senha });
        update.senha_hash = hashData;
      }
      const { error } = await supabase.from("professors").update(update).eq("id", body.id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // DELETE single professor
    if (req.method === "DELETE" && action === "delete_professor") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "ID obrigatório." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("contestacoes").delete().eq("professor_id", id);
      const { error } = await supabase.from("professors").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // DELETE all professors (Clear database) - requires admin password confirmation
    if ((req.method === "DELETE" || req.method === "POST") && action === "delete_all_professors") {
      let body: { password?: string } = {};
      try { body = await req.json(); } catch { /* allow empty */ }
      const password = String(body.password || "");
      if (!password) {
        return new Response(JSON.stringify({ error: "Senha de administrador obrigatória." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Busca o admin atual (na tabela users) e valida a senha
      let { data: adminRow } = await supabase
        .from("users")
        .select("id, role, senha_hash")
        .eq("id", user.sub)
        .maybeSingle();
      if (!adminRow) {
        const { data: profAdmin } = await supabase
          .from("professors")
          .select("id, role, senha_hash")
          .eq("id", user.sub)
          .maybeSingle();
        adminRow = profAdmin;
      }
      if (!adminRow || adminRow.role !== "admin" || !adminRow.senha_hash) {
        return new Response(JSON.stringify({ error: "Administrador não encontrado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: pwOk } = await supabase.rpc("verify_password", {
        plain_password: password,
        hashed_password: adminRow.senha_hash,
      });
      if (!pwOk) {
        return new Response(JSON.stringify({ error: "Senha incorreta." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // First delete all contestations as they depend on professors
      await supabase.from("contestacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Then delete all professors (preserve admin/juridico accounts)
      const { error } = await supabase
        .from("professors")
        .delete()
        .not("role", "in", "(admin,juridico)");
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // POST atualização de professores já existentes (via importação)
    if (req.method === "POST" && action === "update_professors_csv") {
      const body = await req.json();
      const rows = (body.rows || []) as Array<Record<string, string>>;
      const normalizeDateBR2 = (v: string | null | undefined): string | null => {
        if (!v) return null;
        const s = String(v).trim();
        if (!s) return null;
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
        const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
        if (br) return `${br[1]}/${br[2]}/${br[3]}`;
        const digits = s.replace(/\D/g, "");
        if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
        return s;
      };
      const isDash = (v: unknown) => /^[-–—]+$/.test(String(v ?? "").trim());
      let updated = 0;
      let notFound = 0;
      for (const raw0 of rows) {
        // campos preenchidos apenas com traços são tratados como vazios (não sobrescrevem)
        const r: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw0)) r[k] = isDash(v) ? "" : (v as string);
        const cpf = (r.cpf || "").replace(/\D/g, "");
        if (cpf.length !== 11) { notFound++; continue; }
        const mat = (r.matricula || "").toString().trim();
        const patch: Record<string, unknown> = {};

        const nome = String(r.nome || "").trim();
        if (nome) patch.nome = nome;
        const vi = normalizeDateBR2(r.vinculo_inicio);
        if (vi) patch.vinculo_inicio = vi;
        const vf = normalizeDateBR2(r.vinculo_fim);
        if (vf) patch.vinculo_fim = vf;
        const cargaVal = normCarga(r.carga_horaria);
        if (cargaVal) patch.carga_horaria = cargaVal;
        const cotas = String(r.total_cotas || "").replace(/\D/g, "");
        if (cotas) patch.total_cotas = Math.min(parseInt(cotas), 2147483647);
        const cargo = String(r.cargo || "").trim();
        if (cargo) patch.cargo = cargo;
        const status = String(r.status || "").trim();
        if (status) patch.status = status.toUpperCase();
        if (Object.keys(patch).length === 0) continue;
        patch.updated_at = new Date().toISOString();

        let query = supabase.from("professors").update(patch).eq("cpf", cpf);
        query = mat ? query.eq("matricula", mat) : query.is("matricula", null);
        const { data, error } = await query.select("id");
        if (error) throw error;
        if (!data || data.length === 0) notFound++;
        else updated += data.length;
      }
      return jsonResponse({ success: true, updated, not_found: notFound });
    }

    // POST CSV import

    if (req.method === "POST" && action === "import_csv") {
      const body = await req.json();
      const rows = body.rows as Array<Record<string, string>>;
      // Normaliza qualquer formato de data para DD/MM/AAAA
      const normalizeDateBR = (v: string | null | undefined): string | null => {
        if (!v) return null;
        const s = String(v).trim();
        if (!s) return null;
        // ISO YYYY-MM-DD
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
        // DD/MM/YYYY ou DD-MM-YYYY
        const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
        if (br) return `${br[1]}/${br[2]}/${br[3]}`;
        // DDMMYYYY
        const digits = s.replace(/\D/g, "");
        if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
        return s;
      };
      const toInsert: any[] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        const cpfDigits = (r.cpf || "").replace(/\D/g, "");
        if (!cpfDigits || cpfDigits.length !== 11) continue;
        const matKey = (r.matricula || "").toString().trim();
        const pairKey = `${cpfDigits}|${matKey}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const senha = (r.senha && String(r.senha).trim()) || cpfDigits;
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });
        // Parse carga_horaria: aceita "40H", "20h", "40", etc.
        const carga = normCarga(r.carga_horaria);
        toInsert.push({
          nome: String(r.nome || "").trim(),
          cpf: cpfDigits,
          matricula: matKey || null,
          senha_hash: hashData,
          vinculo_inicio: normalizeDateBR(r.vinculo_inicio),
          vinculo_fim: normalizeDateBR(r.vinculo_fim),
          carga_horaria: carga,
          total_cotas: parseInt(r.total_cotas) || 0,
          cargo: (r.cargo && String(r.cargo).trim()) || null,
          status: (r.status || "ATIVO").toString().toUpperCase(),
          role: "professor",
        });
      }
      // Filtra pares (cpf+matrícula) já existentes na base
      let skipped = rows.length - toInsert.length;
      if (toInsert.length > 0) {
        const cpfs = toInsert.map(p => p.cpf);
        const { data: existing } = await supabase.from("professors").select("cpf, matricula").in("cpf", cpfs);
        const existSet = new Set((existing || []).map((p: any) => `${p.cpf}|${(p.matricula || '').trim()}`));
        const filtered = toInsert.filter(p => !existSet.has(`${p.cpf}|${(p.matricula || '').trim()}`));
        skipped += toInsert.length - filtered.length;
        if (filtered.length > 0) {
          const { error } = await supabase.from("professors").insert(filtered);
          if (error) throw error;
        }
        return jsonResponse({ success: true, count: filtered.length, skipped });
      }
      return jsonResponse({ success: true, count: 0, skipped });
    }



// PUT settings
if (req.method === "PUT" && action === "save_settings") {
  const body = await req.json();
  const { key, value } = body;
  const { data: existing } = await supabase.from("system_settings").select("id").eq("key", key).maybeSingle();
  if (existing) {
    await supabase.from("system_settings").update({ value }).eq("id", existing.id);
  } else {
    await supabase.from("system_settings").insert({ key, value });
  }
  return jsonResponse({ success: true });
}

// Helpers for message targeting
function sanitizeTargets(body: any) {
  const target_type = ["all", "role", "users"].includes(body?.target_type) ? body.target_type : "all";
  const target_roles = Array.isArray(body?.target_roles) ? body.target_roles.map(String).filter(Boolean) : [];
  const target_cargos = Array.isArray(body?.target_cargos) ? body.target_cargos.map(String).filter(Boolean) : [];
  const target_user_ids = Array.isArray(body?.target_user_ids) ? body.target_user_ids.map(String).filter(Boolean) : [];
  return { target_type, target_roles, target_cargos, target_user_ids };
}

// POST message (create/send)
if (req.method === "POST" && action === "create_message") {
  const body = await req.json();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const scheduledAt = body.scheduled_at || null;
  const sent = scheduledAt ? false : true;
  const targets = sanitizeTargets(body);

  if (!title || !content) {
    return new Response(JSON.stringify({ error: "Título e conteúdo são obrigatórios." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insertError } = await supabase.from("messages").insert({
    title, content, created_by: null,
    scheduled_at: scheduledAt, sent,
    ...targets,
  });
  if (insertError) {
    return new Response(JSON.stringify({ error: `Erro ao salvar mensagem: ${insertError.message}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return jsonResponse({ success: true });
}

// PUT update message (only if not yet sent)
if (req.method === "PUT" && action === "update_message") {
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) throw new Error("ID obrigatório");
  const { data: existing } = await supabase.from("messages").select("id, sent").eq("id", id).maybeSingle();
  if (!existing) throw new Error("Mensagem não encontrada.");
  if (existing.sent) {
    return new Response(JSON.stringify({ error: "Mensagem já foi enviada e não pode ser editada. Use 'Duplicar' para criar uma nova." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) throw new Error("Título e conteúdo são obrigatórios.");
  const scheduledAt = body.scheduled_at || null;
  const sent = scheduledAt ? false : true;
  const targets = sanitizeTargets(body);
  const { error } = await supabase.from("messages").update({
    title, content, scheduled_at: scheduledAt, sent, ...targets,
  }).eq("id", id);
  if (error) throw error;
  return jsonResponse({ success: true });
}

// POST resend message — mark as sent now and reset reads
if (req.method === "POST" && action === "resend_message") {
  const id = url.searchParams.get("id");
  if (!id) throw new Error("ID obrigatório");
  await supabase.from("message_reads").delete().eq("message_id", id);
  const { error } = await supabase.from("messages").update({
    sent: true, scheduled_at: null, created_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
  return jsonResponse({ success: true });
}

// POST duplicate message — creates a draft (scheduled or unsent) copy
if (req.method === "POST" && action === "duplicate_message") {
  const id = url.searchParams.get("id");
  if (!id) throw new Error("ID obrigatório");
  const { data: src, error: e1 } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
  if (e1) throw e1;
  if (!src) throw new Error("Mensagem não encontrada.");
  const { data: inserted, error } = await supabase.from("messages").insert({
    title: `${src.title} (cópia)`,
    content: src.content,
    created_by: null,
    scheduled_at: null,
    sent: false,
    target_type: src.target_type || "all",
    target_roles: src.target_roles || [],
    target_cargos: src.target_cargos || [],
    target_user_ids: src.target_user_ids || [],
  }).select("id").single();
  if (error) throw error;
  return jsonResponse({ success: true, id: inserted.id });
}

// DELETE message
if (req.method === "DELETE" && action === "delete_message") {
  const id = url.searchParams.get("id");
  if (!id) throw new Error("ID obrigatório");
  await supabase.from("message_reads").delete().eq("message_id", id);
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
  return jsonResponse({ success: true });
}

// GET access reports
if (req.method === "GET" && action === "access_reports") {
  const statusFilter = url.searchParams.get("status");
  let q = supabase
    .from("access_reports")
    .select("id, nome_completo, cpf, tipo_vinculo, whatsapp, email, assunto, descricao, status, resposta_admin, protocolo, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  return jsonResponse(data);
}

// PUT update access report
if (req.method === "PUT" && action === "update_access_report") {
  const body = await req.json();
  const { id, status, resposta_admin } = body;
  if (!id || !status) throw new Error("ID e status obrigatórios");
  const allowed = ["Aberto", "Em análise", "Resolvido", "Descartado"];
  if (!allowed.includes(status)) throw new Error("Status inválido.");
  const update: Record<string, unknown> = { status };
  if (resposta_admin !== undefined) update.resposta_admin = resposta_admin;
  const { error } = await supabase.from("access_reports").update(update).eq("id", id);
  if (error) throw error;
  return jsonResponse({ success: true });
}

return new Response(JSON.stringify({ error: "Ação não encontrada." }), {
  status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

  } catch (e: any) {
  return new Response(JSON.stringify({ error: e.message || "Erro interno." }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
