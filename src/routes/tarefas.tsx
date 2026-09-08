import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
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
import { shortDate, useCRM, type Task } from "@/lib/crm-data";
import { toast } from "sonner";

export const Route = createFileRoute("/tarefas")({ component: TarefasPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const ALL = "__all__";
const TASK_TYPES: Task["type"][] = ["Call", "Ligação", "WhatsApp", "E-mail", "Follow-up"];

function TarefasPage() {
  const { tasks, contacts, toggleTask, addTask } = useCRM();
  const [status, setStatus] = useState<typeof ALL | Task["status"]>(ALL);
  const [open, setOpen] = useState(false);

  const ordered = useMemo(
    () =>
      [...tasks]
        .filter((t) => status === ALL || t.status === status)
        .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
    [tasks, status],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const dueDate = String(d.get("dueDate"));
    const dueTime = String(d.get("dueTime")) || "09:00";
    try {
      await addTask({
        contactId: String(d.get("contactId")),
        title: String(d.get("title")),
        type: String(d.get("type")) as Task["type"],
        dueAt: new Date(`${dueDate}T${dueTime}`).toISOString(),
      });
      setOpen(false);
      toast.success("Tarefa criada.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível criar a tarefa.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Execução comercial</p>
          <h2 className="text-3xl font-semibold">Tarefas</h2>
          <p className="mt-1 text-muted-foreground">
            Calls, follow-ups e próximos passos com data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className={`${fieldClass} w-auto min-w-40`}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof ALL | Task["status"])}
            aria-label="Filtro por status"
          >
            <option value={ALL}>Todos os status</option>
            <option value="Pendente">Pendente</option>
            <option value="Concluída">Concluída</option>
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Nova tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova tarefa</DialogTitle>
                <DialogDescription>Associe a tarefa a um contato existente.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="grid gap-3">
                <select name="contactId" className={fieldClass} required defaultValue="">
                  <option value="" disabled>
                    Selecione um contato
                  </option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Input name="title" placeholder="Título da tarefa *" required />
                <div className="grid grid-cols-2 gap-3">
                  <select name="type" className={fieldClass}>
                    {TASK_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <Input name="dueDate" type="date" required />
                </div>
                <Input name="dueTime" type="time" defaultValue="09:00" />
                <Button>Salvar tarefa</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
                onClick={() => void toggleTask(task.id)}
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
        {!ordered.length && (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa para este filtro.</p>
        )}
      </div>
    </div>
  );
}
