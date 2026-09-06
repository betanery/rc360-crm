import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-xl shadow-primary/5">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold text-primary">RC360 CRM</p>
            <p className="text-sm text-muted-foreground">Acesso restrito à equipe</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error === "Invalid login credentials" ? "E-mail ou senha inválidos." : error}
            </p>
          )}
          <Button className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Entrar
          </Button>
        </form>
      </section>
    </main>
  );
}
