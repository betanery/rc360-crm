import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stages as staticStages } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  AudienceFilterPicker,
  audienceFiltersFromJson,
  audienceFiltersToJson,
  emptyAudienceFilters,
  type AudienceFilters,
} from "./AudienceFilterPicker";
import { StartCadenceDialog } from "./StartCadenceDialog";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

type TriggerType = "manual" | "contact_created" | "tag_added" | "stage_changed" | "inactivity_days";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: "Manual (eu escolho quando começar)",
  contact_created: "Novo contato criado",
  tag_added: "Tag adicionada a um contato",
  stage_changed: "Oportunidade entra num estágio",
  inactivity_days: "Contato ficou X dias sem atividade",
};

interface StepDraft {
  id?: string;
  dayOffset: number;
  timeOfDay: string;
  channel: "whatsapp" | "email";
  subject: string;
  message: string;
}

const emptyStep = (dayOffset: number): StepDraft => ({
  dayOffset,
  timeOfDay: "",
  channel: "whatsapp",
  subject: "",
  message: "",
});

function isMissingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    Boolean(error?.message?.includes("does not exist")) ||
    Boolean(error?.message?.includes("Could not find the table"))
  );
}

export function CadenceBuilder({ cadenceId }: { cadenceId?: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(Boolean(cadenceId));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [triggerTag, setTriggerTag] = useState("");
  const [triggerStage, setTriggerStage] = useState("");
  const [triggerDays, setTriggerDays] = useState(7);
  const [audience, setAudience] = useState<AudienceFilters>(emptyAudienceFilters);
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(0)]);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>(staticStages);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("tags")
      .select("name")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setAvailableTags(data.map((t) => t.name as string));
      });
    supabase
      .from("funnel_stages")
      .select("name")
      .order("position", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data?.length) setStageOptions(data.map((s) => s.name as string));
        else if (isMissingTable(error)) setStageOptions(staticStages);
      });
  }, []);

  useEffect(() => {
    if (!cadenceId || !supabase) return;
    setLoading(true);
    void (async () => {
      const { data: cadence, error: cadenceError } = await supabase
        .from("cadences")
        .select("name,description,trigger_type,trigger_config,audience_filters,active")
        .eq("id", cadenceId)
        .single();
      if (cadenceError || !cadence) {
        toast.error("Cadência não encontrada.");
        setLoading(false);
        return;
      }
      setName(cadence.name);
      setDescription(cadence.description ?? "");
      setTriggerType(cadence.trigger_type as TriggerType);
      const config = (cadence.trigger_config ?? {}) as Record<string, unknown>;
      setTriggerTag((config["tag"] as string) ?? "");
      setTriggerStage((config["stage"] as string) ?? "");
      setTriggerDays(typeof config["days"] === "number" ? (config["days"] as number) : 7);
      setAudience(audienceFiltersFromJson(cadence.audience_filters as Record<string, unknown>));
      setActive(cadence.active);

      const { data: stepRows } = await supabase
        .from("cadence_steps")
        .select("id,day_offset,time_of_day,channel,subject,message")
        .eq("cadence_id", cadenceId)
        .order("step_order", { ascending: true });
      if (stepRows?.length) {
        setSteps(
          stepRows.map((s) => ({
            id: s.id,
            dayOffset: s.day_offset,
            timeOfDay: s.time_of_day ? String(s.time_of_day).slice(0, 5) : "",
            channel: s.channel as "whatsapp" | "email",
            subject: s.subject ?? "",
            message: s.message ?? "",
          })),
        );
      }
      setLoading(false);
    })();
  }, [cadenceId]);

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addStep() {
    const lastDay = steps.at(-1)?.dayOffset ?? 0;
    setSteps((items) => [...items, emptyStep(lastDay + 1)]);
  }

  function removeStep(index: number) {
    setSteps((items) => items.filter((_, i) => i !== index));
  }

  function triggerConfig(): Record<string, unknown> {
    if (triggerType === "tag_added") return { tag: triggerTag };
    if (triggerType === "stage_changed") return { stage: triggerStage };
    if (triggerType === "inactivity_days") return { days: triggerDays };
    return {};
  }

  async function save() {
    if (!supabase) return;
    if (!name.trim()) {
      toast.error("Dê um nome para a cadência.");
      return;
    }
    if (!steps.length || steps.some((s) => !s.message.trim())) {
      toast.error("Cada etapa precisa de uma mensagem.");
      return;
    }
    if (triggerType === "tag_added" && !triggerTag) {
      toast.error("Escolha a tag que dispara a cadência.");
      return;
    }
    if (triggerType === "stage_changed" && !triggerStage) {
      toast.error("Escolha o estágio que dispara a cadência.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig(),
        audience_filters: audienceFiltersToJson(audience),
        active,
      };
      let id = cadenceId;
      if (id) {
        const { error } = await supabase.from("cadences").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("cadence_steps").delete().eq("cadence_id", id);
      } else {
        const { data, error } = await supabase
          .from("cadences")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      const { error: stepsError } = await supabase.from("cadence_steps").insert(
        steps.map((s, index) => ({
          cadence_id: id,
          step_order: index + 1,
          day_offset: s.dayOffset,
          time_of_day: s.timeOfDay || null,
          channel: s.channel,
          subject: s.subject.trim() || null,
          message: s.message,
        })),
      );
      if (stepsError) throw stepsError;
      toast.success("Cadência salva.");
      void navigate({ to: "/automations" });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível salvar a cadência.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando cadência…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nome da cadência *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativa
        </label>
        <Input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:col-span-2"
        />
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Gatilho</p>
        <select
          className={fieldClass}
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as TriggerType)}
        >
          {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {triggerType === "tag_added" && (
          <select
            className={fieldClass}
            value={triggerTag}
            onChange={(e) => setTriggerTag(e.target.value)}
          >
            <option value="" disabled>
              Selecione a tag…
            </option>
            {availableTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {triggerType === "stage_changed" && (
          <select
            className={fieldClass}
            value={triggerStage}
            onChange={(e) => setTriggerStage(e.target.value)}
          >
            <option value="" disabled>
              Selecione o estágio…
            </option>
            {stageOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {triggerType === "inactivity_days" && (
          <Input
            type="number"
            min={1}
            value={triggerDays}
            onChange={(e) => setTriggerDays(Number(e.target.value) || 1)}
            placeholder="Dias sem atividade"
          />
        )}
        {(triggerType === "contact_created" ||
          triggerType === "tag_added" ||
          triggerType === "stage_changed" ||
          triggerType === "inactivity_days") && (
          <>
            <p className="pt-2 text-sm font-medium">Filtro adicional de público (opcional)</p>
            <AudienceFilterPicker value={audience} onChange={setAudience} />
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Etapas</p>
          <Button type="button" size="sm" variant="outline" onClick={addStep}>
            <Plus className="h-3.5 w-3.5" /> Adicionar etapa
          </Button>
        </div>
        {steps.map((step, index) => (
          <div key={index} className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Etapa {index + 1} · dia</span>
              <Input
                type="number"
                min={0}
                className="w-20"
                value={step.dayOffset}
                onChange={(e) => updateStep(index, { dayOffset: Number(e.target.value) || 0 })}
              />
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> horário
              </span>
              <Input
                type="time"
                className="w-28"
                value={step.timeOfDay}
                onChange={(e) => updateStep(index, { timeOfDay: e.target.value })}
              />
              <select
                className={`${fieldClass} w-auto`}
                value={step.channel}
                onChange={(e) =>
                  updateStep(index, { channel: e.target.value as "whatsapp" | "email" })
                }
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
              {steps.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeStep(index)}
                  aria-label="Remover etapa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {step.channel === "email" && (
              <Input
                placeholder="Assunto do e-mail"
                value={step.subject}
                onChange={(e) => updateStep(index, { subject: e.target.value })}
              />
            )}
            <textarea
              placeholder="Mensagem (use {{nome}} para o primeiro nome do contato)"
              className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
              value={step.message}
              onChange={(e) => updateStep(index, { message: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => void save()}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar cadência"}
        </Button>
        {cadenceId && (
          <StartCadenceDialog cadenceId={cadenceId} cadenceName={name} defaultFilters={audience} />
        )}
      </div>
    </div>
  );
}
