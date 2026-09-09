import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
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
import { money, shortDate, useCRM } from "@/lib/crm-data";
import { toast } from "sonner";

export const Route = createFileRoute("/opportunities")({ component: OportunidadesPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const ALL = "__all__";
type StatusFilter = "Aberta" | "Ganho" | "Perdido";

function OportunidadesPage() {
  const { contacts, opportunities, addOpportunity } = useCRM();
  const [product, setProduct] = useState(ALL);
  const [status, setStatus] = useState<typeof ALL | StatusFilter>(ALL);
  const [open, setOpen] = useState(false);

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filtered = useMemo(
    () =>
      opportunities.filter((o) => {
        const contact = contactById.get(o.contactId);
        const matchesProduct = product === ALL || contact?.product === product;
        const opStatus: StatusFilter =
          o.stage === "Ganho" ? "Ganho" : o.stage === "Perdido" ? "Perdido" : "Aberta";
        const matchesStatus = status === ALL || opStatus === status;
        return matchesProduct && matchesStatus;
      }),
    [opportunities, contactById, product, status],
  );

  const productOptions = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.product))).sort(),
    [contacts],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const dueDate = String(d.get("dueDate"));
    try {
      await addOpportunity({
        contactId: String(d.get("contactId")),
        value: Number(d.get("value")),
        nextAction: String(d.get("nextAction")),
        nextActionAt: new Date(`${dueDate}T10:00`).toISOString(),
      });
      setOpen(false);
      toast.success("Oportunidade criada.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível criar a oportunidade.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Carteira comercial</p>
          <h2 className="text-3xl font-semibold">Oportunidades</h2>
          <p className="mt-1 text-muted-foreground">
            Todas as oportunidades em uma visão de tabela.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Nova oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova oportunidade</DialogTitle>
              <DialogDescription>Associe a um contato já cadastrado.</DialogDescription>
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
              <Input
                name="value"
                type="number"
                min="0"
                step="0.01"
                placeholder="Valor (R$) *"
                required
              />
              <Input name="nextAction" placeholder="Próxima ação *" required />
              <Input name="dueDate" type="date" required />
              <Button>Salvar oportunidade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className={`${fieldClass} w-auto min-w-40`}
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          aria-label="Filtro por funil"
        >
          <option value={ALL}>Todos os funis</option>
          {productOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className={`${fieldClass} w-auto min-w-40`}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof ALL | StatusFilter)}
          aria-label="Filtro por status"
        >
          <option value={ALL}>Todos os status</option>
          <option value="Aberta">Aberta</option>
          <option value="Ganho">Ganho</option>
          <option value="Perdido">Perdido</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-4">Contato</th>
                <th className="p-4">Funil</th>
                <th className="p-4">Etapa</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Próxima ação</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const contact = contactById.get(o.contactId);
                return (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-medium">{contact?.name}</p>
                      <p className="text-xs text-muted-foreground">{contact?.company}</p>
                    </td>
                    <td className="p-4">{contact?.product}</td>
                    <td className="p-4">
                      <Badge
                        variant={
                          o.stage === "Ganho"
                            ? "default"
                            : o.stage === "Perdido"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {o.stage}
                      </Badge>
                    </td>
                    <td className="p-4 font-semibold">{money.format(o.value)}</td>
                    <td className="p-4">
                      <p>{o.nextAction}</p>
                      <p className="text-xs text-muted-foreground">{shortDate(o.nextActionAt)}</p>
                    </td>
                    <td className="p-4 text-right">
                      {contact && (
                        <Link
                          to="/contacts/$contactId"
                          params={{ contactId: contact.id }}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          Detalhes <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma oportunidade neste filtro.</p>
        )}
      </div>
    </div>
  );
}
