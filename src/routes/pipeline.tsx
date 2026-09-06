import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/layout/EmptyPage";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — RC360 CRM" },
      {
        name: "description",
        content: "Acompanhe suas oportunidades de venda no pipeline do RC360 CRM.",
      },
      { property: "og:title", content: "Pipeline — RC360 CRM" },
      {
        property: "og:description",
        content: "Acompanhe suas oportunidades de venda no pipeline do RC360 CRM.",
      },
    ],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <EmptyPage
      title="Pipeline"
      description="O funil de oportunidades de venda ficará aqui."
    />
  );
}
