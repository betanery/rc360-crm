import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Save, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Area, DeliverablesEditor, Field, Group } from "@/components/forms/fields";
import { money, products as staticProducts } from "@/lib/crm-data";
import type { DeliverableRow, ProposalTemplate } from "@/lib/proposal-pdf";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({ component: ProdutosPage });

interface ProductRow {
  id: string;
  name: string;
  active: boolean;
  template: ProposalTemplate;
  price: number | null;
  audience: string;
  summary: string;
  deliverables: DeliverableRow[];
  format: string;
  participants: string;
  duration: string;
  validityDays: number;
  paymentTerms: string;
  notes: string;
}

const FULL_COLUMNS =
  "id,name,active,template,price,audience,summary,deliverables,format,participants,duration,validity_days,payment_terms,notes";

const TEMPLATE_LABEL: Record<ProposalTemplate, string> = {
  entrada: "Produto de entrada",
  executiva: "Executiva",
  estrategica: "Estratégica",
};

const emptyProduct = (): ProductRow => ({
  id: "",
  name: "",
  active: true,
  template: "executiva",
  price: null,
  audience: "",
  summary: "",
  deliverables: [],
  format: "",
  participants: "",
  duration: "",
  validityDays: 15,
  paymentTerms: "",
  notes: "",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDb(row: any): ProductRow {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    template: (row.template as ProposalTemplate) ?? "executiva",
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    audience: row.audience ?? "",
    summary: row.summary ?? "",
    deliverables: Array.isArray(row.deliverables) ? (row.deliverables as DeliverableRow[]) : [],
    format: row.format ?? "",
    participants: row.participants ?? "",
    duration: row.duration ?? "",
    validityDays: row.validity_days ?? 15,
    paymentTerms: row.payment_terms ?? "",
    notes: row.notes ?? "",
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function ProdutosPage() {
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [catalogAvailable, setCatalogAvailable] = useState(true);
  const [form, setForm] = useState<ProductRow | null>(null);
  const [inUse, setInUse] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    let { data, error } = await supabase
      .from("products")
      .select(FULL_COLUMNS)
      .order("name", { ascending: true });
    if (error) {
      // Migration do catálogo ainda não aplicada: mantém a tela funcionando
      // só com nome e ativo/inativo.
      const fallback = await supabase
        .from("products")
        .select("id,name,active")
        .order("name", { ascending: true });
      data = fallback.data as typeof data;
      error = fallback.error;
      setCatalogAvailable(false);
    } else {
      setCatalogAvailable(true);
    }
    if (error) {
      toast.error(error.message);
    } else {
      setItems((data ?? []).map(fromDb));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function openForm(product: ProductRow | null) {
    setInUse(false);
    setForm(product ?? emptyProduct());
    if (product && supabase) {
      const tables = ["contacts", "opportunities"] as const;
      const counts = await Promise.all(
        tables.map((table) =>
          supabase!
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("product", product.name),
        ),
      );
      setInUse(counts.some((result) => (result.count ?? 0) > 0));
    }
  }

  const patch = (changes: Partial<ProductRow>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !form) return;
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    const payload: Record<string, unknown> = catalogAvailable
      ? {
          name,
          active: form.active,
          template: form.template,
          price: form.price,
          audience: orNull(form.audience),
          summary: orNull(form.summary),
          deliverables: form.deliverables.filter((row) => row.name.trim()),
          format: orNull(form.format),
          participants: orNull(form.participants),
          duration: orNull(form.duration),
          validity_days: form.validityDays > 0 ? form.validityDays : 15,
          payment_terms: orNull(form.paymentTerms),
          notes: orNull(form.notes),
        }
      : { name, active: form.active };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate") ? "Já existe um produto com esse nome." : error.message,
      );
      return;
    }
    toast.success(form.id ? "Produto atualizado." : "Produto criado.");
    setForm(null);
    void load();
  }

  const rows =
    items ??
    staticProducts.map((name, index) => ({ ...emptyProduct(), id: `demo-${index}`, name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Catálogo</p>
          <h2 className="text-3xl font-semibold">Produtos</h2>
          <p className="mt-1 text-muted-foreground">
            Preço, entregáveis e condições de cada produto. A proposta em PDF já nasce preenchida
            com eles.
          </p>
        </div>
        <Button disabled={!supabase} onClick={() => void openForm(null)}>
          <Plus /> Novo produto
        </Button>
      </div>

      {!supabase && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Modo demonstração: conecte o Supabase para criar, editar e desativar produtos.
        </p>
      )}
      {supabase && !catalogAvailable && !loading && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Recurso pendente: aplique a migration 019_product_catalog.sql para cadastrar preço e
          entregáveis.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando produtos…</p>
        ) : (
          rows.map((product) => (
            <div key={product.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <Badge variant={product.active ? "default" : "outline"} className="mt-1">
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                {supabase && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void openForm(product)}
                    aria-label="Editar produto"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {catalogAvailable && supabase && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="text-base font-semibold text-primary">
                    {product.price !== null ? money.format(product.price) : "Sem preço"}
                  </p>
                  <p>
                    Proposta {TEMPLATE_LABEL[product.template].toLowerCase()} ·{" "}
                    {product.deliverables.length} entregável(is)
                  </p>
                  {product.audience && <p className="line-clamp-2">{product.audience}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={form !== null} onOpenChange={(isOpen) => !isOpen && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>Campos em branco não aparecem na proposta em PDF.</DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={save} className="grid gap-4">
              <Group title="Identificação">
                <Field
                  label="Nome do produto *"
                  value={form.name}
                  disabled={inUse}
                  onChange={(name) => patch({ name })}
                />
                {inUse && (
                  <p className="text-xs text-muted-foreground">
                    Este produto já está em uso em contatos ou oportunidades, então o nome não pode
                    ser alterado. Para trocar, desative-o e crie outro.
                  </p>
                )}
                {catalogAvailable && (
                  <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                    Modelo de proposta
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={form.template}
                      onChange={(e) => patch({ template: e.target.value as ProposalTemplate })}
                    >
                      <option value="entrada">Produto de entrada (curta)</option>
                      <option value="executiva">Executiva (intermediária)</option>
                      <option value="estrategica">Estratégica (completa)</option>
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => patch({ active: e.target.checked })}
                  />
                  Produto ativo (aparece nos cadastros e nas propostas)
                </label>
              </Group>

              {catalogAvailable && (
                <>
                  <Group title="Oferta">
                    <Field
                      label="Preço (R$)"
                      type="number"
                      value={form.price === null ? "" : String(form.price)}
                      onChange={(value) => patch({ price: value ? Number(value) : null })}
                    />
                    <Field
                      label="Para quem é"
                      value={form.audience}
                      onChange={(audience) => patch({ audience })}
                    />
                    <Area
                      label="Resumo"
                      value={form.summary}
                      onChange={(summary) => patch({ summary })}
                    />
                  </Group>

                  <Group title="Entregáveis">
                    <DeliverablesEditor
                      rows={form.deliverables}
                      onChange={(deliverables) => patch({ deliverables })}
                      withQty
                    />
                  </Group>

                  <Group title="Condições">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field
                        label="Formato"
                        value={form.format}
                        onChange={(format) => patch({ format })}
                      />
                      <Field
                        label="Participantes"
                        value={form.participants}
                        onChange={(participants) => patch({ participants })}
                      />
                      <Field
                        label="Duração / tempo de reuniões"
                        value={form.duration}
                        onChange={(duration) => patch({ duration })}
                      />
                      <Field
                        label="Validade da proposta (dias)"
                        type="number"
                        value={String(form.validityDays)}
                        onChange={(value) => patch({ validityDays: Number(value) })}
                      />
                    </div>
                    <Field
                      label="Forma de pagamento"
                      value={form.paymentTerms}
                      onChange={(paymentTerms) => patch({ paymentTerms })}
                    />
                    <Area
                      label="Observações sobre o valor e o escopo"
                      value={form.notes}
                      onChange={(notes) => patch({ notes })}
                    />
                  </Group>
                </>
              )}

              <Button disabled={saving || !form.name.trim()}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar produto
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
