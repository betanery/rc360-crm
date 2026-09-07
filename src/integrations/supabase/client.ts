import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * RC360 CRM — Cliente Supabase (scaffold placeholder).
 *
 * Este cliente usa variáveis de ambiente do Vite. Como nenhum backend
 * real está habilitado nesta etapa, valores vazios ou placeholder
 * são aceitos sem quebrar a aplicação; chamadas ainda não serão feitas.
 */

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] ?? "";
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? "";

const isPlaceholder =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes("SEU-PROJETO") ||
  supabaseAnonKey.includes("SUA_CHAVE");

if (isPlaceholder && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    "[RC360 CRM] Supabase não configurado. O cliente está em modo placeholder.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseClient = typeof supabase;
