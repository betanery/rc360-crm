import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, shortDate, useCRM } from "@/lib/crm-data";

export const Route = createFileRoute("/contatos/$contactId")({ component: ContatoDetalhePage });

function ContatoDetalhePage() {
  const { contactId } = Route.useParams();
  const { contacts, opportunities, tasks, carts } = useCRM();
  const contact = contacts.find((c) => c.id === contactId);

  if (!contact) {
    return (
      <div className="space-y-4">
        <Link to="/contatos" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Voltar para contatos
        </Link>
        <p className="text-muted-foreground">Contato não encontrado.</p>
      </div>
    );
  }

  const contactOpportunities = opportunities.filter((o) => o.contactId === contactId);
  const contactTasks = tasks.filter((t) => t.contactId === contactId);
  const contactCarts = carts.filter((c) => c.contactId === contactId);

  return (
    <div className="space-y-6">
      <Link to="/contatos" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> Voltar para contatos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{contact.company || "Sem empresa"}</p>
          <h2 className="text-3xl font-semibold">{contact.name}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </span>
            {contact.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </span>
            )}
          </div>
        </div>
        <Badge variant="secondary">{contact.product}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Origem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Canal:</span> {contact.source || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Campanha:</span> {contact.campaign || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Responsável:</span> {contact.owner || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Cadastrado em:</span>{" "}
              {shortDate(contact.createdAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {contact.tags.length ? (
              contact.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Sem tags</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{contact.notes || "Sem observações."}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades ({contactOpportunities.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactOpportunities.length ? (
            contactOpportunities.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{o.nextAction}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(o.nextActionAt)}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{o.stage}</Badge>
                  <p className="mt-1 text-sm font-semibold">{money.format(o.value)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade registrada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas ({contactTasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactTasks.length ? (
            contactTasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <p className="font-medium">{t.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.type}</Badge>
                  <Badge variant={t.status === "Concluída" ? "default" : "secondary"}>
                    {t.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{shortDate(t.dueAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa registrada.</p>
          )}
        </CardContent>
      </Card>

      {contactCarts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Carrinhos ({contactCarts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactCarts.map((cart) => (
              <div
                key={cart.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{cart.product}</p>
                  <p className="text-xs text-muted-foreground">{cart.reason}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{cart.status}</Badge>
                  <p className="mt-1 text-sm font-semibold">{money.format(cart.value)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
