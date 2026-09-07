/**
 * RC360 CRM — Tipos placeholder do Supabase.
 *
 * Este arquivo é um scaffold inicial. Quando o backend for habilitado,
 * substitua por tipos gerados a partir do schema real do banco de dados.
 */

export interface Database {
  public: {
    Tables: {
      // TODO: adicionar tabelas reais quando o backend for conectado
      [_table: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: {
      [_view: string]: {
        Row: Record<string, unknown>;
      };
    };
    Functions: {
      [_function: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
  };
}
