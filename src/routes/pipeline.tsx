import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { money, shortDate, stages as defaultStages, useCRM, type Stage } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

interface FunnelStageRow {
  id: string;
  name: string;
  position: number;
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

function PipelinePage() {
  const navigate = useNavigate();
  const { contacts, opportunities, moveOpportunity } = useCRM();
  const [customStages, setCustomStages] = useState<FunnelStageRow[] | null>(null);
  const [stagesAvailable, setStagesAvailable] = useState(true);
  const [open, setOpen] = useState(false);

  async function loadStages() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("funnel_stages")
      .select("id,name,position")
      .order("position", { ascending: true });
    if (error) {
      if (isMissingTable(error)) setStagesAvailable(false);
      return;
    }
    setCustomStages((data ?? []) as FunnelStageRow[]);
  }

  useEffect(() => {
    void loadStages();
  }, []);

  const stages: Stage[] = customStages?.length ? customStages.map((s) => s.name) : defaultStages;

  const moveTo = async (id: string, next: Stage) => {
    const reason = next === "Perdido" ? window.prompt("Informe o motivo da perda:") : undefined;
    if (next === "Perdido" && !reason?.trim()) return;
    try {
      await moveOpportunity(id, next, reason?.trim());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível mover a oportunidade.",
      );
    }
  };
  const move = (id: string, index: number, delta: number) => {
    const next = stages[index + delta];
    if (next) void moveTo(id, next);
  };

  async function addStage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (!stagesAvailable) {
      toast.error(
        "Recurso pendente: aplique a migration 003_dynamic_stages.sql no Supabase para adicionar etapas.",
      );
      return;
    }
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) return;
    const wonIndex = stages.indexOf("Ganho");
    const insertPosition = wonIndex >= 0 ? wonIndex : stages.length;
    const { error } = await supabase
      .from("funnel_stages")
      .insert({ name, position: insertPosition - 0.5 });
    if (error) {
      toast.error(
        error.message.includes("duplicate") ? "Já existe uma etapa com esse nome." : error.message,
      );
      return;
    }
    setOpen(false);
    toast.success("Etapa adicionada.");
    void loadStages();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Venda consultiva</p>
          <h2 className="text-3xl font-semibold">Pipeline</h2>
          <p className="mt-1 text-muted-foreground">
            Arraste os cartões ou use as setas para avançar.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus /> Adicionar etapa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova etapa do funil</DialogTitle>
              <DialogDescription>
                {!supabase
                  ? "Modo demonstração: conecte o Supabase para adicionar etapas."
                  : stagesAvailable
                    ? 'A etapa é adicionada antes de "Ganho".'
                    : "Recurso pendente: aplique a migration 003_dynamic_stages.sql no Supabase."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addStage} className="grid gap-3">
              <Input
                name="name"
                placeholder="Nome da etapa *"
                required
                disabled={!supabase || !stagesAvailable}
              />
              <Button disabled={!supabase || !stagesAvailable}>Salvar etapa</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, stageIndex) => {
          const items = opportunities.filter((o) => o.stage === stage);
          return (
            <section
              key={stage}
              className="min-w-[286px] flex-1 rounded-xl bg-muted/55 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void moveTo(e.dataTransfer.getData("text/plain"), stage)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold">{stage}</h3>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const contact = contacts.find((c) => c.id === item.contactId);
                  return (
                    <article
                      key={item.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                      onClick={() =>
                        contact &&
                        navigate({ to: "/contacts/$contactId", params: { contactId: contact.id } })
                      }
                      className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm hover:border-primary/40 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{contact?.name}</p>
                          <p className="text-xs text-muted-foreground">{contact?.company}</p>
                        </div>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Badge className="mt-3" variant="secondary">
                        {contact?.product}
                      </Badge>
                      <p className="mt-3 text-lg font-semibold text-primary">
                        {money.format(item.value)}
                      </p>
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-medium">{item.nextAction}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {shortDate(item.nextActionAt)}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={!stageIndex}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(item.id, stageIndex, -1);
                          }}
                          aria-label="Voltar etapa"
                        >
                          <ChevronLeft />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={stageIndex === stages.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            move(item.id, stageIndex, 1);
                          }}
                          aria-label="Avançar etapa"
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {!items.length && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    Solte uma oportunidade aqui
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
