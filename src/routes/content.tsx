import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BroadcastTab } from "@/components/content/BroadcastTab";
import { CadencesPanel } from "@/components/automations/CadencesPanel";

export const Route = createFileRoute("/content")({ component: ConteudosPage });

function ConteudosPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-accent">Relacionamento</p>
        <h2 className="text-3xl font-semibold">Conteúdos</h2>
        <p className="mt-1 text-muted-foreground">
          Aquecimento e pontos de contato por e-mail: envie um conteúdo agora ou monte uma sequência
          que roda sozinha.
        </p>
      </div>

      <Tabs defaultValue="avulso">
        <TabsList>
          <TabsTrigger value="avulso">Envio avulso</TabsTrigger>
          <TabsTrigger value="sequencias">Sequências</TabsTrigger>
        </TabsList>
        <TabsContent value="avulso" className="space-y-4">
          <BroadcastTab />
        </TabsContent>
        <TabsContent value="sequencias" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sequências são séries de mensagens com intervalo de dias. Use passos de e-mail para
            entregar conteúdo aos poucos.
          </p>
          <CadencesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
