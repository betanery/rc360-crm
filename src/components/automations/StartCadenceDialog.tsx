import { useState } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  AudienceFilterPicker,
  matchesAudienceFilters,
  type AudienceFilters,
} from "./AudienceFilterPicker";

export function StartCadenceDialog({
  cadenceId,
  cadenceName,
  defaultFilters,
}: {
  cadenceId: string;
  cadenceName: string;
  defaultFilters: AudienceFilters;
}) {
  const { contacts } = useCRM();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<AudienceFilters>(defaultFilters);
  const [starting, setStarting] = useState(false);

  const matched = contacts.filter((c) => matchesAudienceFilters(c, filters));

  async function start() {
    if (!supabase) return;
    setStarting(true);
    try {
      const { data, error } = await supabase.rpc("start_cadence", {
        p_cadence_id: cadenceId,
        p_contact_ids: matched.map((c) => c.id),
      });
      if (error) throw error;
      toast.success(`Cadência iniciada para ${data ?? matched.length} contato(s).`);
      setOpen(false);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível iniciar a cadência.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : setOpen(false))}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Rocket className="h-3.5 w-3.5" /> Iniciar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar "{cadenceName}"</DialogTitle>
          <DialogDescription>
            Escolha o público. Todos os contatos que baterem com o filtro entram na cadência agora.
          </DialogDescription>
        </DialogHeader>
        <AudienceFilterPicker value={filters} onChange={setFilters} />
        <p className="text-sm text-muted-foreground">
          {matched.length} contato(s) selecionado(s)
          {matched.length > 0 && matched.length <= 6
            ? `: ${matched.map((c) => c.name).join(", ")}`
            : ""}
        </p>
        <Button disabled={starting || matched.length === 0} onClick={() => void start()}>
          {starting ? "Iniciando…" : `Iniciar para ${matched.length} contato(s)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
