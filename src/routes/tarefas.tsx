import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortDate, useCRM } from "@/lib/crm-data";

export const Route = createFileRoute("/tarefas")({ component: TarefasPage });
function TarefasPage() {
  const { tasks, contacts, toggleTask } = useCRM();
  const ordered = [...tasks].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Execução comercial</p>
        <h2 className="text-3xl font-semibold">Tarefas</h2>
        <p className="mt-1 text-muted-foreground">Calls, follow-ups e próximos passos com data.</p>
      </div>
      <div className="grid gap-3">
        {ordered.map((task) => {
          const overdue = task.status === "Pendente" && new Date(task.dueAt) < new Date();
          return (
            <div
              key={task.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
            >
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleTask(task.id)}
                aria-label="Alterar status"
              >
                {task.status === "Concluída" ? (
                  <CheckCircle2 className="text-emerald-600" />
                ) : (
                  <Circle />
                )}
              </Button>
              <div className="min-w-52 flex-1">
                <p
                  className={
                    task.status === "Concluída"
                      ? "font-medium line-through text-muted-foreground"
                      : "font-medium"
                  }
                >
                  {task.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {contacts.find((c) => c.id === task.contactId)?.name}
                </p>
              </div>
              <Badge variant="outline">{task.type}</Badge>
              <p
                className={`flex items-center gap-1 text-sm ${overdue ? "font-semibold text-warning" : "text-muted-foreground"}`}
              >
                <Clock className="h-4 w-4" />
                {shortDate(task.dueAt)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
