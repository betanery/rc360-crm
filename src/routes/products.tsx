import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, ShoppingBag } from "lucide-react";
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
import { products as staticProducts } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({ component: ProdutosPage });

interface ProductRow {
  id: string;
  name: string;
  active: boolean;
}

function ProdutosPage() {
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,active")
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setItems((data ?? []) as ProductRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) return;
    const { error } = await supabase.from("products").insert({ name });
    if (error) {
      toast.error(
        error.message.includes("duplicate") ? "Já existe um produto com esse nome." : error.message,
      );
      return;
    }
    setOpen(false);
    toast.success("Produto criado.");
    void load();
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editing) return;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) return;
    const { error } = await supabase.from("products").update({ name }).eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    toast.success("Produto atualizado.");
    void load();
  }

  async function toggleActive(product: ProductRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  const rows =
    items ?? staticProducts.map((name, index) => ({ id: `demo-${index}`, name, active: true }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Catálogo</p>
          <h2 className="text-3xl font-semibold">Produtos</h2>
          <p className="mt-1 text-muted-foreground">
            Produtos usados no cadastro de contatos e oportunidades.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!supabase}>
              <Plus /> Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo produto</DialogTitle>
              <DialogDescription>
                Produtos novos ficam disponíveis para relatórios; para usá-los no cadastro de
                contatos, atualize também a validação do banco de dados.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createProduct} className="grid gap-3">
              <Input name="name" placeholder="Nome do produto *" required />
              <Button>Salvar produto</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!supabase && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Modo demonstração: conecte o Supabase para criar, editar e desativar produtos.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando produtos…</p>
        ) : (
          rows.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
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
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditing(product)}
                    aria-label="Editar produto"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="grid gap-3">
              <Input name="name" defaultValue={editing.name} required />
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => void toggleActive(editing)}>
                  {editing.active ? "Desativar" : "Ativar"}
                </Button>
                <Button>Salvar alterações</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
