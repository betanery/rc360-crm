import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "RC360 CRM <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "resend_not_configured" }, 500);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await db
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") return json({ error: "forbidden" }, 403);

  const payload = (await req.json().catch(() => null)) as {
    email?: string;
    confirmed?: boolean;
  } | null;
  if (!payload?.confirmed) return json({ error: "confirmation_required" }, 400);

  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: "Teste de integração RC360 CRM",
      text: "Teste de integração RC360 CRM com Resend. Se você recebeu esta mensagem, a conexão está funcionando.",
    }),
  });

  if (!sent.ok) {
    const detail = await sent.text().catch(() => "");
    return json({ error: "send_failed", status: sent.status, detail }, 502);
  }

  await db.from("activities").insert({
    organization_id: profile.organization_id,
    actor_id: userData.user.id,
    action: "Teste de integração e-mail (Resend) enviado",
    entity_type: "integration_test",
    details: { provider: "Resend", email },
  });

  return json({ ok: true, message: "E-mail de teste enviado pelo Resend." });
});
