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
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) return json({ error: "slug_required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: event, error } = await db
    .from("events")
    .select("name,headline,subtitle,brand_color,logo_url,active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!event || !event.active) return json({ error: "not_found" }, 404);

  return json({ ok: true, event });
});
