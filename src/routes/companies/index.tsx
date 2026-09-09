import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
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
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/companies/")({ component: EmpresasPage });

interface CompanyRow {
  id: string;
  name: string;
  segment: string | null;
}

const MIGRATION_PENDING = "Recurso pendente: aplique a migration 004_companies.sql no Supabase.";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

function EmpresasPage() {
  const { contacts } = useCRM();
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,segment")
      .order("name", { ascending: true });
    if (error) {
      if (isMissingTable(error)) setUnavailable(true);
      else toast.error(error.message);
      return;
    }
    setCompanies((data ?? []) as CompanyRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const d = new FormData(event.currentTarget);
    const name = String(d.get("name")).trim();
    if (!name) return;
    const { error } = await supabase
      .from("companies")
      .insert({ name, segment: String(d.get("segment") || "").trim() || null });
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Já existe uma empresa com esse nome."
          : error.message,
      );
      return;
    }
    setOpen(false);
    toast.success("Empresa criada.");
    void load();
  }

  const contactCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) {
      if (!c.company) continue;
      map.set(c.company, (map.get(c.company) ?? 0) + 1);
    }
    return map;
  }, [contacts]);

  const rows = useMemo(() => {
    const base = companies ?? [];
    const filtered = base.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
    return filtered;
  }, [companies, query]);

  if (!supabase || unavailable) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-accent">Contas</p>
          <h2 className="text-3xl font-semibold">Empresas</h2>
        </div>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {!supabase
            ? "Modo demonstração: conecte o Supabase para gerenciar empresas."
            : MIGRATION_PENDING}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Contas</p>
          <h2 className="text-3xl font-semibold">Empresas</h2>
          <p className="mt-1 text-muted-foreground">
            Cadastro estruturado das empresas dos contatos.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Nova empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova empresa</DialogTitle>
              <DialogDescription>
                Cadastre uma empresa mesmo sem contato ainda vinculado.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createCompany} className="grid gap-3">
              <Input name="name" placeholder="Nome da empresa *" required />
              <Input name="segment" placeholder="Segmento" />
              <Button>Salvar empresa</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar empresa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {companies === null ? (
          <p className="text-sm text-muted-foreground">Carregando empresas…</p>
        ) : (
          rows.map((company) => (
            <Link
              key={company.id}
              to="/companies/$companyId"
              params={{ companyId: company.id }}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {company.segment || "Sem segmento"} ·{" "}
                    {contactCountByName.get(company.name) ?? 0} contato(s)
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))
        )}
        {companies !== null && !rows.length && (
          <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
        )}
      </div>
    </div>
  );
}
