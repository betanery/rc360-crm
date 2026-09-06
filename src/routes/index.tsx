import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/layout/EmptyPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — RC360 CRM" },
      {
        name: "description",
        content: "Visão geral do seu relacionamento com clientes no RC360 CRM.",
      },
      { property: "og:title", content: "Dashboard — RC360 CRM" },
      {
        property: "og:description",
        content: "Visão geral do seu relacionamento com clientes no RC360 CRM.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <EmptyPage
      title="Dashboard"
      description="A visão geral dos seus indicadores comerciais ficará aqui."
    />
  );
}
