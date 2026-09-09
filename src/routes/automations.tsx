import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bot, Pause, Play, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/automations")({ component: AutomacoesPage });
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
}

const statusLabel: Record<AutomationRow["status"], string> = {
  pending: "Ativa",
  processing: "Enviando",
  sent: "Enviada",
  blocked: "Pausada",
  failed: "Falhou",
};

function AutomacoesPage() {
  const { contacts } = useCRM();
  const [rows, setRows] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [open, setOpen] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_queue")
      .select("id,contact_id,channel,automation_type,message,status,scheduled_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as AutomationRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const contactName = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);

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
    </div>
  );
}
