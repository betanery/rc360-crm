import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { QualificationFieldKey } from "./QualificationField";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.includes("does not exist")) ||
    Boolean(error?.message?.includes("Could not find the table"))
  );
}

interface OptionRow {
  id: string;
  name: string;
}

export function QualificationOptionsManager({
  field,
  label,
}: {
  field: QualificationFieldKey;
  label: string;
}) {
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [newValue, setNewValue] = useState("");

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("contact_field_options")
      .select("id,name")
      .eq("field", field)
      .order("name", { ascending: true });
    if (error) {
      if (isMissingTable(error)) setAvailable(false);
      else toast.error(error.message);
      return;
    }
    setOptions((data ?? []) as OptionRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = newValue.trim();
    if (!name) return;
    const { error } = await supabase.from("contact_field_options").insert({ field, name });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Essa opção já existe." : error.message);
      return;
    }
    setNewValue("");
    void load();
  }

  async function removeOption(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("contact_field_options").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  if (!supabase) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {!available && (
        <p className="rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground">
          Recurso pendente: aplique a migration 008_contact_qualification_fields.sql.
        </p>
      )}
      {available && (
        <>
          <form onSubmit={addOption} className="flex gap-2">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Nova opção"
              className="h-8 text-xs"
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8"
              aria-label={`Adicionar em ${label}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <Badge key={option.id} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
                {option.name}
                <button
                  onClick={() => void removeOption(option.id)}
                  aria-label={`Remover ${option.name} de ${label}`}
                  className="ml-0.5 rounded-full hover:text-destructive"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            {!options.length && (
              <span className="text-xs text-muted-foreground">Nenhuma opção cadastrada.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
