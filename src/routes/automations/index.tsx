import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bot, Pause, Play, Plus, Repeat, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { shortDate, useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { audienceFiltersFromJson } from "@/components/automations/AudienceFilterPicker";
import { StartCadenceDialog } from "@/components/automations/StartCadenceDialog";

export const Route = createFileRoute("/automations/")({ component: AutomacoesPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

interface AutomationRow {
  id: string;
  contact_id: string;
  channel: "whatsapp" | "email";
  automation_type: string;
  message: string;
  status: "pending" | "processing" | "sent" | "blocked" | "failed";
  scheduled_at: string;
  created_at: string;
  metadata: { cadence_id?: string } | null;
}

interface CadenceRow {
  id: string;
  name: string;
  trigger_type: string;
  active: boolean;
  audience_filters: Record<string, unknown>;
  step_count: number;
}

const statusLabel: Record<AutomationRow["status"], string> = {
  pending: "Ativa",
  processing: "Enviando",
  sent: "Enviada",
  blocked: "Pausada",
  failed: "Falhou",
};

const triggerLabel: Record<string, string> = {
  manual: "Manual",
  contact_created: "Novo contato",
  tag_added: "Tag adicionada",
  stage_changed: "Mudança de estágio",
  inactivity_days: "Inatividade",
};

function AutomacoesPage() {
  const { contacts } = useCRM();
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [open, setOpen] = useState(false);
  const [cadences, setCadences] = useState<CadenceRow[]>([]);
  const [cadencesLoading, setCadencesLoading] = useState(Boolean(supabase));

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_queue")
      .select(
        "id,contact_id,channel,automation_type,message,status,scheduled_at,created_at,metadata",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as AutomationRow[]);
    setLoading(false);
  }

  async function loadCadences() {
    if (!supabase) return;
    setCadencesLoading(true);
    const { data: cadenceRows, error } = await supabase
      .from("cadences")
      .select("id,name,trigger_type,active,audience_filters")
      .order("created_at", { ascending: false });
    if (error) {
      setCadencesLoading(false);
      return;
    }
    const { data: stepRows } = await supabase.from("cadence_steps").select("cadence_id");
    const counts = new Map<string, number>();
    for (const s of stepRows ?? []) {
      counts.set(s.cadence_id, (counts.get(s.cadence_id) ?? 0) + 1);
    }
    setCadences(
      (cadenceRows ?? []).map((c) => ({
        ...c,
        step_count: counts.get(c.id) ?? 0,
      })) as CadenceRow[],
    );
    setCadencesLoading(false);
  }

  useEffect(() => {
    void load();
    void loadCadences();
  }, []);

  const contactName = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const cadenceName = useMemo(() => new Map(cadences.map((c) => [c.id, c.name])), [cadences]);

  async function createAutomation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const d = new FormData(event.currentTarget);
    const contactId = String(d.get("contactId"));
    const channel = String(d.get("channel"));
    const message = String(d.get("message"));
    const { error } = await supabase.rpc("enqueue_automation", {
      p_contact_id: contactId,
      p_opportunity_id: null,
      p_channel: channel,
      p_automation_type: "manual",
      p_message: message,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    toast.success("Automação criada.");
    void load();
  }

  async function toggleStatus(row: AutomationRow) {
    if (!supabase) return;
    const next = row.status === "blocked" ? "pending" : "blocked";
    const { error } = await supabase
      .from("automation_queue")
      .update({ status: next })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  async function toggleCadenceActive(cadence: CadenceRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from("cadences")
      .update({ active: !cadence.active })
      .eq("id", cadence.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void loadCadences();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Régua de contato</p>
          <h2 className="text-3xl font-semibold">Automações</h2>
          <p className="mt-1 text-muted-foreground">
            Mensagens de WhatsApp e e-mail programadas para envio automático.
          </p>
        </div>
      </div>

      <Tabs defaultValue="fila">
        <TabsList>
          <TabsTrigger value="fila">Fila</TabsTrigger>
          <TabsTrigger value="cadencias">Cadências</TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!supabase}>
                  <Plus /> Nova automação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova automação</DialogTitle>
                  <DialogDescription>
                    Programe uma mensagem para um contato. Ela respeita o opt-in cadastrado.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createAutomation} className="grid gap-3">
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
                  <select name="channel" className={fieldClass} defaultValue="whatsapp">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                  </select>
                  <textarea
                    name="message"
                    placeholder="Mensagem"
                    required
                    className="min-h-24 rounded-md border bg-background p-3 text-sm"
                  />
                  <Button>Programar envio</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {!supabase && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Modo demonstração: conecte o Supabase para criar e listar automações.
            </p>
          )}

          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando automações…</p>
            ) : rows.length ? (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {contactName.get(row.contact_id) ?? "Contato"} ·{" "}
                        {row.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                        {row.metadata?.cadence_id && cadenceName.get(row.metadata.cadence_id) && (
                          <Badge variant="outline" className="ml-2 align-middle">
                            <Repeat className="mr-1 h-3 w-3" />
                            {cadenceName.get(row.metadata.cadence_id)}
                          </Badge>
                        )}
                      </p>
                      <p className="max-w-md text-sm text-muted-foreground">{row.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Agendado para {shortDate(row.scheduled_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        row.status === "sent"
                          ? "default"
                          : row.status === "failed"
                            ? "destructive"
                            : row.status === "blocked"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {statusLabel[row.status]}
                    </Badge>
                    {(row.status === "pending" || row.status === "blocked") && (
                      <Button size="sm" variant="outline" onClick={() => void toggleStatus(row)}>
                        {row.status === "blocked" ? (
                          <>
                            <Play className="h-3.5 w-3.5" /> Ativar
                          </>
                        ) : (
                          <>
                            <Pause className="h-3.5 w-3.5" /> Desativar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma automação programada ainda.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cadencias" className="space-y-4">
          <div className="flex justify-end">
            <Button asChild disabled={!supabase}>
              <Link to="/automations/cadences/new">
                <Plus /> Nova cadência
              </Link>
            </Button>
          </div>

          {!supabase && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Modo demonstração: conecte o Supabase para criar e gerenciar cadências.
            </p>
          )}

          <div className="space-y-3">
            {cadencesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando cadências…</p>
            ) : cadences.length ? (
              cadences.map((cadence) => (
                <div
                  key={cadence.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{cadence.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {triggerLabel[cadence.trigger_type] ?? cadence.trigger_type} ·{" "}
                        {cadence.step_count} etapa(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={cadence.active ? "default" : "outline"}>
                      {cadence.active ? "Ativa" : "Inativa"}
                    </Badge>
                    <StartCadenceDialog
                      cadenceId={cadence.id}
                      cadenceName={cadence.name}
                      defaultFilters={audienceFiltersFromJson(cadence.audience_filters)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleCadenceActive(cadence)}
                    >
                      {cadence.active ? (
                        <>
                          <Pause className="h-3.5 w-3.5" /> Desativar
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" /> Ativar
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to="/automations/cadences/$cadenceId"
                        params={{ cadenceId: cadence.id }}
                      >
                        Editar
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma cadência criada ainda.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
