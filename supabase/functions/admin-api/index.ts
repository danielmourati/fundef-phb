import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    // GET professors
    if (req.method === "GET" && action === "professors") {
      const { data, error } = await supabase
        .from("professors")
        .select("id, matricula, nome, cpf, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, role")
        .order("nome");
      if (error) throw error;
      return jsonResponse(data);
    }

    // GET contestacoes
    if (req.method === "GET" && action === "contestacoes") {
      const { data, error } = await supabase
        .from("contestacoes")
        .select("id, motivo, descricao, whatsapp, status, created_at, professor_id, protocolo, resposta")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const profIds = [...new Set((data || []).map(c => c.professor_id))];
      const { data: profs } = await supabase
        .from("professors")
        .select("id, nome, matricula")
        .in("id", profIds);
      
      const profMap = new Map((profs || []).map(p => [p.id, p]));
      const enriched = (data || []).map(c => ({
        ...c,
        professors: profMap.get(c.professor_id) || null,
      }));
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

    // POST professor (create)
    if (req.method === "POST" && action === "create_professor") {
      const body = await req.json();
      const senha = body.senha || body.data_nascimento?.replace(/\D/g, "") || "";
      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });
      const payload = {
        nome: body.nome, cpf: body.cpf, matricula: body.matricula,
        senha: "***", senha_hash: hashData,
        data_nascimento: body.data_nascimento || null,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        total_cotas: Number(body.total_cotas) || 0,
        role: body.role || "professor",
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
        data_nascimento: body.data_nascimento || null,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        total_cotas: Number(body.total_cotas) || 0,
        role: body.role || "professor",
      };
      if (body.senha && body.senha !== "***") {
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: body.senha });
        update.senha_hash = hashData;
        update.senha = "***";
      }
      const { error } = await supabase.from("professors").update(update).eq("id", body.id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // DELETE professor
    if (req.method === "DELETE" && action === "delete_professor") {
      const id = url.searchParams.get("id");
      if (!id) throw new Error("ID obrigatório");
      const { error } = await supabase.from("professors").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // DELETE all professors (Clear database) - Allowing POST for compatibility
    if ((req.method === "DELETE" || req.method === "POST") && action === "delete_all_professors") {
      // First delete all contestations as they depend on professors
      await supabase.from("contestacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Then delete all professors
      const { error } = await supabase.from("professors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // POST CSV import
    if (req.method === "POST" && action === "import_csv") {
      const body = await req.json();
      const rows = body.rows as Array<Record<string, string>>;
      const toInsert = [];
      for (const r of rows) {
        const senha = r.data_nascimento?.replace(/\D/g, "") || r.senha || "";
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });
        toInsert.push({
          nome: r.nome || "", cpf: r.cpf || "", matricula: r.matricula || "",
          senha: "***", senha_hash: hashData,
          data_nascimento: r.data_nascimento || null,
          vinculo_inicio: r.vinculo_inicio || null,
          vinculo_fim: r.vinculo_fim || null,
          total_cotas: parseInt(r.total_cotas) || 0,
          role: "professor",
        });
      }
      const { error } = await supabase
        .from("professors")
        .upsert(toInsert, { onConflict: "matricula" });
      if (error) throw error;
      return jsonResponse({ success: true, count: toInsert.length });
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

    // POST message (create/send)
    if (req.method === "POST" && action === "create_message") {
      const body = await req.json();
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      const scheduledAt = body.scheduled_at || null;
      const sent = scheduledAt ? false : true;

      if (!title || !content) {
        return new Response(JSON.stringify({ error: "Título e conteúdo são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await supabase.from("messages").insert({
        title, content, created_by: null, // Broadcast message
        scheduled_at: scheduledAt, sent,
      });
      if (insertError) {
        return new Response(JSON.stringify({ error: `Erro ao salvar mensagem: ${insertError.message}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return jsonResponse({ success: true });
    }

    // DELETE message
    if (req.method === "DELETE" && action === "delete_message") {
      const id = url.searchParams.get("id");
      if (!id) throw new Error("ID obrigatório");
      const { error } = await supabase.from("messages").delete().eq("id", id);
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
