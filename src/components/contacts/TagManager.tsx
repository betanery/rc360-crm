import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fieldClass = "h-9 rounded-md border bg-background px-2 text-sm";
const NEW_OPTION = "__new_tag__";

export function TagManager({ contactId, tags }: { contactId: string; tags: string[] }) {
  const { addContactTag, removeContactTag } = useCRM();
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

  const available = allTags.filter((t) => !tags.includes(t));

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await addContactTag(contactId, trimmed);
      setNewTag("");
      setMode("select");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível adicionar a tag.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(name: string) {
    try {
      await removeContactTag(contactId, name);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível remover a tag.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tags.length ? (
          tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 px-3 py-1">
              {t}
              {supabase && (
                <button
                  onClick={() => void removeTag(t)}
                  aria-label={`Remover tag ${t}`}
                  className="ml-1 rounded-full hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">Sem tags</span>
        )}
      </div>
      {supabase &&
        (mode === "new" ? (
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTag(newTag)}
              autoFocus
            />
            <Button
              type="button"
              size="icon"
              disabled={saving || !newTag.trim()}
              onClick={() => void addTag(newTag)}
              aria-label="Salvar nova tag"
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
              else if (e.target.value) void addTag(e.target.value);
            }}
          >
            <option value="" disabled>
              Adicionar tag…
            </option>
            {available.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={NEW_OPTION}>+ Nova tag…</option>
          </select>
        ))}
    </div>
  );
}
