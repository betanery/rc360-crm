import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  CircleDollarSign,
  FileText,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, shortDate, useCRM } from "@/lib/crm-data";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  const { contacts, opportunities, tasks } = useCRM();
  const open = opportunities.filter((o) => !["Ganho", "Perdido"].includes(o.stage));
  const sales = opportunities.filter((o) => o.stage === "Ganho");
  const overdue = tasks.filter((t) => t.status === "Pendente" && new Date(t.dueAt) < new Date());
  const stats = [
    ["Contatos", contacts.length, Users],
    ["Oportunidades abertas", open.length, UserPlus],
    [
      "Calls agendadas",
      opportunities.filter((o) => o.stage === "Call agendada").length,
      CalendarCheck,
    ],
    [
      "Propostas enviadas",
      opportunities.filter((o) => o.stage === "Proposta enviada").length,
      FileText,
    ],
    ["Vendas", sales.length, CircleDollarSign],
    ["Tarefas vencidas", overdue.length, AlertTriangle],
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Visão comercial</p>
        <h2 className="text-3xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-muted-foreground">O essencial para decidir e agir hoje.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-semibold">{value}</p>
              </div>
              <div className="rounded-xl bg-primary/8 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline em andamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {open.map((item) => {
              const contact = contacts.find((c) => c.id === item.contactId);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
                >
                  <div>
                    <p className="font-medium">{contact?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {contact?.product} · {item.nextAction}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{item.stage}</Badge>
                    <p className="mt-1 text-sm font-semibold">{money.format(item.value)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Próximas ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks
              .filter((t) => t.status === "Pendente")
              .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))
              .slice(0, 5)
              .map((task) => (
                <div key={task.id} className="border-l-2 border-accent pl-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {contacts.find((c) => c.id === task.contactId)?.name} · {shortDate(task.dueAt)}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
