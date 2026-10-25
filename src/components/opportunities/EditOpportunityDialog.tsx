import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/fields";
import { money, useCRM, type Opportunity } from "@/lib/crm-data";
import { useActiveProducts } from "@/lib/use-products";
import { toast } from "sonner";

const toDateInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function EditOpportunityDialog({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity | null;
  onClose: () => void;
}) {
  const { updateOpportunity } = useCRM();
  const { names, prices } = useActiveProducts();
  const [product, setProduct] = useState("");
  const [value, setValue] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opportunity) return;
    setProduct(opportunity.product);
    setValue(String(opportunity.value));
    setNextAction(opportunity.nextAction);
    setDueDate(toDateInput(opportunity.nextActionAt));
  }, [opportunity]);

  // O produto atual pode ter sido desativado depois: continua na lista.
  const options =
    opportunity && !names.includes(opportunity.product) ? [opportunity.product, ...names] : names;

  function chooseProduct(name: string) {
    setProduct(name);
    if (prices[name] !== undefined) setValue(String(prices[name]));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity) return;
    setSaving(true);
    try {
      await updateOpportunity(opportunity.id, {
        product,
        value: Number(value),
        nextAction,
        nextActionAt: dueDate
          ? new Date(`${dueDate}T10:00`).toISOString()
          : opportunity.nextActionAt,
      });
      toast.success("Oportunidade atualizada.");
      onClose();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível atualizar a oportunidade.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={opportunity !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar oportunidade</DialogTitle>
          <DialogDescription>
            A etapa não muda aqui: use o Pipeline para mover a oportunidade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Produto
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={product}
              onChange={(e) => chooseProduct(e.target.value)}
              required
            >
              {options.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Field label="Valor (R$)" type="number" value={value} onChange={setValue} />
          {prices[product] !== undefined ? (
            <p className="-mt-1 text-xs text-muted-foreground">
              Valor do cadastro do produto: {money.format(prices[product])}. Você pode alterar.
            </p>
          ) : (
            <p className="-mt-1 text-xs text-muted-foreground">
              Este produto não tem preço cadastrado.{" "}
              <Link to="/products" className="text-primary underline">
                Cadastrar em Produtos
              </Link>
              .
            </p>
          )}
          <Field
            label="Próxima ação — o que precisa ser feito"
            value={nextAction}
            onChange={setNextAction}
          />
          <Field
            label="Prazo da próxima ação — até quando"
            type="date"
            value={dueDate}
            onChange={setDueDate}
          />
          <Button disabled={saving || !nextAction.trim() || Number(value) < 0 || value === ""}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
