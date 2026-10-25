import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
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
import { money, products as staticProducts, shortDate, useCRM } from "@/lib/crm-data";
import { DeleteOpportunityDialog } from "@/components/opportunities/DeleteOpportunityDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
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
  const [activeProducts, setActiveProducts] = useState<string[]>(staticProducts);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [formContactId, setFormContactId] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formValue, setFormValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void (async () => {
      // Com a coluna de preço (migration 019); sem ela, volta só aos nomes.
      let { data, error } = await client
        .from("products")
        .select("name,price")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) {
        const fallback = await client
          .from("products")
          .select("name")
          .eq("active", true)
          .order("name", { ascending: true });
        data = fallback.data as typeof data;
        error = fallback.error;
      }
      if (error || !data?.length) return;
      setActiveProducts(data.map((p) => p.name));
      const found: Record<string, number> = {};
      for (const row of data as { name: string; price?: number | null }[]) {
        if (row.price !== null && row.price !== undefined) found[row.name] = Number(row.price);
      }
      setPrices(found);
    })();
  }, []);

  // Escolher o produto traz o valor cadastrado nele (continua editável).
  function chooseProduct(name: string) {
    setFormProduct(name);
    if (prices[name] !== undefined) setFormValue(String(prices[name]));
  }

  // Escolher o contato já sugere o produto dele, se estiver cadastrado.
  function chooseContact(id: string) {
    setFormContactId(id);
    const suggested = contacts.find((c) => c.id === id)?.product;
    if (suggested && activeProducts.includes(suggested)) chooseProduct(suggested);
  }

  function openChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setFormContactId("");
      setFormProduct("");
      setFormValue("");
    }
  }

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filtered = useMemo(
    () =>
      opportunities.filter((o) => {
        const matchesProduct = product === ALL || o.product === product;
        const opStatus: StatusFilter =
          o.stage === "Ganho" ? "Ganho" : o.stage === "Perdido" ? "Perdido" : "Aberta";
        const matchesStatus = status === ALL || opStatus === status;
        return matchesProduct && matchesStatus;
      }),
    [opportunities, product, status],
  );

  const productOptions = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.product))).sort(),
    [opportunities],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const dueDate = String(d.get("dueDate"));
    try {
      await addOpportunity({
        contactId: String(d.get("contactId")),
        product: String(d.get("product")),
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
        <Dialog open={open} onOpenChange={openChange}>
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
              <select
                name="contactId"
                className={fieldClass}
                required
                value={formContactId}
                onChange={(e) => chooseContact(e.target.value)}
              >
                <option value="" disabled>
                  Selecione um contato
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                name="product"
                className={fieldClass}
                required
                value={formProduct}
                onChange={(e) => chooseProduct(e.target.value)}
              >
                <option value="" disabled>
                  Selecione o produto
                </option>
                {activeProducts.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
              {prices[formProduct] !== undefined ? (
                <p className="-mt-1 text-xs text-muted-foreground">
                  Valor do cadastro do produto: {money.format(prices[formProduct])}. Você pode
                  alterar.
                </p>
              ) : (
                formProduct && (
                  <p className="-mt-1 text-xs text-muted-foreground">
                    Este produto ainda não tem preço cadastrado.{" "}
                    <Link to="/products" className="text-primary underline">
                      Cadastrar preço em Produtos
                    </Link>
                    .
                  </p>
                )
              )}
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Próxima ação — o que precisa ser feito
                <Input name="nextAction" placeholder="Ex.: Ligar para fechar *" required />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Prazo da próxima ação — até quando
                <Input name="dueDate" type="date" required />
              </label>
              <Button>Salvar oportunidade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className={cn(fieldClass, "w-auto min-w-40")}
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
          className={cn(fieldClass, "w-auto min-w-40")}
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
                    <td className="p-4">{o.product}</td>
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
                      {supabase && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(o.id)}
                          aria-label="Excluir oportunidade"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
      <DeleteOpportunityDialog
        opportunity={opportunities.find((o) => o.id === deleteId) ?? null}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
