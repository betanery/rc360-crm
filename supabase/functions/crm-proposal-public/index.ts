import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Página pública da proposta. O token do link é o único acesso: não há login.
// GET mostra a proposta (e registra a primeira visualização); POST registra
// o aceite com o nome de quem aceitou.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return json({ error: "Link inválido." }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: proposal } = await db
    .from("proposals")
    .select(
      "id,organization_id,contact_id,opportunity_id,content,total,valid_until,pdf_path,viewed_at,accepted_at,accepted_name,contacts(name)",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (!proposal || !proposal.pdf_path) return json({ error: "Proposta não encontrada." }, 404);

  const contact = proposal.contacts as { name?: string } | { name?: string }[] | null;
  const contactName = (Array.isArray(contact) ? contact[0]?.name : contact?.name) ?? "";
  const content = (proposal.content ?? {}) as { program?: string };
  const validUntil = (proposal.valid_until as string | null) ?? null;
  const expired = Boolean(validUntil) && !proposal.accepted_at && validUntil! < new Date().toISOString().slice(0, 10);

  if (req.method === "GET") {
    if (!proposal.viewed_at) {
      await db
        .from("proposals")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", proposal.id);
      await db.from("activities").insert({
        organization_id: proposal.organization_id,
        contact_id: proposal.contact_id,
        action: "Abriu a proposta",
        entity_type: "proposal",
        entity_id: proposal.id,
        details: { program: content.program ?? "" },
      });
    }
    const { data: signed } = await db.storage
      .from("proposals")
      .createSignedUrl(proposal.pdf_path as string, 60 * 60);
    return json({
      ok: true,
      clientName: contactName,
      program: content.program ?? "",
      total: proposal.total,
      validUntil,
      expired,
      acceptedAt: proposal.accepted_at,
      acceptedName: proposal.accepted_name,
      pdfUrl: signed?.signedUrl ?? null,
    });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (proposal.accepted_at) {
    return json({ ok: true, acceptedAt: proposal.accepted_at, acceptedName: proposal.accepted_name });
  }
  if (expired) return json({ error: "Esta proposta expirou. Peça uma nova à RC360." }, 410);

  const payload = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = String(payload?.name ?? "").trim().slice(0, 120);
  if (name.length < 3) return json({ error: "Informe seu nome completo para aceitar." }, 400);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const acceptedAt = new Date().toISOString();
  await db
    .from("proposals")
    .update({ accepted_at: acceptedAt, accepted_name: name, accepted_ip: ip })
    .eq("id", proposal.id);
  await db.from("activities").insert({
    organization_id: proposal.organization_id,
    contact_id: proposal.contact_id,
    action: "Aceitou a proposta",
    entity_type: "proposal",
    entity_id: proposal.id,
    details: { name, program: content.program ?? "" },
  });
  // Avisa a equipe pelo próprio painel de tarefas (aparece no sino se atrasar).
  await db.from("tasks").insert({
    organization_id: proposal.organization_id,
    contact_id: proposal.contact_id,
    title: `Cliente aceitou a proposta${content.program ? ` (${content.program})` : ""} — formalizar`,
    type: "Follow-up",
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return json({ ok: true, acceptedAt, acceptedName: name });
});
