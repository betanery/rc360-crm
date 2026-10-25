import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Confere a assinatura Svix que a Resend usa nos webhooks:
// HMAC-SHA256 de "{id}.{timestamp}.{corpo}" com a parte base64 do segredo.
async function verifySvix(req: Request, rawBody: string) {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!WEBHOOK_SECRET || !id || !timestamp || !signatures) return false;

  // Recusa mensagens muito antigas (proteção contra reenvio).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60) return false;

  const secretBytes = Uint8Array.from(atob(WEBHOOK_SECRET.replace(/^whsec_/, "")), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signatures
    .split(" ")
    .some((entry) => entry.split(",")[1] === expected);
}

// Webhook da Resend: e-mail que voltou (bounce permanente) ou foi marcado
// como spam (complaint) sai da lista de envio, para não prejudicar a
// reputação do domínio.
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  if (!(await verifySvix(req, rawBody))) return json({ error: "unauthorized" }, 401);

  const event = JSON.parse(rawBody) as {
    type?: string;
    data?: { to?: string[]; bounce?: { type?: string } };
  };
  const type = event.type ?? "";
  const isComplaint = type === "email.complained";
  const isBounce =
    type === "email.bounced" && (event.data?.bounce?.type ?? "Permanent") !== "Transient";
  if (!isComplaint && !isBounce) return json({ ok: true, ignored: type });

  const reason = isComplaint ? "email_complaint" : "email_bounce";
  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let affected = 0;

  for (const address of event.data?.to ?? []) {
    const email = address.trim().toLowerCase();
    if (!email) continue;
    const { data: contacts } = await db
      .from("contacts")
      .select("id,organization_id")
      .ilike("email", email);
    for (const contact of contacts ?? []) {
      await db
        .from("contacts")
        .update({ email_opt_in: false, opt_out_at: new Date().toISOString(), opt_out_reason: reason })
        .eq("id", contact.id);
      await db
        .from("automation_queue")
        .update({ status: "blocked", last_error: "E-mail inválido ou marcado como spam" })
        .eq("contact_id", contact.id)
        .eq("channel", "email")
        .in("status", ["pending", "processing"]);
      await db.from("activities").insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        action: isComplaint ? "E-mail marcado como spam" : "E-mail devolvido (inválido)",
        entity_type: "contact",
        entity_id: contact.id,
        details: { via: "resend_webhook", type },
      });
      affected++;
    }
  }
  return json({ ok: true, affected });
});
