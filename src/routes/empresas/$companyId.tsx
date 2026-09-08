import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/empresas/$companyId")({ component: EmpresaDetalhePage });

interface CompanyRow {
  id: string;
  name: string;
  segment: string | null;
  notes: string | null;
}

function EmpresaDetalhePage() {
  const { companyId } = Route.useParams();
  const { contacts } = useCRM();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,segment,notes")
      .eq("id", companyId)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setCompany(data as CompanyRow | null);
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  const relatedContacts = useMemo(
    () => (company ? contacts.filter((c) => c.company === company.name) : []),
    [contacts, company],
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !company) return;
    const d = new FormData(event.currentTarget);
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        segment: String(d.get("segment") || "").trim() || null,
        notes: String(d.get("notes") || "").trim() || null,
      })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Empresa atualizada.");
    void load();
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <Link to="/empresas" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Voltar para empresas
        </Link>
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/empresas" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> Voltar para empresas
      </Link>
      <div>
        <p className="text-sm font-medium text-accent">{company.segment || "Sem segmento"}</p>
        <h2 className="text-3xl font-semibold">{company.name}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Input name="segment" placeholder="Segmento" defaultValue={company.segment ?? ""} />
            <textarea
              name="notes"
              placeholder="Observações"
              defaultValue={company.notes ?? ""}
              className="min-h-20 rounded-md border bg-background p-3 text-sm sm:col-span-2"
            />
            <Button className="sm:col-span-2 sm:w-fit" disabled={saving}>
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contatos ({relatedContacts.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {relatedContacts.length ? (
            relatedContacts.map((c) => (
              <Link
                key={c.id}
                to="/contatos/$contactId"
                params={{ contactId: c.id }}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/30"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone} · {c.product}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.product}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum contato vinculado a esta empresa ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
