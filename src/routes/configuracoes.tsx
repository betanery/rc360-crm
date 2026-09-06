import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/layout/EmptyPage";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — RC360 CRM" },
      {
        name: "description",
        content: "Ajustes da conta e preferências do RC360 CRM.",
      },
      { property: "og:title", content: "Configurações — RC360 CRM" },
      {
        property: "og:description",
        content: "Ajustes da conta e preferências do RC360 CRM.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  return (
    <EmptyPage
      title="Configurações"
      description="As preferências e ajustes da conta ficarão aqui."
    />
  );
}
