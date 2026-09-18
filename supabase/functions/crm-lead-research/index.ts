import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRAVE_API_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Source {
  title: string;
  url: string;
  snippet: string;
}

async function braveSearch(query: string): Promise<Source[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Brave search falhou: ${res.status}`);
  const data = await res.json();
  const results = (data?.web?.results ?? []) as Array<{
    title?: string;
    url?: string;
    description?: string;
  }>;
  return results.slice(0, 5).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: (r.description ?? "").replace(/<\/?[^>]+>/g, ""),
  }));
}

async function summarizeWithOpenAI(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request falhou: ${res.status}`);
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Resposta vazia do modelo de IA");
  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!BRAVE_API_KEY) return json({ error: "BRAVE_SEARCH_API_KEY não configurada" }, 500);
  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: profile } = await db
    .from("profiles")
    .select("organization_id")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.organization_id) return json({ error: "profile_not_found" }, 403);

  const body = (await req.json().catch(() => null)) as { contactId?: string } | null;
  const contactId = body?.contactId;
  if (!contactId) return json({ error: "contactId_required" }, 400);

  const { data: contact, error: contactError } = await db
    .from("contacts")
    .select(
      "id,name,company,product,source,campaign,notes,market_time,team_size,main_pain,instagram,tiktok",
    )
    .eq("id", contactId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (contactError) return json({ error: contactError.message }, 500);
  if (!contact) return json({ error: "contato_nao_encontrado" }, 404);

  const nameCompany = [contact.name, contact.company].filter(Boolean).join(" ");
  const queries = [
    nameCompany,
    contact.instagram
      ? `site:instagram.com ${String(contact.instagram).replace(/^@/, "")}`
      : `${contact.name} instagram`,
    contact.tiktok
      ? `site:tiktok.com/@${String(contact.tiktok).replace(/^@/, "")}`
      : `${contact.name} tiktok`,
  ].filter(Boolean);

  let sources: Source[] = [];
  try {
    const results = await Promise.all(queries.map((q) => braveSearch(q)));
    const seen = new Set<string>();
    sources = results.flat().filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Falha ao buscar na internet" },
      502,
    );
  }

  const contextLines = [
    `Nome: ${contact.name}`,
    contact.company && `Empresa: ${contact.company}`,
    contact.product && `Produto de interesse: ${contact.product}`,
    contact.source && `Origem do lead: ${contact.source}`,
    contact.campaign && `Campanha: ${contact.campaign}`,
    contact.main_pain && `Maior dor relatada: ${contact.main_pain}`,
    contact.market_time && `Tempo de mercado: ${contact.market_time}`,
    contact.team_size && `Tamanho da equipe: ${contact.team_size}`,
    contact.notes && `Observações internas: ${contact.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sourcesText = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`).join("\n\n")
    : "Nenhum resultado relevante encontrado nas buscas.";

  const prompt = `Você é uma assistente de vendas B2B ajudando uma consultora de negócios a se preparar para abordar um lead.

Dados já cadastrados no CRM sobre o lead:
${contextLines}

Resultados de busca pública sobre esse lead (nome, empresa, redes sociais):
${sourcesText}

Escreva, em português, um resumo curto (até 200 palavras) focado em prospecção e qualificação: quem parece ser essa pessoa/empresa, sinais de que ela se encaixa no produto (dor, momento, porte, autoridade para decidir), e 2 a 3 pontos de abordagem sugeridos para a conversa. Se as buscas não trouxerem nada relevante, diga isso claramente em vez de inventar informação.`;

  let summary: string;
  try {
    summary = await summarizeWithOpenAI(prompt);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao gerar o resumo" }, 502);
  }

  const { data: saved, error: saveError } = await db
    .from("lead_ai_research")
    .insert({
      organization_id: profile.organization_id,
      contact_id: contactId,
      summary,
      sources,
      model: OPENAI_MODEL,
      created_by: userData.user.id,
    })
    .select("id,summary,sources,created_at")
    .single();
  if (saveError) return json({ error: saveError.message }, 500);

  return json({ ok: true, research: saved });
});
