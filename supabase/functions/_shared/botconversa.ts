const BOT_BASE = "https://backend.botconversa.com.br/api/v1/webhook";

/**
 * Garante que o telefone existe como "subscriber" na BotConversa, criando
 * se necessário, e devolve o subscriber_id — pré-requisito pra
 * enviar qualquer mensagem de WhatsApp por lá. Quem entra no CRM sem
 * nunca ter mandado mensagem pro número (ex: formulário público, lead de
 * webhook, importação CSV) não existe como subscriber ainda.
 */
export async function findOrCreateBotConversaSubscriber(
  phone: string,
  name: string,
): Promise<number> {
  const apiKey = Deno.env.get("BOTCONVERSA_API_KEY");
  if (!apiKey) throw new Error("BOTCONVERSA_API_KEY not configured");

  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;

  const lookup = await fetch(`${BOT_BASE}/subscriber/get_by_phone/${normalized}/`, {
    headers: { "API-KEY": apiKey },
  });
  if (lookup.ok) {
    const subscriber = await lookup.json();
    if (subscriber?.id) return subscriber.id;
  } else if (lookup.status !== 404) {
    throw new Error(`BotConversa lookup failed: ${lookup.status}`);
  }

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const create = await fetch(`${BOT_BASE}/subscriber/`, {
    method: "POST",
    headers: { "API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: normalized,
      first_name: firstName || name,
      last_name: rest.join(" "),
      has_opt_in_whatsapp: true,
    }),
  });
  if (!create.ok) {
    const body = await create.json().catch(() => null);
    throw new Error(
      `BotConversa create subscriber failed: ${create.status} ${body?.error_message ?? ""}`.trim(),
    );
  }

  const retry = await fetch(`${BOT_BASE}/subscriber/get_by_phone/${normalized}/`, {
    headers: { "API-KEY": apiKey },
  });
  if (!retry.ok) throw new Error(`BotConversa lookup after create failed: ${retry.status}`);
  const created = await retry.json();
  if (!created?.id) throw new Error("BotConversa subscriber not found after create");
  return created.id;
}
