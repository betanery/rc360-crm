import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarPlus, MessageCircle, Send, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money, shortDate, useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/recuperacoes")({ component: RecuperacoesPage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));

function RecuperacoesPage() {
  const { contacts, opportunities, carts, updateCart, addTask } = useCRM();
  const [minDays, setMinDays] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const contactRecovery = useMemo(
    () =>
      opportunities
        .filter(
          (o) =>
            o.stage === "Perdido" ||
            contacts
              .find((c) => c.id === o.contactId)
              ?.tags.some((t) => ["Não respondeu", "Proposta sem retorno"].includes(t)),
        )
        .filter((o) => daysSince(o.nextActionAt) >= minDays),
    [opportunities, contacts, minDays],
  );

  const filteredCarts = useMemo(
    () => carts.filter((cart) => daysSince(cart.updatedAt) >= minDays),
    [carts, minDays],
  );

  async function sendWhatsApp(contactId: string, opportunityId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (!supabase) {
      toast.error("Configure o Supabase para enviar mensagens de recuperação.");
      return;
    }
    setSendingId(opportunityId);
    try {
      const { error } = await supabase.rpc("enqueue_automation", {
        p_contact_id: contactId,
        p_opportunity_id: opportunityId,
        p_channel: "whatsapp",
        p_automation_type: "recovery",
        p_message: `Olá ${contact.name.split(" ")[0]}, vi que ficamos de retomar a conversa sobre ${contact.product}. Podemos continuar?`,
      });
      if (error) throw error;
      toast.success("Mensagem enfileirada para envio pelo WhatsApp.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível enfileirar o envio.",
      );
    } finally {
      setSendingId(null);
    }
  }

  async function createFollowUp(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(10, 0, 0, 0);
    try {
      await addTask({
        contactId,
        title: `Follow-up de recuperação${contact ? ` — ${contact.name}` : ""}`,
        type: "Follow-up",
        dueAt: due.toISOString(),
      });
      toast.success("Tarefa de follow-up criada para amanhã.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível criar a tarefa.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Retomadas</p>
          <h2 className="text-3xl font-semibold">Recuperações</h2>
          <p className="mt-1 text-muted-foreground">
            Contato parado e carrinho interrompido são fluxos diferentes.
          </p>
        </div>
        <select
          className={`${fieldClass} w-auto min-w-48`}
          value={minDays}
          onChange={(e) => setMinDays(Number(e.target.value))}
          aria-label="Filtro por dias parado"
        >
          <option value={0}>Qualquer tempo parado</option>
          <option value={3}>Parado há 3+ dias</option>
          <option value={7}>Parado há 7+ dias</option>
          <option value={15}>Parado há 15+ dias</option>
          <option value={30}>Parado há 30+ dias</option>
        </select>
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
                    {c?.product} · {item.lostReason || c?.tags.join(", ")} ·{" "}
                    {daysSince(item.nextActionAt)} dia(s) parado
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold">{money.format(item.value)}</p>
                    <p className="text-xs text-muted-foreground">
                      Retomar: {shortDate(item.nextActionAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void createFollowUp(item.contactId)}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Criar tarefa
                    </Button>
                    <Button
                      size="sm"
                      disabled={sendingId === item.id}
                      onClick={() => void sendWhatsApp(item.contactId, item.id)}
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {!contactRecovery.length && (
            <p className="text-sm text-muted-foreground">Nenhum contato parado neste filtro.</p>
          )}
        </TabsContent>
        <TabsContent value="carrinhos" className="mt-4 space-y-3">
          {filteredCarts.map((cart) => {
            const c = contacts.find((x) => x.id === cart.contactId);
            return (
              <div
                key={cart.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
              >
                <div className="min-w-52 flex-1">
                  <p className="font-semibold">{c?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {cart.product} · {cart.reason} · {daysSince(cart.updatedAt)} dia(s)
                  </p>
                </div>
                <p className="font-semibold">{money.format(cart.value)}</p>
                <Badge variant="secondary">{cart.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void updateCart(cart.id, "Recuperado")}
                >
                  Marcar recuperado
                </Button>
              </div>
            );
          })}
          {!filteredCarts.length && (
            <p className="text-sm text-muted-foreground">Nenhum carrinho neste filtro.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
