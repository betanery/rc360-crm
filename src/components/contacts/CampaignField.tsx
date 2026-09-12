import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const NEW_OPTION = "__new_campaign__";

export function CampaignField({ defaultValue = "" }: { defaultValue?: string }) {
  const [campaigns, setCampaigns] = useState<string[]>(defaultValue ? [defaultValue] : []);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("campaigns")
      .select("name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) return;
        const names = data.map((c) => c.name as string);
        setCampaigns(
          defaultValue && !names.includes(defaultValue) ? [...names, defaultValue].sort() : names,
        );
      });
  }, [defaultValue]);

  if (!supabase) {
    return <Input name="campaign" placeholder="Campanha ou evento" defaultValue={defaultValue} />;
  }

  if (mode === "new") {
    return (
      <div className="flex gap-2">
        <Input
          name="campaign"
          placeholder="Nome da nova campanha"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setMode("select");
            setNewName("");
          }}
          aria-label="Cancelar nova campanha"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <select
      name="campaign"
      className={fieldClass}
      defaultValue={defaultValue}
      onChange={(e) => {
        if (e.target.value === NEW_OPTION) setMode("new");
      }}
    >
      <option value="">Sem campanha</option>
      {campaigns.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={NEW_OPTION}>+ Nova campanha…</option>
    </select>
  );
}
