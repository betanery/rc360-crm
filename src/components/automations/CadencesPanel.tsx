import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pause, Play, Plus, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { audienceFiltersFromJson } from "@/components/automations/AudienceFilterPicker";
import { StartCadenceDialog } from "@/components/automations/StartCadenceDialog";

interface CadenceRow {
  id: string;
  name: string;
  trigger_type: string;
  active: boolean;
  audience_filters: Record<string, unknown>;
  step_count: number;
}

const triggerLabel: Record<string, string> = {
  manual: "Manual",
  contact_created: "Novo contato",
  tag_added: "Tag adicionada",
  stage_changed: "Mudança de estágio",
  inactivity_days: "Inatividade",
};

// Lista de cadências (sequências de mensagens) com iniciar, ativar e editar.
// Usada em Automações e em Conteúdos.
export function CadencesPanel() {
  const [cadences, setCadences] = useState<CadenceRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data: cadenceRows, error } = await supabase
      .from("cadences")
      .select("id,name,trigger_type,active,audience_filters")
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    const { data: stepRows } = await supabase.from("cadence_steps").select("cadence_id");
    const counts = new Map<string, number>();
    for (const s of stepRows ?? []) {
      counts.set(s.cadence_id, (counts.get(s.cadence_id) ?? 0) + 1);
    }
    setCadences(
      (cadenceRows ?? []).map((c) => ({
        ...c,
        step_count: counts.get(c.id) ?? 0,
      })) as CadenceRow[],
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(cadence: CadenceRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from("cadences")
      .update({ active: !cadence.active })
      .eq("id", cadence.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild disabled={!supabase}>
          <Link to="/automations/cadences/new">
            <Plus /> Nova cadência
          </Link>
        </Button>
      </div>

      {!supabase && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Modo demonstração: conecte o Supabase para criar e gerenciar cadências.
        </p>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando cadências…</p>
        ) : cadences.length ? (
          cadences.map((cadence) => (
            <div
              key={cadence.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{cadence.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {triggerLabel[cadence.trigger_type] ?? cadence.trigger_type} ·{" "}
                    {cadence.step_count} etapa(s)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={cadence.active ? "default" : "outline"}>
                  {cadence.active ? "Ativa" : "Inativa"}
                </Badge>
                <StartCadenceDialog
                  cadenceId={cadence.id}
                  cadenceName={cadence.name}
                  defaultFilters={audienceFiltersFromJson(cadence.audience_filters)}
                />
                <Button size="sm" variant="outline" onClick={() => void toggleActive(cadence)}>
                  {cadence.active ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Desativar
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Ativar
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/automations/cadences/$cadenceId" params={{ cadenceId: cadence.id }}>
                    Editar
                  </Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma cadência criada ainda.</p>
        )}
      </div>
    </div>
  );
}
