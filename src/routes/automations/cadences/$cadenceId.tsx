import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CadenceBuilder } from "@/components/automations/CadenceBuilder";

export const Route = createFileRoute("/automations/cadences/$cadenceId")({
  component: EditarCadenciaPage,
});

function EditarCadenciaPage() {
  const { cadenceId } = Route.useParams();
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/automations"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para Automações
        </Link>
        <h2 className="mt-2 text-3xl font-semibold">Editar cadência</h2>
      </div>
      <CadenceBuilder cadenceId={cadenceId} />
    </div>
  );
}
