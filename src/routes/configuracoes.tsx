import { createFileRoute } from "@tanstack/react-router";
import { Bot, Mail, ShoppingBag, Tags, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { products } from "@/lib/crm-data";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });
function ConfiguracoesPage() {
  const integrations = [
    ["BotConversa", "WhatsApp e qualificação", Bot],
    ["E-mail", "Confirmações e propostas", Mail],
    ["Kiwify", "Pagamentos e carrinhos", ShoppingBag],
  ] as const;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Administração</p>
        <h2 className="text-3xl font-semibold">Configurações</h2>
        <p className="mt-1 text-muted-foreground">
          Estrutura preparada; integrações serão ativadas após o núcleo.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {products.map((p) => (
              <Badge key={p} variant="secondary" className="px-3 py-1">
                {p}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between rounded-lg border p-3">
              <span>Roberta</span>
              <Badge>Administradora</Badge>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <span>Cinthia</span>
              <Badge variant="outline">Comercial</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrações previstas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {integrations.map(([name, description, Icon]) => (
            <div key={name} className="rounded-xl border p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
              <Badge className="mt-3" variant="outline">
                Não conectado
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
