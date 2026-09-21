import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseFunctionsUrl, supabaseAnonKeyValue } from "@/lib/supabase";
import { formatCpf } from "@/lib/utils";

export const Route = createFileRoute("/register/$slug")({ component: RegisterPage });

interface PublicEvent {
  name: string;
  headline: string | null;
  subtitle: string | null;
  brand_color: string;
  logo_url: string | null;
}

type LoadState = "loading" | "ready" | "not_found";
type SubmitState = "idle" | "submitting" | "done" | "error";

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatEmail(raw: string) {
  return raw.replace(/\s/g, "").toLowerCase();
}

function RegisterPage() {
  const { slug } = Route.useParams();
  const [state, setState] = useState<LoadState>("loading");
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (!supabaseFunctionsUrl) {
      setState("not_found");
      return;
    }
    fetch(`${supabaseFunctionsUrl}/crm-event-public?slug=${encodeURIComponent(slug)}`, {
      headers: { apikey: supabaseAnonKeyValue, Authorization: `Bearer ${supabaseAnonKeyValue}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setEvent(data.event);
        setState("ready");
      })
      .catch(() => setState("not_found"));
  }, [slug]);

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSubmitState("submitting");
    setSubmitError("");
    const d = new FormData(formEvent.currentTarget);
    try {
      const res = await fetch(`${supabaseFunctionsUrl}/crm-event-submit`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKeyValue,
          Authorization: `Bearer ${supabaseAnonKeyValue}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          name: String(d.get("name")),
          phone: String(d.get("phone")),
          email: String(d.get("email")),
          cpf: String(d.get("cpf")),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Não foi possível confirmar.");
      setSubmitState("done");
    } catch (reason) {
      setSubmitState("error");
      setSubmitError(reason instanceof Error ? reason.message : "Não foi possível confirmar.");
    }
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6EE]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "not_found" || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6EE] px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Inscrições encerradas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esse link não existe mais ou o evento não está aceitando inscrições no momento.
          </p>
        </div>
      </div>
    );
  }

  const color = event.brand_color || "#06101D";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6EE] px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div
          className="flex flex-col items-center gap-3 px-8 py-8 text-center"
          style={{ backgroundColor: color }}
        >
          {event.logo_url && (
            <img src={event.logo_url} alt={event.name} className="h-14 w-auto object-contain" />
          )}
          <h1 className="text-xl font-semibold text-white">{event.headline || event.name}</h1>
          {event.subtitle && (
            <p className="whitespace-pre-line text-sm text-white/80">{event.subtitle}</p>
          )}
        </div>

        <div className="p-8">
          {submitState === "done" ? (
            <div className="text-center">
              <p className="text-lg font-semibold">Inscrição confirmada!</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Você vai receber os próximos passos por WhatsApp/e-mail.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <input
                name="name"
                placeholder="Nome completo *"
                required
                className="h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: color }}
              />
              <input
                name="phone"
                placeholder="WhatsApp *"
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: color }}
              />
              <input
                name="email"
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(formatEmail(e.target.value))}
                className="h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: color }}
              />
              <input
                name="cpf"
                placeholder="CPF"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className="h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                style={{ ["--tw-ring-color" as string]: color }}
              />
              <button
                type="submit"
                disabled={submitState === "submitting"}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white disabled:opacity-70"
                style={{ backgroundColor: color }}
              >
                {submitState === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar inscrição
              </button>
              {submitState === "error" && (
                <p className="text-center text-sm text-destructive">{submitError}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
