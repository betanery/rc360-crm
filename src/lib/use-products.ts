import { useEffect, useState } from "react";
import { products as staticProducts } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";

// Produtos ativos e os preços cadastrados (migration 019). Sem a coluna de
// preço, volta só aos nomes.
export function useActiveProducts() {
  const [names, setNames] = useState<string[]>(staticProducts);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void (async () => {
      let { data, error } = await client
        .from("products")
        .select("name,price")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) {
        const fallback = await client
          .from("products")
          .select("name")
          .eq("active", true)
          .order("name", { ascending: true });
        data = fallback.data as typeof data;
        error = fallback.error;
      }
      if (error || !data?.length) return;
      setNames(data.map((p) => p.name));
      const found: Record<string, number> = {};
      for (const row of data as { name: string; price?: number | null }[]) {
        if (row.price !== null && row.price !== undefined) found[row.name] = Number(row.price);
      }
      setPrices(found);
    })();
  }, []);

  return { names, prices };
}
