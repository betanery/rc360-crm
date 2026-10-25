import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabaseAnonKeyValue, supabaseFunctionsUrl } from "@/lib/supabase";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search["c"] === "string" ? search["c"] : "",
    t: typeof search["t"] === "string" ? search["t"] : "",
  }),
});

type State = "loading" | "ready" | "invalid" | "submitting" | "done" | "error";

// Página pública (sem login) aberta pelo link "cancelar a inscrição" dos
// e-mails de conteúdo. O link só confere; quem descadastra é o botão.
function UnsubscribePage() {
  const { c, t } = Route.useSearch();
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState("");
  const [already, setAlready] = useState(false);

  const endpoint = `${supabaseFunctionsUrl}/crm-unsubscribe?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`;
  const headers = {
    apikey: supabaseAnonKeyValue,
    Authorization: `Bearer ${supabaseAnonKeyValue}`,
  };

  useEffect(() => {
    if (!supabaseFunctionsUrl || !c || !t) {
      setState("invalid");
      return;
    }
    fetch(endpoint, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { email?: string; alreadyOptedOut?: boolean }) => {
        setEmail(data.email ?? "");
        setAlready(Boolean(data.alreadyOptedOut));
        setState(data.alreadyOptedOut ? "done" : "ready");
      })
      .catch(() => setState("invalid"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, t]);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch(endpoint, { method: "POST", headers });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="font-serif text-2xl font-bold text-primary">RC360</p>
        {state === "loading" && <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin" />}
        {state === "invalid" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Este link é inválido ou expirou. Se continuar recebendo e-mails, responda a um deles
            pedindo para sair da lista.
          </p>
        )}
        {(state === "ready" || state === "submitting" || state === "error") && (
          <>
            <h1 className="mt-4 text-lg font-semibold">Deixar de receber nossos e-mails?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {email ? `O endereço ${email} ` : "Este endereço "}
              não receberá mais conteúdos da RC360.
            </p>
            {state === "error" && (
              <p className="mt-2 text-sm text-destructive">
                Não foi possível concluir. Tente novamente em instantes.
              </p>
            )}
            <button
              onClick={() => void confirm()}
              disabled={state === "submitting"}
              className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {state === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
              Deixar de receber
            </button>
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="mt-4 text-lg font-semibold">
              {already ? "Você já não recebe nossos e-mails" : "Pronto, inscrição cancelada"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Se foi um engano, é só nos avisar por e-mail que voltamos a enviar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
