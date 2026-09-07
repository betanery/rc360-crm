import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, CheckCircle2, Loader2, Mail, ShoppingBag, Tags, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { products } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });

function ConfiguracoesPage() {
  const [phone, setPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  async function testBotConversa() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setTestStatus("error");
      setTestMessage("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!supabase) {
      setTestStatus("error");
      setTestMessage("Supabase não está configurado no aplicativo.");
      return;
    }

    setTesting(true);
    setTestStatus("idle");
    setTestMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("crm-whatsapp-test", {
        body: { phone: digits, confirmed: true },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível concluir o teste.");

      setTestStatus("success");
      setTestMessage("Mensagem de teste enviada. Confira o WhatsApp informado.");
    } catch (error) {
      setTestStatus("error");
      setTestMessage(error instanceof Error ? error.message : "Falha ao testar o BotConversa.");
    } finally {
      setTesting(false);
    }
  }

  const integrations = [
    ["E-mail", "Confirmações e propostas", Mail],
    ["Kiwify", "Pagamentos e carrinhos", ShoppingBag],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Administração</p>
        <h2 className="text-3xl font-semibold">Configurações</h2>
        <p className="mt-1 text-muted-foreground">
          Integrações e parâmetros operacionais do RC360 CRM.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {products.map((p) => (
              <Badge key={p} variant="secondary" className="px-3 py-1">
                {p}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between rounded-lg border p-3">
              <span>Roberta</span>
              <Badge>Administradora</Badge>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <span>Cinthia</span>
              <Badge variant="outline">Comercial</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">BotConversa</p>
                    <Badge variant={testStatus === "success" ? "default" : "secondary"}>
                      {testStatus === "success" ? "Conectado e testado" : "Configurado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">WhatsApp, qualificação e recuperação.</p>
                  <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                    O teste envia uma mensagem fixa para um contato que já exista no BotConversa. O disparo normal do CRM continua respeitando opt-in.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="WhatsApp com DDD"
                    inputMode="tel"
                    aria-label="Número de WhatsApp para teste"
                  />
                  <Button onClick={testBotConversa} disabled={testing || !phone.trim()}>
                    {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Testar WhatsApp
                  </Button>
                </div>
                {testMessage ? (
                  <p className={`flex items-center gap-1 text-xs ${testStatus === "success" ? "text-emerald-700" : "text-destructive"}`}>
                    {testStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {testMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {integrations.map(([name, description, Icon]) => (
              <div key={name} className="rounded-xl border p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <Badge className="mt-3" variant="outline">
                  Não conectado
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
