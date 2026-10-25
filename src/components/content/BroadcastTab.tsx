import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Mail, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Area, Field, Group } from "@/components/forms/fields";
import {
  AudienceFilterPicker,
  audienceFiltersToJson,
  emptyAudienceFilters,
  matchesAudienceFilters,
  type AudienceFilters,
} from "@/components/automations/AudienceFilterPicker";
import { shortDate, useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  renderEmailHtml,
  type EmailContent,
} from "../../../supabase/functions/_shared/email-template";

interface BroadcastRow {
  id: string;
  subject: string;
  scheduled_at: string;
  recipients: number;
  skipped: number;
  created_at: string;
}
interface QueueCounts {
  sent: number;
  pending: number;
  failed: number;
  blocked: number;
}

const SAMPLE_NAME = "Maria";

async function extractMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // corpo não era JSON legível
      }
    }
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

export function BroadcastTab() {
  const { contacts } = useCRM();
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [filters, setFilters] = useState<AudienceFilters>(emptyAudienceFilters);
  const [schedule, setSchedule] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [optedIn, setOptedIn] = useState<Set<string> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [counts, setCounts] = useState<Record<string, QueueCounts>>({});

  async function loadOptedIn() {
    if (!supabase) return;
    const ids = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("email_opt_in", true)
        .neq("email", "")
        .not("email", "is", null)
        .range(from, from + 999);
      if (error) {
        toast.error(error.message);
        return;
      }
      for (const row of data ?? []) ids.add(row.id as string);
      if ((data ?? []).length < 1000) break;
    }
    setOptedIn(ids);
  }

  async function loadHistory() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("content_broadcasts")
      .select("id,subject,scheduled_at,recipients,skipped,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return; // migration 023 ainda não aplicada
    setHistory((data ?? []) as BroadcastRow[]);
    const { data: queue } = await supabase
      .from("automation_queue")
      .select("status,metadata")
      .eq("automation_type", "content")
      .limit(5000);
    const next: Record<string, QueueCounts> = {};
    for (const row of queue ?? []) {
      const id = (row.metadata as { broadcast_id?: string } | null)?.broadcast_id;
      if (!id) continue;
      const entry = (next[id] ??= { sent: 0, pending: 0, failed: 0, blocked: 0 });
      const status = row.status as string;
      if (status === "sent") entry.sent++;
      else if (status === "failed") entry.failed++;
      else if (status === "blocked") entry.blocked++;
      else entry.pending++;
    }
    setCounts(next);
  }

  useEffect(() => {
    void loadOptedIn();
    void loadHistory();
  }, []);

  const matched = useMemo(
    () => contacts.filter((contact) => matchesAudienceFilters(contact, filters)),
    [contacts, filters],
  );
  const receivers = useMemo(
    () => (optedIn ? matched.filter((contact) => optedIn.has(contact.id)) : []),
    [matched, optedIn],
  );

  const content: EmailContent = {
    heading: subject.replaceAll("{{nome}}", SAMPLE_NAME) || "Assunto do e-mail",
    bodyText: body.replaceAll("{{nome}}", SAMPLE_NAME) || "O texto do seu e-mail aparece aqui.",
    ...(preheader.trim() ? { preheader: preheader.trim() } : {}),
    ...(ctaLabel.trim() && ctaUrl.trim()
      ? { ctaLabel: ctaLabel.trim(), ctaUrl: ctaUrl.trim() }
      : {}),
    unsubscribeUrl: "#",
  };

  const urlOk = !ctaUrl.trim() || /^https?:\/\//i.test(ctaUrl.trim());
  const ready =
    subject.trim() &&
    body.trim() &&
    urlOk &&
    (!ctaLabel.trim() || ctaUrl.trim()) &&
    (schedule === "now" || scheduledAt);

  async function sendTest() {
    if (!supabase) return;
    setBusy("test");
    try {
      const { data, error } = await supabase.functions.invoke("crm-content-test", {
        body: { subject, preheader, body, ctaLabel, ctaUrl },
      });
      if (error) throw error;
      toast.success(`Teste enviado para ${(data as { to?: string }).to ?? "o seu e-mail"}.`);
    } catch (reason) {
      toast.error(await extractMessage(reason, "Não foi possível enviar o teste."));
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!supabase) return;
    setBusy("send");
    try {
      const { data, error } = await supabase.rpc("enqueue_broadcast", {
        p_subject: subject.trim(),
        p_preheader: preheader.trim(),
        p_body: body.trim(),
        p_cta_label: ctaLabel.trim(),
        p_cta_url: ctaUrl.trim(),
        p_contact_ids: matched.map((contact) => contact.id),
        p_scheduled_at:
          schedule === "later" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : new Date().toISOString(),
        p_audience: audienceFiltersToJson(filters),
      });
      if (error) throw error;
      const result = data as { queued?: number };
      toast.success(`${result.queued ?? 0} e-mail(s) na fila de envio.`);
      setConfirmOpen(false);
      setSubject("");
      setPreheader("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      void loadHistory();
    } catch (reason) {
      toast.error(await extractMessage(reason, "Não foi possível enfileirar o envio."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {!supabase && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Modo demonstração: conecte o Supabase para enviar conteúdos por e-mail.
        </p>
      )}

      <Group title="E-mail">
        <Field
          label="Assunto (use {{nome}} para o primeiro nome)"
          value={subject}
          onChange={setSubject}
        />
        <Field
          label="Texto de prévia (aparece ao lado do assunto na caixa de entrada)"
          value={preheader}
          onChange={setPreheader}
        />
        <Area label="Texto do e-mail" value={body} onChange={setBody} rows={10} />
        <p className="text-xs text-muted-foreground">
          Separe parágrafos com uma linha em branco. Use **negrito**, [texto](https://link) e listas
          com "- " no início da linha.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Botão (texto)" value={ctaLabel} onChange={setCtaLabel} />
          <Field label="Botão (link, começa com https://)" value={ctaUrl} onChange={setCtaUrl} />
        </div>
        {!urlOk && (
          <p className="text-xs text-destructive">O link do botão precisa começar com https://.</p>
        )}
      </Group>

      <Group title="Quem recebe">
        <AudienceFilterPicker value={filters} onChange={setFilters} />
        <p className="text-sm">
          <span className="font-medium">{matched.length}</span> contato(s) no público ·{" "}
          <span className="font-medium">{optedIn ? receivers.length : "…"}</span> com autorização de
          e-mail (recebem) ·{" "}
          <span className="font-medium">{optedIn ? matched.length - receivers.length : "…"}</span>{" "}
          sem autorização (não recebem)
        </p>
        <p className="text-xs text-muted-foreground">
          Só recebe quem aceitou e-mails (formulário de inscrição ou importação com autorização).
          Quem cancelar a inscrição sai da lista automaticamente.
        </p>
      </Group>

      <Group title="Quando enviar">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={schedule === "now"} onChange={() => setSchedule("now")} />
          Agora (os e-mails saem aos poucos, respeitando o limite diário)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={schedule === "later"}
            onChange={() => setSchedule("later")}
          />
          Agendar
        </label>
        {schedule === "later" && (
          <Field
            label="Data e hora"
            type="datetime-local"
            value={scheduledAt}
            onChange={setScheduledAt}
          />
        )}
      </Group>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4" /> Pré-visualizar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!supabase || !subject.trim() || !body.trim() || busy !== null}
          onClick={() => void sendTest()}
        >
          {busy === "test" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Enviar teste para mim
        </Button>
        <Button
          type="button"
          disabled={!supabase || !ready || receivers.length === 0 || busy !== null}
          onClick={() => setConfirmOpen(true)}
        >
          <Send className="h-4 w-4" /> Enviar para {receivers.length} pessoa(s)
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Envios anteriores</h3>
        {history.length ? (
          history.map((row) => {
            const c = counts[row.id];
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{row.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(row.scheduled_at)} · {row.recipients} destinatário(s)
                    {row.skipped ? ` · ${row.skipped} sem autorização` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="default">{c?.sent ?? 0} enviados</Badge>
                  {(c?.pending ?? 0) > 0 && <Badge variant="outline">{c?.pending} na fila</Badge>}
                  {(c?.blocked ?? 0) > 0 && (
                    <Badge variant="outline">{c?.blocked} cancelaram/pausados</Badge>
                  )}
                  {(c?.failed ?? 0) > 0 && <Badge variant="destructive">{c?.failed} falhas</Badge>}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum conteúdo enviado ainda.</p>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
            <DialogDescription>
              Assim o e-mail chega para quem recebe (o nome de exemplo é {SAMPLE_NAME}).
            </DialogDescription>
          </DialogHeader>
          <iframe
            title="Pré-visualização do e-mail"
            srcDoc={renderEmailHtml(content)}
            className="h-[60vh] w-full rounded-md border bg-white"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar este conteúdo?</DialogTitle>
            <DialogDescription>
              {receivers.length} pessoa(s) vão receber "{subject}"{" "}
              {schedule === "later" && scheduledAt
                ? `em ${new Date(scheduledAt).toLocaleString("pt-BR")}`
                : "agora"}
              . Os e-mails saem aos poucos, conforme o limite diário configurado. Não dá para
              desfazer depois que saírem.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy !== null}
            >
              Cancelar
            </Button>
            <Button onClick={() => void send()} disabled={busy !== null}>
              {busy === "send" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Confirmar envio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
