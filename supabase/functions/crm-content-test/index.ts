import { createClient } from "npm:@supabase/supabase-js@2";
import { renderEmailHtml, renderEmailText } from "../_shared/email-template.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") || "RC360 CRM <onboarding@resend.dev>";
const RESEND_REPLY_TO = Deno.env.get("RESEND_REPLY_TO");
const APP_URL = (
  Deno.env.get("PUBLIC_APP_URL") || "https://id-preview--86abcb3f-7542-4bce-a76f-5577aa852675.lovable.app"
).replace(/\/$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Envia o e-mail de conteúdo SÓ para quem está logado (o endereço vem do
// login, nunca do corpo da requisição), para ver como chega na caixa de
// entrada antes de mandar para o público.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

  const authorization = req.headers.get("authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ error: "unauthorized" }, 401);

  const payload = (await req.json().catch(() => null)) as {
    subject?: string;
    preheader?: string;
    body?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  } | null;
  const subject = String(payload?.subject ?? "").trim();
  const body = String(payload?.body ?? "").trim();
  if (!subject || !body) return json({ error: "Preencha o assunto e o texto." }, 400);

  const sample = "Maria";
  const content = {
    heading: subject.replaceAll("{{nome}}", sample),
    bodyText: body.replaceAll("{{nome}}", sample),
    ...(payload?.preheader ? { preheader: payload.preheader } : {}),
    ...(payload?.ctaLabel ? { ctaLabel: payload.ctaLabel } : {}),
    ...(payload?.ctaUrl ? { ctaUrl: payload.ctaUrl } : {}),
    unsubscribeUrl: `${APP_URL}/unsubscribe`,
  };

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [userData.user.email],
      subject: `[TESTE] ${content.heading}`,
      html: renderEmailHtml(content),
      text: renderEmailText(content),
      ...(RESEND_REPLY_TO ? { reply_to: RESEND_REPLY_TO } : {}),
    }),
  });
  if (!sent.ok) {
    const err = await sent.json().catch(() => null);
    const detail = err?.message || err?.error?.message;
    return json({ error: detail ? `Resend: ${detail}` : `Resend falhou: ${sent.status}` }, 502);
  }
  return json({ ok: true, to: userData.user.email });
});
