import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export type QualificationFieldKey =
  "market_time" | "team_size" | "referred_by" | "main_pain" | "wants_feedback";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.includes("does not exist")) ||
    Boolean(error?.message?.includes("Could not find the table"))
  );
}

export function QualificationField({
  field,
  name,
  placeholder,
  defaultValue = "",
}: {
  field: QualificationFieldKey;
  name: string;
  placeholder: string;
  defaultValue?: string;
}) {
  const [options, setOptions] = useState<string[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("contact_field_options")
      .select("name")
      .eq("field", field)
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (!isMissingTable(error)) console.error(error);
          setOptions([]);
          return;
        }
        setOptions((data ?? []).map((o) => o.name as string));
      });
  }, [field]);

  if (!supabase || options === null || !options.length) {
    return <Input name={name} placeholder={placeholder} defaultValue={defaultValue} />;
  }

  const values =
    defaultValue && !options.includes(defaultValue) ? [...options, defaultValue] : options;

  return (
    <select name={name} className={fieldClass} defaultValue={defaultValue}>
      <option value="">{placeholder}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
