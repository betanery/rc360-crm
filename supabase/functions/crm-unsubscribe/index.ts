import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyContact } from "../_shared/unsubscribe.ts";

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

const maskEmail = (email: string) => {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

// Descadastro de e-mail. GET só confere o link (não altera nada, porque
// leitores de e-mail abrem links sozinhos); POST descadastra — é o POST que
// o Gmail/Outlook fazem no "cancelar inscrição" de um clique.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const contactId = url.searchParams.get("c") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!(await verifyContact(contactId, token))) {
    return json({ error: "Link inválido ou expirado." }, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: contact } = await db
    .from("contacts")
    .select("id,organization_id,name,email,email_opt_in")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return json({ error: "Contato não encontrado." }, 404);

  if (req.method === "GET") {
    return json({
      ok: true,
      email: contact.email ? maskEmail(contact.email as string) : "",
      alreadyOptedOut: !contact.email_opt_in,
    });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  await db
    .from("contacts")
    .update({
      email_opt_in: false,
      opt_out_at: new Date().toISOString(),
      opt_out_reason: "email_unsubscribe",
    })
    .eq("id", contactId);

  // Pendentes de e-mail deste contato não saem mais.
  await db
    .from("automation_queue")
    .update({ status: "blocked", last_error: "Contato cancelou a inscrição de e-mail" })
    .eq("contact_id", contactId)
    .eq("channel", "email")
    .in("status", ["pending", "processing"]);

  await db.from("activities").insert({
    organization_id: contact.organization_id,
    contact_id: contactId,
    action: "Cancelou a inscrição de e-mail",
    entity_type: "contact",
    entity_id: contactId,
    details: { via: "unsubscribe_link" },
  });

  return json({ ok: true });
});
