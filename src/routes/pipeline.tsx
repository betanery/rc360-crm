import { createFileRoute } from "@tanstack/react-router";
import { Calendar, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money, shortDate, stages, useCRM, type Stage } from "@/lib/crm-data";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

function PipelinePage() {
  const { contacts, opportunities, moveOpportunity } = useCRM();
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
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Venda consultiva</p>
        <h2 className="text-3xl font-semibold">Pipeline</h2>
        <p className="mt-1 text-muted-foreground">
          Arraste os cartões ou use as setas para avançar.
        </p>
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
                      className="cursor-grab rounded-lg border bg-card p-4 shadow-sm active:cursor-grabbing"
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
                          onClick={() => move(item.id, stageIndex, -1)}
                          aria-label="Voltar etapa"
                        >
                          <ChevronLeft />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={stageIndex === stages.length - 1}
                          onClick={() => move(item.id, stageIndex, 1)}
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
