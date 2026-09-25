import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fieldClass = "h-9 rounded-md border bg-background px-2 text-sm";
const NEW_OPTION = "__new_objection__";

export function ObjectionManager({
  opportunityId,
  objections,
}: {
  opportunityId: string;
  objections: string[];
}) {
  const { addOpportunityObjection, removeOpportunityObjection } = useCRM();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("tags")
      .select("name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setAllTags(data.map((t) => t.name as string));
      });
  }, []);

  const available = allTags.filter((t) => !objections.includes(t));

  async function addObjection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await addOpportunityObjection(opportunityId, trimmed);
      setNewTag("");
      setMode("select");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível adicionar a objeção.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeObjection(name: string) {
    try {
      await removeOpportunityObjection(opportunityId, name);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível remover a objeção.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {objections.length ? (
          objections.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 px-3 py-1">
              {t}
              {supabase && (
                <button
                  onClick={() => void removeObjection(t)}
                  aria-label={`Remover objeção ${t}`}
                  className="ml-1 rounded-full hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">Nenhuma objeção registrada</span>
        )}
      </div>
      {supabase &&
        (mode === "new" ? (
          <div className="flex gap-2">
            <Input
              placeholder="Nome da objeção"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addObjection(newTag)}
              autoFocus
            />
            <Button
              type="button"
              size="icon"
              disabled={saving || !newTag.trim()}
              onClick={() => void addObjection(newTag)}
              aria-label="Salvar nova objeção"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setMode("select");
                setNewTag("");
              }}
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <select
            className={fieldClass}
            value=""
            disabled={saving}
            onChange={(e) => {
              if (e.target.value === NEW_OPTION) setMode("new");
              else if (e.target.value) void addObjection(e.target.value);
            }}
          >
            <option value="" disabled>
              Adicionar objeção…
            </option>
            {available.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={NEW_OPTION}>+ Nova objeção…</option>
          </select>
        ))}
    </div>
  );
}
