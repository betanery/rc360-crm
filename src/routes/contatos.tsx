import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/layout/EmptyPage";

export const Route = createFileRoute("/contatos")({
  head: () => ({
    meta: [
      { title: "Contatos — RC360 CRM" },
      {
        name: "description",
        content: "Gerencie seus contatos e empresas no RC360 CRM.",
      },
      { property: "og:title", content: "Contatos — RC360 CRM" },
      {
        property: "og:description",
        content: "Gerencie seus contatos e empresas no RC360 CRM.",
      },
    ],
  }),
  component: ContatosPage,
});

function ContatosPage() {
  return (
    <EmptyPage
      title="Contatos"
      description="Sua base de contatos e empresas ficará aqui."
    />
  );
}
