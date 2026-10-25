import { supabase } from "./supabase";

// Registra uma linha na linha do tempo do contato. Nunca derruba a ação
// principal: se falhar (rede, permissão), só segue.
export async function logActivity(entry: {
  contactId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("activities").insert({
      contact_id: entry.contactId,
      actor_id: data.user?.id ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {},
    });
  } catch {
    // histórico é complementar
  }
}
