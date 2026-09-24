import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { products as staticProducts } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$eventId")({ component: EventDetailPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

interface EventRow {
  id: string;
  slug: string;
  name: string;
  product: string;
  headline: string | null;
  subtitle: string | null;
  brand_color: string;
  logo_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  reminder_days: number[];
  channel: "whatsapp" | "email" | "both";
  welcome_message: string | null;
  reminder_message: string | null;
  closing_message: string | null;
  followup_message: string | null;
  group_url: string | null;
  group_cta: string | null;
  active: boolean;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Registration {
  id: string;
  attended: boolean;
  attended_at: string | null;
  registered_at: string;
  contacts: { id: string; name: string; phone: string; email: string | null } | null;
}

function toLocalDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeProducts, setActiveProducts] = useState<string[]>(staticProducts);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setEvent(data as EventRow);
  }

  async function loadRegistrations() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("event_registrations")
      .select("id,attended,attended_at,registered_at,contacts(id,name,phone,email)")
      .eq("event_id", eventId)
      .order("registered_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRegistrations([]);
      return;
    }
    setRegistrations(data as unknown as Registration[]);
  }

  async function toggleAttended(registrationId: string, attended: boolean) {
    if (!supabase) return;
    const attendedAt = attended ? new Date().toISOString() : null;
    setRegistrations(
      (prev) =>
        prev?.map((r) =>
          r.id === registrationId ? { ...r, attended, attended_at: attendedAt } : r,
        ) ?? null,
    );
    const { error } = await supabase
      .from("event_registrations")
      .update({ attended, attended_at: attendedAt })
      .eq("id", registrationId);
    if (error) {
      toast.error(error.message);
      void loadRegistrations();
      return;
    }
    toast.success(attended ? "Presença confirmada." : "Presença desmarcada.");
  }

  useEffect(() => {
    void load();
    void loadRegistrations();
    if (!supabase) return;
    supabase
      .from("products")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data?.length) setActiveProducts(data.map((p) => p.name));
      });
  }, [eventId]);

  if (!event) {
    return (
      <div className="space-y-4">
        <Link to="/events" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Voltar para eventos
        </Link>
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/register/${event.slug}`;
  const embedSnippet = `<iframe src="${publicUrl}" style="width:100%;max-width:480px;height:640px;border:0" title="${event.name}"></iframe>`;
  const attendedCount = registrations?.filter((r) => r.attended).length ?? 0;

  async function copyEmbed() {
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function save(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!supabase || !event) return;
    const d = new FormData(formEvent.currentTarget);
    setSaving(true);
    try {
      let logoUrl = event.logo_url;
      const logoFile = d.get("logo") as File | null;
      if (logoFile && logoFile.size > 0) {
        const path = `${event.slug}-${Date.now()}-${logoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("event-branding")
          .upload(path, logoFile);
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from("event-branding").getPublicUrl(path).data.publicUrl;
      }

      const reminderDays = String(d.get("reminderDays") || "")
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v) && v > 0);
      const startsAtRaw = String(d.get("startsAt") || "");
      const endsAtRaw = String(d.get("endsAt") || "");

      const { error } = await supabase
        .from("events")
        .update({
          name: String(d.get("name")).trim(),
          product: String(d.get("product")),
          headline: String(d.get("headline") || "").trim() || null,
          subtitle: String(d.get("subtitle") || "").trim() || null,
          brand_color: String(d.get("brandColor") || "#06101D"),
          logo_url: logoUrl,
          starts_at: startsAtRaw ? new Date(startsAtRaw).toISOString() : null,
          ends_at: endsAtRaw ? new Date(endsAtRaw).toISOString() : null,
          reminder_days: reminderDays,
          channel: String(d.get("channel") || "whatsapp"),
          welcome_message: String(d.get("welcomeMessage") || "").trim() || null,
          reminder_message: String(d.get("reminderMessage") || "").trim() || null,
          closing_message: String(d.get("closingMessage") || "").trim() || null,
          followup_message: String(d.get("followupMessage") || "").trim() || null,
          group_url: String(d.get("groupUrl") || "").trim() || null,
          group_cta: String(d.get("groupCta") || "").trim() || null,
          active: d.get("active") === "on",
        })
        .eq("id", event.id);
      if (error) throw error;
      toast.success("Evento atualizado.");
      void load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/events" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> Voltar para eventos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{event.product}</p>
          <h2 className="text-3xl font-semibold">{event.name}</h2>
        </div>
        <Badge variant={event.active ? "default" : "outline"}>
          {event.active ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link público</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-xs">
              {publicUrl}
            </code>
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                Abrir
              </a>
            </Button>
          </div>
          <div className="flex items-start gap-2">
            <code className="flex-1 whitespace-pre-wrap break-all rounded-md border bg-muted/40 px-3 py-2 text-xs">
              {embedSnippet}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copyEmbed()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inscritos</CardTitle>
        </CardHeader>
        <CardContent>
          {registrations === null ? (
            <p className="text-sm text-muted-foreground">Carregando inscritos…</p>
          ) : registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {registrations.length} inscrito(s) · {attendedCount} compareceu(ram)
              </p>
              <div className="overflow-hidden rounded-xl border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="p-4">Nome</th>
                        <th className="p-4">Telefone</th>
                        <th className="p-4">Inscrito em</th>
                        <th className="p-4">Compareceu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="p-4 font-medium">{r.contacts?.name ?? "—"}</td>
                          <td className="p-4">{r.contacts?.phone ?? "—"}</td>
                          <td className="p-4 text-muted-foreground">
                            {toLocalDateTime(r.registered_at)}
                          </td>
                          <td className="p-4">
                            <Switch
                              checked={r.attended}
                              onCheckedChange={(checked) => void toggleAttended(r.id, checked)}
                              aria-label={`Marcar presença de ${r.contacts?.name ?? "contato"}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar evento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3">
            <Input name="name" placeholder="Nome do evento *" defaultValue={event.name} required />
            <select name="product" className={fieldClass} defaultValue={event.product} required>
              {activeProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input name="headline" placeholder="Título" defaultValue={event.headline ?? ""} />
            <textarea
              name="subtitle"
              placeholder="Subtítulo/descrição"
              defaultValue={event.subtitle ?? ""}
              className="min-h-20 rounded-md border bg-background p-3 text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Cor</label>
              <input
                type="color"
                name="brandColor"
                defaultValue={event.brand_color}
                className="h-10 w-14 rounded-md border bg-background"
              />
              {event.logo_url && (
                <img src={event.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
              )}
              <label className="ml-2 flex-1 text-xs text-muted-foreground">
                Trocar logo
                <input type="file" name="logo" accept="image/*" className="mt-1 block text-xs" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Início
                <input
                  type="datetime-local"
                  name="startsAt"
                  defaultValue={toLocalInput(event.starts_at)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Fim
                <input
                  type="datetime-local"
                  name="endsAt"
                  defaultValue={toLocalInput(event.ends_at)}
                  className={`${fieldClass} mt-1`}
                />
              </label>
            </div>
            <Input
              name="reminderDays"
              placeholder="Lembrar quantos dias antes (ex: 3,1)"
              defaultValue={(event.reminder_days ?? []).join(",")}
            />
            <Input
              name="groupUrl"
              type="url"
              placeholder="Link do grupo (ex: https://chat.whatsapp.com/...)"
              defaultValue={event.group_url ?? ""}
            />
            <Input
              name="groupCta"
              placeholder="Texto do botão do grupo (padrão: Entrar no grupo do evento)"
              defaultValue={event.group_cta ?? ""}
            />
            <select name="channel" className={fieldClass} defaultValue={event.channel}>
              <option value="whatsapp">Só WhatsApp</option>
              <option value="email">Só e-mail</option>
              <option value="both">WhatsApp e e-mail</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Use <code>{"{{nome}}"}</code> e <code>{"{{evento}}"}</code> nas mensagens. Deixe em
              branco pra não enviar aquela etapa.
            </p>
            <textarea
              name="welcomeMessage"
              placeholder="Mensagem de boas-vindas"
              defaultValue={event.welcome_message ?? ""}
              className="min-h-16 rounded-md border bg-background p-3 text-sm"
            />
            <textarea
              name="reminderMessage"
              placeholder="Mensagem de lembrete"
              defaultValue={event.reminder_message ?? ""}
              className="min-h-16 rounded-md border bg-background p-3 text-sm"
            />
            <textarea
              name="closingMessage"
              placeholder="Mensagem de encerramento"
              defaultValue={event.closing_message ?? ""}
              className="min-h-16 rounded-md border bg-background p-3 text-sm"
            />
            <textarea
              name="followupMessage"
              placeholder="Mensagem de follow-up (D+1)"
              defaultValue={event.followup_message ?? ""}
              className="min-h-16 rounded-md border bg-background p-3 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={event.active} />
              Aceitando inscrições
            </label>
            <Button className="sm:w-fit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
