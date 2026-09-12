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

export function SegmentField({ defaultValue = "" }: { defaultValue?: string }) {
  const [segments, setSegments] = useState<string[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("company_segments")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (!isMissingTable(error)) console.error(error);
          setSegments([]);
          return;
        }
        setSegments((data ?? []).map((s) => s.name as string));
      });
  }, []);

  if (!supabase || segments === null || !segments.length) {
    return <Input name="segment" placeholder="Segmento" defaultValue={defaultValue} />;
  }

  const options =
    defaultValue && !segments.includes(defaultValue) ? [...segments, defaultValue] : segments;

  return (
    <select name="segment" className={fieldClass} defaultValue={defaultValue}>
      <option value="">Sem segmento</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
