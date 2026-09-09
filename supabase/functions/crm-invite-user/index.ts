import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    full_name?: string;
  } | null;

  const email = String(payload?.email || "")
    .trim()
    .toLowerCase();
  const fullName = String(payload?.full_name || "").trim();
  if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });

  if (error) {
    const status = error.message.toLowerCase().includes("already") ? 409 : 500;
    return json({ error: error.message }, status);
  }

  await db.from("activities").insert({
    organization_id: profile.organization_id,
    actor_id: userData.user.id,
    action: "Convite de usuário enviado",
    entity_type: "user_invite",
    details: { email },
  });

  return json({ ok: true, user_id: data.user?.id, email });
});
