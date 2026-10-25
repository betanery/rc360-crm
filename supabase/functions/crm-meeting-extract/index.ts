import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const MAX_TRANSCRIPT_CHARS = 100_000;
const QUALIFICATION_FIELDS = [
  "market_time",
  "team_size",
  "referred_by",
  "main_pain",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mesma lógica de retry/erros da pesquisa de leads, só que pedindo JSON.
async function askOpenAI(system: string, user: string): Promise<Record<string, unknown>> {
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 2500,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.ok) break;
    if (res.status !== 429 && res.status < 500) break;
    if (attempt === 2) break;
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * 2 ** attempt + Math.random() * 300;
    await sleep(Math.min(waitMs, 8000));
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    const bodyText = res ? await res.text().catch(() => "") : "";
    let detail = "";
    try {
      detail = JSON.parse(bodyText)?.error?.message ?? "";
    } catch {
      // corpo não era JSON
    }
    if (status === 429) {
      throw new Error(
        bodyText.includes("insufficient_quota") || bodyText.includes("billing")
          ? "A conta de IA está sem créditos disponíveis. Verifique o saldo/plano da chave OpenAI e tente novamente."
          : "O serviço de IA atingiu o limite de requisições. Aguarde alguns instantes e tente novamente.",
      );
    }
    throw new Error(detail ? `OpenAI: ${detail}` : `OpenAI request falhou: ${status}`);
  }

  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Resposta vazia do modelo de IA");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("A IA devolveu uma resposta fora do formato esperado. Tente novamente.");
  }
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const titled = (value: unknown) =>
  list(value)
    .map((item) => ({
      title: str((item as Record<string, unknown>)?.title),
      text: str((item as Record<string, unknown>)?.text),
    }))
    .filter((item) => item.title);

const TASK_TYPES = ["Call", "Ligação", "WhatsApp", "E-mail", "Follow-up"];
const isoDate = (value: unknown) => {
  const text = str(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
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
  const orgId = profile.organization_id as string;

  const body = (await req.json().catch(() => null)) as {
    contactId?: string;
    transcript?: string;
  } | null;
  const contactId = body?.contactId;
  const transcript = String(body?.transcript ?? "").trim();
  if (!contactId) return json({ error: "contactId_required" }, 400);
  if (transcript.length < 80) {
    return json({ error: "A transcrição está curta demais para ser analisada." }, 400);
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return json(
      {
        error: `A transcrição tem ${transcript.length.toLocaleString("pt-BR")} caracteres; o limite é ${MAX_TRANSCRIPT_CHARS.toLocaleString("pt-BR")}. Envie apenas a parte principal da reunião.`,
      },
      400,
    );
  }

  const { data: contact } = await db
    .from("contacts")
    .select("id,name,company,product")
    .eq("id", contactId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!contact) return json({ error: "contact_not_found" }, 404);

  // Valores já cadastrados: o modelo reutiliza quando couber.
  const [{ data: optionRows }, { data: objectionRows }] = await Promise.all([
    db
      .from("contact_field_options")
      .select("field,name")
      .eq("organization_id", orgId)
      .eq("active", true)
      .in("field", [...QUALIFICATION_FIELDS]),
    db.from("tags").select("name").eq("organization_id", orgId).eq("kind", "objection"),
  ]);
  const options: Record<string, string[]> = {};
  for (const row of optionRows ?? []) {
    (options[row.field as string] ??= []).push(row.name as string);
  }
  const objections = (objectionRows ?? []).map((row) => row.name as string);

  const today = new Date().toISOString().slice(0, 10);
  const system = `Você é assistente comercial da RC360 (desenvolvimento empresarial). Recebe a transcrição de uma reunião com um cliente ou prospect e devolve, em JSON, sugestões para preencher o CRM.

Regras:
- Use SOMENTE o que foi dito na transcrição. Se algo não foi mencionado, devolva string vazia ou lista vazia. Nunca invente nomes, valores, datas ou fatos.
- Separe fatos relatados de hipóteses; quando algo for inferência, escreva "(hipótese)" no texto.
- Escreva em português do Brasil, de forma objetiva.
- Datas no formato AAAA-MM-DD. Hoje é ${today}. Só devolva data se a pessoa combinou um prazo.
- Para os campos de qualificação do contato, se houver opções cadastradas, escolha exatamente uma delas (copie o texto); se nenhuma servir, devolva vazio.
- Para objeções, reutilize um nome da lista cadastrada quando representar a mesma ideia; senão, crie um nome curto (1 a 3 palavras).
- Tipos de tarefa permitidos: ${TASK_TYPES.join(", ")}.

Formato de saída (JSON):
{
  "summary": "resumo da reunião em 4 a 8 linhas",
  "contact": { "company": "", "mainPain": "", "marketTime": "", "teamSize": "", "referredBy": "" },
  "opportunity": { "objections": [], "decisionMap": "quem decide, quem influencia e como a decisão é tomada", "nextAction": "", "nextActionDate": "" },
  "tasks": [ { "title": "", "type": "", "dueDate": "" } ],
  "proposalDraft": {
    "challenges": [ { "title": "", "text": "" } ],
    "objectives": [ { "title": "", "text": "" } ],
    "stakes": "o que está em jogo para o cliente, conforme relatado",
    "priority": "objetivo prioritário acordado"
  }
}`;

  const optionLines = Object.entries(options)
    .map(([field, values]) => `- ${field}: ${values.join(" | ")}`)
    .join("\n");
  const user = `Contato: ${contact.name}${contact.company ? ` (${contact.company})` : ""}
Produto de interesse: ${contact.product ?? "não informado"}

Opções cadastradas para os campos do contato:
${optionLines || "(nenhuma — use texto livre curto)"}

Objeções já cadastradas: ${objections.length ? objections.join(", ") : "(nenhuma)"}

TRANSCRIÇÃO:
"""
${transcript}
"""`;

  try {
    const raw = await askOpenAI(system, user);
    const rawContact = (raw.contact ?? {}) as Record<string, unknown>;
    const rawOpp = (raw.opportunity ?? {}) as Record<string, unknown>;
    const rawDraft = (raw.proposalDraft ?? {}) as Record<string, unknown>;

    const pick = (field: string, value: unknown) => {
      const text = str(value);
      const allowed = options[field];
      if (!text || !allowed?.length) return text;
      return allowed.find((option) => option.toLowerCase() === text.toLowerCase()) ?? "";
    };

    const suggestions = {
      summary: str(raw.summary),
      contact: {
        company: str(rawContact.company),
        mainPain: pick("main_pain", rawContact.mainPain),
        marketTime: pick("market_time", rawContact.marketTime),
        teamSize: pick("team_size", rawContact.teamSize),
        referredBy: pick("referred_by", rawContact.referredBy),
      },
      opportunity: {
        objections: list(rawOpp.objections).map(str).filter(Boolean).slice(0, 8),
        decisionMap: str(rawOpp.decisionMap),
        nextAction: str(rawOpp.nextAction),
        nextActionDate: isoDate(rawOpp.nextActionDate),
      },
      tasks: list(raw.tasks)
        .map((task) => {
          const item = task as Record<string, unknown>;
          const type = str(item.type);
          return {
            title: str(item.title),
            type: TASK_TYPES.includes(type) ? type : "Follow-up",
            dueDate: isoDate(item.dueDate),
          };
        })
        .filter((task) => task.title)
        .slice(0, 8),
      proposalDraft: {
        challenges: titled(rawDraft.challenges).slice(0, 6),
        objectives: titled(rawDraft.objectives).slice(0, 6),
        stakes: str(rawDraft.stakes),
        priority: str(rawDraft.priority),
      },
    };

    return json({ ok: true, suggestions, model: OPENAI_MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar a reunião.";
    console.error("crm-meeting-extract:", message);
    return json({ error: message }, 502);
  }
});
