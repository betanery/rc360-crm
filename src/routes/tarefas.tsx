import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/layout/EmptyPage";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — RC360 CRM" },
      {
        name: "description",
        content: "Organize suas tarefas e follow-ups no RC360 CRM.",
      },
      { property: "og:title", content: "Tarefas — RC360 CRM" },
      {
        property: "og:description",
        content: "Organize suas tarefas e follow-ups no RC360 CRM.",
      },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  return (
    <EmptyPage
      title="Tarefas"
      description="Sua lista de tarefas e follow-ups ficará aqui."
    />
  );
}
