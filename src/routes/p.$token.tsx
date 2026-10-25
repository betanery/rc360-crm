import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { money } from "@/lib/crm-data";
import { supabaseAnonKeyValue, supabaseFunctionsUrl } from "@/lib/supabase";

export const Route = createFileRoute("/p/$token")({ component: ProposalPublicPage });

interface PublicProposal {
  clientName: string;
  program: string;
  total: number;
  validUntil: string | null;
  expired: boolean;
  acceptedAt: string | null;
  acceptedName: string | null;
  pdfUrl: string | null;
}

type State = "loading" | "ready" | "invalid" | "submitting" | "error";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// Página pública (sem login) da proposta: o cliente vê o PDF e aceita.
function ProposalPublicPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<State>("loading");
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [message, setMessage] = useState("");

  const endpoint = `${supabaseFunctionsUrl}/crm-proposal-public?t=${encodeURIComponent(token)}`;
  const headers = {
    apikey: supabaseAnonKeyValue,
    Authorization: `Bearer ${supabaseAnonKeyValue}`,
  };

  useEffect(() => {
    if (!supabaseFunctionsUrl) {
      setState("invalid");
      return;
    }
    fetch(endpoint, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: PublicProposal) => {
        setProposal(data);
        setName(data.clientName ?? "");
        setState("ready");
      })
      .catch(() => setState("invalid"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept() {
    setState("submitting");
    setMessage("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error ?? "Não foi possível registrar o aceite.");
        setState("error");
        return;
      }
      setProposal((current) =>
        current
          ? {
              ...current,
              acceptedAt: data.acceptedAt ?? new Date().toISOString(),
              acceptedName: data.acceptedName ?? name,
            }
          : current,
      );
      setState("ready");
    } catch {
      setMessage("Não foi possível registrar o aceite. Tente novamente.");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <p className="text-center font-serif text-2xl font-bold text-primary">RC360</p>

        {state === "loading" && <Loader2 className="mx-auto h-5 w-5 animate-spin" />}

        {state === "invalid" && (
          <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Este link é inválido ou a proposta não está mais disponível. Fale com a RC360 para
            receber um novo.
          </p>
        )}

        {proposal && state !== "loading" && state !== "invalid" && (
          <>
            <div className="rounded-2xl border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Proposta personalizada
              </p>
              <h1 className="mt-1 font-serif text-2xl font-bold">
                {proposal.program || "Proposta RC360"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Para {proposal.clientName}
                {proposal.validUntil ? ` · válida até ${formatDate(proposal.validUntil)}` : ""}
              </p>
              <p className="mt-3 text-xl font-semibold text-primary">
                {money.format(Number(proposal.total))}
              </p>
            </div>

            {proposal.pdfUrl && (
              <div className="space-y-2">
                <iframe
                  title="Proposta"
                  src={proposal.pdfUrl}
                  className="h-[70vh] w-full rounded-2xl border bg-white"
                />
                <a
                  href={proposal.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-sm text-primary underline"
                >
                  Abrir o PDF em outra aba
                </a>
              </div>
            )}

            {proposal.acceptedAt ? (
              <div className="rounded-2xl border border-green-600/30 bg-green-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-700" />
                <p className="mt-2 font-semibold text-green-900">Aceite registrado</p>
                <p className="text-sm text-green-900/80">
                  {proposal.acceptedName} · {new Date(proposal.acceptedAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 text-sm text-green-900/80">
                  A RC360 entrará em contato para os próximos passos.
                </p>
              </div>
            ) : proposal.expired ? (
              <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                Esta proposta expirou. Fale com a RC360 para receber uma atualizada.
              </p>
            ) : (
              <div className="space-y-3 rounded-2xl border bg-card p-6">
                <h2 className="text-lg font-semibold">Aceitar a proposta</h2>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Seu nome completo
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  Li a proposta e aceito as condições descritas nela.
                </label>
                {message && <p className="text-sm text-destructive">{message}</p>}
                <button
                  onClick={() => void accept()}
                  disabled={state === "submitting" || !agree || name.trim().length < 3}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {state === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Aceitar proposta
                </button>
                <p className="text-xs text-muted-foreground">
                  Este é um aceite simples, registrado com nome, data e hora. Não substitui
                  assinatura digital com certificado.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
