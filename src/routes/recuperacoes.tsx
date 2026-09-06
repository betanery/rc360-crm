import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money, shortDate, useCRM } from "@/lib/crm-data";

export const Route = createFileRoute("/recuperacoes")({ component: RecuperacoesPage });
function RecuperacoesPage() {
  const { contacts, opportunities, carts, updateCart } = useCRM();
  const contactRecovery = opportunities.filter(
    (o) =>
      o.stage === "Perdido" ||
      contacts
        .find((c) => c.id === o.contactId)
        ?.tags.some((t) => ["Não respondeu", "Proposta sem retorno"].includes(t)),
  );
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Retomadas</p>
        <h2 className="text-3xl font-semibold">Recuperações</h2>
        <p className="mt-1 text-muted-foreground">
          Contato parado e carrinho interrompido são fluxos diferentes.
        </p>
      </div>
      <Tabs defaultValue="contatos">
        <TabsList>
          <TabsTrigger value="contatos">
            <MessageCircle />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="carrinhos">
            <ShoppingCart />
            Carrinhos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="contatos" className="mt-4 space-y-3">
          {contactRecovery.map((item) => {
            const c = contacts.find((x) => x.id === item.contactId);
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="font-semibold">{c?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c?.product} · {item.lostReason || c?.tags.join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money.format(item.value)}</p>
                  <p className="text-xs text-muted-foreground">
                    Retomar: {shortDate(item.nextActionAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="carrinhos" className="mt-4 space-y-3">
          {carts.map((cart) => {
            const c = contacts.find((x) => x.id === cart.contactId);
            return (
              <div
                key={cart.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
              >
                <div className="min-w-52 flex-1">
                  <p className="font-semibold">{c?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {cart.product} · {cart.reason}
                  </p>
                </div>
                <p className="font-semibold">{money.format(cart.value)}</p>
                <Badge variant="secondary">{cart.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateCart(cart.id, "Recuperado")}
                >
                  Marcar recuperado
                </Button>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
