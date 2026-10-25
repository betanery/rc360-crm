// Link de descadastro de e-mail assinado (HMAC) com a chave de serviço do
// servidor, que nunca sai das funções — por isso não precisa de segredo novo.
// O link só vale para o contato para o qual foi gerado.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Página pública do app que mostra o botão "Deixar de receber".
const APP_URL = (
  Deno.env.get("PUBLIC_APP_URL") || "https://id-preview--86abcb3f-7542-4bce-a76f-5577aa852675.lovable.app"
).replace(/\/$/, "");

async function hmacHex(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`unsubscribe:${SERVICE_ROLE}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signContact(contactId: string) {
  return (await hmacHex(contactId)).slice(0, 32);
}

export async function verifyContact(contactId: string, token: string) {
  if (!contactId || !token) return false;
  const expected = await signContact(contactId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

// Link para o corpo do e-mail (página do app, com botão de confirmação).
export async function unsubscribePageUrl(contactId: string) {
  const token = await signContact(contactId);
  return `${APP_URL}/unsubscribe?c=${contactId}&t=${token}`;
}

// Endereço da função, usado no cabeçalho de "um clique" (o provedor de
// e-mail faz um POST direto, sem abrir página).
export async function unsubscribeOneClickUrl(contactId: string) {
  const token = await signContact(contactId);
  return `${SUPABASE_URL}/functions/v1/crm-unsubscribe?c=${contactId}&t=${token}`;
}
