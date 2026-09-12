import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.includes("does not exist")) ||
    Boolean(error?.message?.includes("Could not find the table"))
  );
}

export function SourceField({ defaultValue = "" }: { defaultValue?: string }) {
  const [sources, setSources] = useState<string[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("lead_sources")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (!isMissingTable(error)) console.error(error);
          setSources([]);
          return;
        }
        setSources((data ?? []).map((s) => s.name as string));
      });
  }, []);

  if (!supabase || sources === null || !sources.length) {
    return <Input name="source" placeholder="Origem" defaultValue={defaultValue} />;
  }

  const options =
    defaultValue && !sources.includes(defaultValue) ? [...sources, defaultValue] : sources;

  return (
    <select name="source" className={fieldClass} defaultValue={defaultValue}>
      <option value="">Sem origem</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
