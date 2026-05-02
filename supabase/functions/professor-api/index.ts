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
  if (!user) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET my profile
    if (req.method === "GET" && action === "profile") {
      const { data, error } = await supabase
        .from("professors")
        .select("id, nome, cpf, matricula, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role")
        .eq("id", user.sub)
        .single();
      if (error) throw error;
      return jsonResponse(data);
    }

    // GET my contestacoes (with protocolo)
    if (req.method === "GET" && action === "contestacoes") {
      const { data, error } = await supabase
        .from("contestacoes")
        .select("id, motivo, descricao, whatsapp, status, created_at, protocolo, resposta")
        .eq("professor_id", user.sub)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return jsonResponse(data);
    }

    // POST contestacao
    if (req.method === "POST" && action === "create_contestacao") {
      const body = await req.json();
      const motivo = String(body.motivo || "").trim();
      const descricao = String(body.descricao || "").trim();
      const whatsapp = String(body.whatsapp || "").trim();

      if (!motivo || !descricao || !whatsapp) {
        return new Response(
          JSON.stringify({ error: "Motivo, descrição e WhatsApp são obrigatórios." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (descricao.length > 500 || motivo.length > 200 || whatsapp.length > 30) {
        return new Response(
          JSON.stringify({ error: "Campos excedem o limite de caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.from("contestacoes").insert({
        professor_id: user.sub,
        motivo, descricao, whatsapp,
      }).select("protocolo").single();
      if (error) throw error;
      return jsonResponse({ success: true, protocolo: data?.protocolo });
    }

    // POST change_password
    if (req.method === "POST" && action === "change_password") {
      const body = await req.json();
      const senhaAtual = String(body.senha_atual || "").trim();
      const senhaNova = String(body.senha_nova || "").trim();

      if (!senhaAtual || !senhaNova) {
        return new Response(
          JSON.stringify({ error: "Senha atual e nova senha são obrigatórias." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (senhaNova.length < 6) {
        return new Response(
          JSON.stringify({ error: "A nova senha deve ter pelo menos 6 caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user_id from professor
      const { data: prof } = await supabase
        .from("professors")
        .select("user_id")
        .eq("id", user.sub)
        .single();

      if (!prof?.user_id) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current hash from users table
      const { data: userData } = await supabase
        .from("users")
        .select("senha_hash")
        .eq("id", prof.user_id)
        .single();

      if (!userData?.senha_hash) {
        return new Response(
          JSON.stringify({ error: "Erro ao verificar senha atual." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify current password
      const { data: matchResult } = await supabase.rpc("verify_password", {
        plain_password: senhaAtual,
        hashed_password: userData.senha_hash,
      });

      if (!matchResult) {
        return new Response(
          JSON.stringify({ error: "Senha atual incorreta." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash new password and update
      const { data: hashData } = await supabase.rpc("hash_password", { plain_password: senhaNova });

      const { error: updateErr } = await supabase
        .from("users")
        .update({ senha_hash: hashData })
        .eq("id", prof.user_id);

      if (updateErr) throw updateErr;

      // Also update senha_hash in professors for backward compat
      await supabase
        .from("professors")
        .update({ senha_hash: hashData, senha: "***" })
        .eq("user_id", prof.user_id);

      return jsonResponse({ success: true });
    }

    // GET messages (broadcast + personal notifications for professor)
    if (req.method === "GET" && action === "messages") {
      // Broadcast messages (created_by is null or an admin)
      const { data: broadcastMsgs, error: bErr } = await supabase
        .from("messages")
        .select("id, title, content, created_at, created_by")
        .eq("sent", true)
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;

      // Filter: broadcast (created_by is null or not the current user) + personal (created_by = user.sub)
      const messages = (broadcastMsgs || []).filter(m =>
        !m.created_by || m.created_by === user.sub
      );

      // Get read status
      const messageIds = messages.map(m => m.id);
      const { data: reads } = messageIds.length > 0
        ? await supabase
            .from("message_reads")
            .select("message_id")
            .eq("professor_id", user.sub)
            .in("message_id", messageIds)
        : { data: [] };

      const readSet = new Set((reads || []).map(r => r.message_id));
      const enriched = messages.map(m => ({
        id: m.id,
        title: m.title,
        content: m.content,
        created_at: m.created_at,
        read: readSet.has(m.id),
      }));
      return jsonResponse(enriched);
    }

    // POST mark message as read
    if (req.method === "POST" && action === "mark_read") {
      const body = await req.json();
      const messageId = body.message_id;
      if (!messageId) throw new Error("message_id obrigatório");

      await supabase.from("message_reads").upsert({
        message_id: messageId,
        professor_id: user.sub,
      }, { onConflict: "message_id,professor_id" });
      return jsonResponse({ success: true });
    }

    // === JURIDICO ACTIONS ===

    // GET all contestacoes (for juridico role)
    if (req.method === "GET" && action === "juridico_contestacoes") {
      if (user.role !== "juridico") {
        return new Response(JSON.stringify({ error: "Acesso negado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("contestacoes")
        .select("id, motivo, descricao, whatsapp, status, created_at, professor_id, protocolo, resposta")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const profIds = [...new Set((data || []).map(c => c.professor_id))];
      const { data: profs } = await supabase
        .from("professors")
        .select("id, nome, matricula, cpf")
        .in("id", profIds);

      const profMap = new Map((profs || []).map(p => [p.id, p]));
      const enriched = (data || []).map(c => ({
        ...c,
        professor: profMap.get(c.professor_id) || null,
      }));
      return jsonResponse(enriched);
    }

    // PUT update contestacao status (for juridico)
    if (req.method === "PUT" && action === "update_contestacao") {
      if (user.role !== "juridico") {
        return new Response(JSON.stringify({ error: "Acesso negado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      const { id, status, resposta } = body;
      if (!id || !status) throw new Error("ID e status obrigatórios");
      
      // Get contestacao to find professor_id and protocolo
      const { data: contest, error: fetchErr } = await supabase
        .from("contestacoes")
        .select("professor_id, protocolo, status")
        .eq("id", id)
        .single();
      if (fetchErr || !contest) throw new Error("Contestação não encontrada.");

      const update: Record<string, unknown> = { status };
      if (resposta !== undefined) update.resposta = resposta;
      
      const { error } = await supabase.from("contestacoes").update(update).eq("id", id);
      if (error) throw error;

      // Auto-send notification message to the professor
      if (contest.status !== status) {
        const statusLabel: Record<string, string> = {
          'Pendente': 'Pendente',
          'Deferido': 'DEFERIDA ✅',
          'Indeferido': 'INDEFERIDA ❌',
          'Aberta': 'Aberta',
        };
        const msgTitle = `Contestação ${contest.protocolo || ''} — ${statusLabel[status] || status}`;
        const msgContent = `Sua contestação (${contest.protocolo || 'sem protocolo'}) teve o status atualizado para: ${status}.${resposta ? '\n\nParecer: ' + resposta : ''}`;

        // Insert as a personal message (created_by = professor so only they see it via their messages query)
        await supabase.from("messages").insert({
          title: msgTitle,
          content: msgContent,
          sent: true,
          created_by: contest.professor_id,
        });
      }

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
