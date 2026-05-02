import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function verifyToken(authHeader: string | null): Promise<{ sub: string; role: string; uid?: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 0) return null;

  try {
    const payloadStr = atob(token.slice(0, dotIdx));
    const sigHex = token.slice(dotIdx + 1);
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
    return { sub: payload.sub, role: payload.role, uid: payload.uid };
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
        .select("id, matricula, nome, cpf, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, user_id")
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
    // Now handles users table: finds or creates user by CPF, then inserts professor
    if (req.method === "POST" && action === "create_professor") {
      const body = await req.json();
      const cpf = String(body.cpf || "").replace(/\D/g, "");
      const role = body.role || "professor";

      if (!cpf || !body.nome || !body.matricula) {
        throw new Error("Nome, CPF e Matrícula são obrigatórios.");
      }

      // Determine password: for professors use data_nascimento, for admin/juridico use explicit senha
      const senha = body.senha || body.data_nascimento?.replace(/\D/g, "") || "";
      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });

      // Find or create user by CPF
      let userId: string;
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("cpf", cpf)
        .maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const userInsert: Record<string, unknown> = {
          cpf,
          senha_hash: hashData,
          role,
          status: "Ativo",
        };
        // Admin/juridico get email field
        if ((role === "admin" || role === "juridico") && body.email) {
          userInsert.email = body.email;
        }
        const { data: newUser, error: userErr } = await supabase
          .from("users")
          .insert(userInsert)
          .select("id")
          .single();
        if (userErr || !newUser) throw new Error("Erro ao criar usuário: " + (userErr?.message || ""));
        userId = newUser.id;
      }

      // Insert professor record
      const payload = {
        user_id: userId,
        nome: body.nome,
        cpf,
        matricula: body.matricula,
        senha: "***",
        senha_hash: hashData,
        data_nascimento: body.data_nascimento || null,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        total_cotas: Number(body.total_cotas) || 0,
        status: body.status || "Pendente",
        role,
      };
      const { error } = await supabase.from("professors").insert(payload);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // PUT professor (update)
    if (req.method === "PUT" && action === "update_professor") {
      const body = await req.json();
      const update: Record<string, unknown> = {
        nome: body.nome,
        cpf: body.cpf,
        matricula: body.matricula,
        data_nascimento: body.data_nascimento || null,
        vinculo_inicio: body.vinculo_inicio || null,
        vinculo_fim: body.vinculo_fim || null,
        total_cotas: Number(body.total_cotas) || 0,
        status: body.status || "Pendente",
        role: body.role || "professor",
      };
      if (body.senha && body.senha !== "***") {
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: body.senha });
        update.senha_hash = hashData;
        update.senha = "***";

        // Also update users table password
        const { data: prof } = await supabase
          .from("professors")
          .select("user_id")
          .eq("id", body.id)
          .single();
        if (prof?.user_id) {
          await supabase.from("users").update({ senha_hash: hashData }).eq("id", prof.user_id);
        }
      }

      // Update email on users table if provided (admin/juridico)
      if (body.email && body.id) {
        const { data: prof } = await supabase
          .from("professors")
          .select("user_id")
          .eq("id", body.id)
          .single();
        if (prof?.user_id) {
          await supabase.from("users").update({ email: body.email }).eq("id", prof.user_id);
        }
      }

      const { error } = await supabase.from("professors").update(update).eq("id", body.id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // DELETE professor
    if (req.method === "DELETE" && action === "delete_professor") {
      const id = url.searchParams.get("id");
      if (!id) throw new Error("ID obrigatório");

      // Check if user has other professors linked before deleting user record
      const { data: prof } = await supabase.from("professors").select("user_id").eq("id", id).single();
      
      const { error } = await supabase.from("professors").delete().eq("id", id);
      if (error) throw error;

      // If no other professors share this user, delete the user too
      if (prof?.user_id) {
        const { count } = await supabase
          .from("professors")
          .select("*", { count: "exact", head: true })
          .eq("user_id", prof.user_id);
        if ((count || 0) === 0) {
          await supabase.from("users").delete().eq("id", prof.user_id);
        }
      }

      return jsonResponse({ success: true });
    }

    // POST CSV import
    if (req.method === "POST" && action === "import_csv") {
      const body = await req.json();
      const rows = body.rows as Array<Record<string, string>>;
      const toInsert = [];

      for (const r of rows) {
        const cpf = (r.cpf || "").replace(/\D/g, "");
        const senha = r.data_nascimento?.replace(/\D/g, "") || r.senha || "";
        const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senha });

        // Find or create user
        let userId: string;
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("cpf", cpf)
          .maybeSingle();

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const { data: newUser, error: userErr } = await supabase
            .from("users")
            .insert({ cpf, senha_hash: hashData, role: "professor", status: "Ativo" })
            .select("id")
            .single();
          if (userErr || !newUser) continue;
          userId = newUser.id;
        }

        toInsert.push({
          user_id: userId,
          nome: r.nome || "",
          cpf,
          matricula: r.matricula || "",
          senha: "***",
          senha_hash: hashData,
          data_nascimento: r.data_nascimento || null,
          vinculo_inicio: r.vinculo_inicio || null,
          vinculo_fim: r.vinculo_fim || null,
          total_cotas: parseInt(r.total_cotas) || 0,
          status: r.status || "Pendente",
          role: "professor",
        });
      }
      const { error } = await supabase.from("professors").insert(toInsert);
      if (error) throw error;
      return jsonResponse({ success: true, count: toInsert.length });
    }

    // POST change_password
    if (req.method === "POST" && action === "change_password") {
      const body = await req.json();
      const senhaAtual = String(body.senha_atual || "").trim();
      const senhaNova = String(body.senha_nova || "").trim();

      if (!senhaAtual || !senhaNova) {
        return new Response(JSON.stringify({ error: "Senha atual e nova senha são obrigatórias." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (senhaNova.length < 6) {
        return new Response(JSON.stringify({ error: "A nova senha deve ter pelo menos 6 caracteres." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Verify current password
      const { data: userData } = await supabase
        .from("users")
        .select("senha_hash")
        .eq("id", user.sub)
        .single();

      if (!userData) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: isValid } = await supabase.rpc("verify_password", {
        plain_password: senhaAtual,
        hashed_password: userData.senha_hash
      });

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Senha atual incorreta." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senhaNova });

      const { error: updateErr } = await supabase
        .from("users")
        .update({ senha_hash: hashData })
        .eq("id", user.sub);

      if (updateErr) throw updateErr;

      return jsonResponse({ success: true });
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

      const { error } = await supabase.from("messages").insert({
        title, content, created_by: user.sub,
        scheduled_at: scheduledAt, sent,
      });
      if (error) throw error;
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
