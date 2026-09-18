import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Loader2, Plus } from "lucide-react";
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

export const Route = createFileRoute("/events/")({ component: EventsPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

const MIGRATION_PENDING = "Recurso pendente: aplique a migration 010_events.sql no Supabase.";

function isMissingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.includes("does not exist")) ||
    Boolean(error?.message?.includes("Could not find the table"))
  );
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface EventRow {
  id: string;
  slug: string;
  name: string;
  brand_color: string;
  starts_at: string | null;
  active: boolean;
}

function EventsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeProducts, setActiveProducts] = useState<string[]>(staticProducts);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("events")
      .select("id,slug,name,brand_color,starts_at,active")
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) setUnavailable(true);
      else toast.error(error.message);
      return;
    }
    setEvents((data ?? []) as EventRow[]);
  }

  useEffect(() => {
    void load();
    if (!supabase) return;
    supabase
      .from("products")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data?.length) setActiveProducts(data.map((p) => p.name));
      });
  }, []);

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const d = new FormData(event.currentTarget);
    const name = String(d.get("name")).trim();
    const finalSlug = slugify(String(d.get("slug") || slug));
    if (!name || !finalSlug) return;
    setSaving(true);
    try {
      let logoUrl: string | null = null;
      const logoFile = d.get("logo") as File | null;
      if (logoFile && logoFile.size > 0) {
        const path = `${finalSlug}-${Date.now()}-${logoFile.name}`;
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

      const { error } = await supabase.from("events").insert({
        slug: finalSlug,
        name,
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
      });
      if (error) throw error;
      setOpen(false);
      setSlug("");
      setSlugTouched(false);
      toast.success("Evento criado.");
      void load();
    } catch (reason) {
      toast.error(
        reason instanceof Error && reason.message.includes("duplicate")
          ? "Já existe um evento com esse link."
          : reason instanceof Error
            ? reason.message
            : "Não foi possível criar o evento.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!supabase || unavailable) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-accent">Inscrições</p>
          <h2 className="text-3xl font-semibold">Eventos</h2>
        </div>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {!supabase
            ? "Modo demonstração: conecte o Supabase para gerenciar eventos."
            : MIGRATION_PENDING}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Inscrições</p>
          <h2 className="text-3xl font-semibold">Eventos</h2>
          <p className="mt-1 text-muted-foreground">
            Formulários públicos de inscrição para eventos, workshops e aulas.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Novo evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo evento</DialogTitle>
              <DialogDescription>
                Cria o formulário público de inscrição e a sequência de mensagens automáticas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createEvent} className="grid gap-3">
              <Input
                name="name"
                placeholder="Nome do evento *"
                required
                onChange={(e) => {
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">/register/</span>
                <Input
                  name="slug"
                  placeholder="link-do-evento"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <select name="product" className={fieldClass} required defaultValue="">
                <option value="" disabled>
                  Produto vinculado *
                </option>
                {activeProducts.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Input name="headline" placeholder="Título (aparece no formulário)" />
              <Input name="subtitle" placeholder="Subtítulo/descrição" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Cor</label>
                <input
                  type="color"
                  name="brandColor"
                  defaultValue="#06101D"
                  className="h-10 w-14 rounded-md border bg-background"
                />
                <label className="ml-4 flex-1 text-xs text-muted-foreground">
                  Logo (opcional)
                  <input type="file" name="logo" accept="image/*" className="mt-1 block text-xs" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Início
                  <input type="datetime-local" name="startsAt" className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Fim
                  <input type="datetime-local" name="endsAt" className={`${fieldClass} mt-1`} />
                </label>
              </div>
              <Input name="reminderDays" placeholder="Lembrar quantos dias antes (ex: 3,1)" />
              <select name="channel" className={fieldClass} defaultValue="whatsapp">
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
                placeholder="Mensagem de boas-vindas (enviada na hora da inscrição)"
                className="min-h-16 rounded-md border bg-background p-3 text-sm"
              />
              <textarea
                name="reminderMessage"
                placeholder="Mensagem de lembrete (enviada nos dias configurados acima)"
                className="min-h-16 rounded-md border bg-background p-3 text-sm"
              />
              <textarea
                name="closingMessage"
                placeholder="Mensagem de encerramento (enviada quando o evento termina)"
                className="min-h-16 rounded-md border bg-background p-3 text-sm"
              />
              <textarea
                name="followupMessage"
                placeholder="Mensagem de follow-up (enviada 1 dia depois do evento)"
                className="min-h-16 rounded-md border bg-background p-3 text-sm"
              />
              <Button disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Criar evento
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {events === null ? (
          <p className="text-sm text-muted-foreground">Carregando eventos…</p>
        ) : (
          events.map((ev) => (
            <Link
              key={ev.id}
              to="/events/$eventId"
              params={{ eventId: ev.id }}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: ev.brand_color }}
                >
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /register/{ev.slug} · {ev.active ? "Ativo" : "Inativo"}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))
        )}
        {events !== null && !events.length && (
          <p className="text-sm text-muted-foreground">Nenhum evento cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
