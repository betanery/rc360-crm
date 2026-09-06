import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const allowedProducts = ["Rotas do Lucro", "Fastrack", "Consultoria 4X"];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const normalizePhone = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: profile } = await db.from("profiles")
    .select("organization_id,role")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.organization_id) return json({ error: "profile_not_found" }, 403);

  const body = await req.json().catch(() => null) as { rows?: Record<string, unknown>[] } | null;
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "rows_required" }, 400);
  if (rows.length > 1000) return json({ error: "max_1000_rows" }, 400);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = String(row.name || row.nome || "").trim();
      const phone = normalizePhone(row.phone || row.telefone || row.whatsapp);
      const email = String(row.email || "").trim().toLowerCase() || null;
      const product = String(row.product || row.produto || "").trim();
      if (!name || !phone || !allowedProducts.includes(product)) {
        skipped++;
        errors.push({ row: i + 1, error: "nome, telefone e produto válido são obrigatórios" });
        continue;
      }

      let contact = null;
      if (email) {
        const result = await db.from("contacts").select("*")
          .eq("organization_id", profile.organization_id).ilike("email", email).maybeSingle();
        contact = result.data;
      }
      if (!contact) {
        const result = await db.from("contacts").select("*")
          .eq("organization_id", profile.organization_id).eq("phone", phone).maybeSingle();
        contact = result.data;
      }

      const data = {
        organization_id: profile.organization_id,
        name,
        company: String(row.company || row.empresa || "").trim() || null,
        phone,
        email,
        product,
        source: String(row.source || row.origem || "Importação").trim(),
        campaign: String(row.campaign || row.campanha || row.event || row.evento || "").trim() || null,
        owner_name: String(row.owner_name || row.responsavel || "").trim() || null,
        notes: String(row.notes || row.observacoes || "").trim() || null,
        whatsapp_opt_in: Boolean(row.whatsapp_opt_in ?? false),
        email_opt_in: Boolean(row.email_opt_in ?? false),
        opt_in_at: (row.whatsapp_opt_in || row.email_opt_in) ? new Date().toISOString() : null,
        opt_in_source: String(row.opt_in_source || "importação").trim(),
      };

      if (contact) {
        const { error } = await db.from("contacts").update(data).eq("id", contact.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await db.from("contacts").insert({ ...data, created_by: userData.user.id });
        if (error) throw error;
        created++;
      }
    } catch (error) {
      skipped++;
      errors.push({ row: i + 1, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return json({ ok: true, total: rows.length, created, updated, skipped, errors: errors.slice(0, 50) });
});
