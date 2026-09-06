import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { products, useCRM, type Product } from "@/lib/crm-data";
import { toast } from "sonner";

export const Route = createFileRoute("/contatos")({ component: ContatosPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

function ContatosPage() {
  const { contacts, addContact } = useCRM();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        `${c.name} ${c.company} ${c.email} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [contacts, query],
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    try {
      await addContact({
        name: String(d.get("name")),
        company: String(d.get("company")),
        phone: String(d.get("phone")),
        email: String(d.get("email")),
        product: String(d.get("product")) as Product,
        source: String(d.get("source")),
        campaign: String(d.get("campaign")),
        owner: String(d.get("owner")),
        notes: String(d.get("notes")),
      });
      setOpen(false);
      toast.success("Contato salvo.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível salvar o contato.");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Base completa</p>
          <h2 className="text-3xl font-semibold">Contatos</h2>
          <p className="mt-1 text-muted-foreground">
            Todos os leads, clientes e participantes em um só lugar.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Novo contato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo contato</DialogTitle>
              <DialogDescription>
                Registre somente os dados necessários para iniciar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <Input name="name" placeholder="Nome *" required />
              <Input name="company" placeholder="Empresa" />
              <Input name="phone" placeholder="WhatsApp *" required />
              <Input name="email" type="email" placeholder="E-mail" />
              <select name="product" className={fieldClass}>
                {products.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <Input name="source" placeholder="Origem" />
              <Input name="campaign" placeholder="Campanha ou evento" />
              <Input name="owner" placeholder="Responsável" defaultValue="Roberta" />
              <textarea
                name="notes"
                placeholder="Observações"
                className="min-h-20 rounded-md border bg-background p-3 text-sm sm:col-span-2"
              />
              <Button className="sm:col-span-2">Salvar contato</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, empresa, e-mail ou telefone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-4">Contato</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Responsável</th>
                <th className="p-4">Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.company || "Sem empresa"} · {c.phone}
                    </p>
                  </td>
                  <td className="p-4">{c.product}</td>
                  <td className="p-4">
                    <p>{c.source}</p>
                    <p className="text-xs text-muted-foreground">{c.campaign}</p>
                  </td>
                  <td className="p-4">{c.owner}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.length ? (
                        c.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          Sem tags
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
