import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function OwnerField({ defaultValue = "" }: { defaultValue?: string }) {
  const [owners, setOwners] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("profiles")
      .select("full_name")
      .order("full_name", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        setOwners(
          data.map((p) => (p.full_name as string).trim()).filter((name) => name.length > 0),
        );
      });
  }, []);

  if (!supabase || !owners.length) {
    return <Input name="owner" placeholder="Responsável" defaultValue={defaultValue} />;
  }

  const options =
    defaultValue && !owners.includes(defaultValue) ? [...owners, defaultValue] : owners;

  return (
    <select name="owner" className={fieldClass} defaultValue={defaultValue}>
      <option value="">Sem responsável</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
