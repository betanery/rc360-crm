import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCRM } from "@/lib/crm-data";
import { toast } from "sonner";

export function DeleteOpportunityDialog({
  opportunity,
  onClose,
}: {
  opportunity: { id: string; nextAction: string; product: string } | null;
  onClose: () => void;
}) {
  const { deleteOpportunity } = useCRM();
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    if (!opportunity) return;
    setDeleting(true);
    try {
      await deleteOpportunity(opportunity.id);
      toast.success("Oportunidade excluída.");
      onClose();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível excluir a oportunidade.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={opportunity !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir oportunidade</DialogTitle>
          <DialogDescription>
            Isso apaga a oportunidade "{opportunity?.nextAction}" ({opportunity?.product}) com suas
            objeções, mapa de decisão e propostas em PDF. Mensagens ainda na fila ligadas a ela são
            pausadas. O contato e o histórico de mensagens já enviadas não são apagados. Não pode
            ser desfeito. Para só tirar do funil, marque como "Perdido".
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={deleting}>
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Excluir definitivamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
