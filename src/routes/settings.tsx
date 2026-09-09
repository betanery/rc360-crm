import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  CheckCircle2,
  Copy,
  KanbanSquare,
  Loader2,
  Mail,
  Plus,
  Save,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { products } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: ConfiguracoesPage });
const fieldClass = "h-9 rounded-md border bg-background px-2 text-sm";
const ROLES = ["commercial", "manager", "admin"] as const;
const roleLabel: Record<(typeof ROLES)[number], string> = {
  commercial: "Comercial",
  manager: "Gestor",
  admin: "Administrador",
};

interface ProfileRow {
  id: string;
  full_name: string;
  role: (typeof ROLES)[number];
}
interface TagRow {
  id: string;
  name: string;
  color: string | null;
}
interface StageRow {
  id: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

function ConfiguracoesPage() {
  const [phone, setPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const [emailTo, setEmailTo] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [emailTestMessage, setEmailTestMessage] = useState("");
  const [webhookCopied, setWebhookCopied] = useState(false);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [pendingRoles, setPendingRoles] = useState<Record<string, ProfileRow["role"]>>({});
  const [savingUsers, setSavingUsers] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [tags, setTags] = useState<TagRow[]>([]);
  const [newTag, setNewTag] = useState("");

  const [funnelStages, setFunnelStages] = useState<StageRow[]>([]);
  const [stagesAvailable, setStagesAvailable] = useState(true);
  const [newStage, setNewStage] = useState("");

  async function loadProfiles() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .order("full_name", { ascending: true });
    if (error) toast.error(error.message);
    else setProfiles((data ?? []) as ProfileRow[]);
  }

  async function loadTags() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("tags")
      .select("id,name,color")
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    else setTags((data ?? []) as TagRow[]);
  }

  async function loadStages() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("funnel_stages")
      .select("id,name,position,is_won,is_lost")
      .order("position", { ascending: true });
    if (error) {
      if (isMissingTable(error)) setStagesAvailable(false);
      else toast.error(error.message);
      return;
    }
    setFunnelStages((data ?? []) as StageRow[]);
  }

  useEffect(() => {
    void loadProfiles();
    void loadTags();
    void loadStages();
  }, []);

  async function testBotConversa() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setTestStatus("error");
      setTestMessage("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!supabase) {
      setTestStatus("error");
      setTestMessage("Supabase não está configurado no aplicativo.");
      return;
    }

    setTesting(true);
    setTestStatus("idle");
    setTestMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("crm-whatsapp-test", {
        body: { phone: digits, confirmed: true },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível concluir o teste.");

      setTestStatus("success");
      setTestMessage("Mensagem de teste enviada. Confira o WhatsApp informado.");
    } catch (error) {
      setTestStatus("error");
      setTestMessage(error instanceof Error ? error.message : "Falha ao testar o BotConversa.");
    } finally {
      setTesting(false);
    }
  }

  async function testEmail() {
    const address = emailTo.trim().toLowerCase();
    if (!address.includes("@")) {
      setEmailTestStatus("error");
      setEmailTestMessage("Informe um e-mail válido.");
      return;
    }
    if (!supabase) {
      setEmailTestStatus("error");
      setEmailTestMessage("Supabase não está configurado no aplicativo.");
      return;
    }

    setEmailTesting(true);
    setEmailTestStatus("idle");
    setEmailTestMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("crm-email-test", {
        body: { email: address, confirmed: true },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível concluir o teste.");

      setEmailTestStatus("success");
      setEmailTestMessage("E-mail de teste enviado. Confira a caixa de entrada informada.");
    } catch (error) {
      setEmailTestStatus("error");
      setEmailTestMessage(error instanceof Error ? error.message : "Falha ao testar o Resend.");
    } finally {
      setEmailTesting(false);
    }
  }

  function setRole(id: string, role: ProfileRow["role"]) {
    setPendingRoles((prev) => ({ ...prev, [id]: role }));
  }

  async function saveUsers() {
    if (!supabase || !Object.keys(pendingRoles).length) return;
    setSavingUsers(true);
    try {
      for (const [id, role] of Object.entries(pendingRoles)) {
        const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
        if (error) throw error;
      }
      toast.success("Alterações salvas.");
      setPendingRoles({});
      void loadProfiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSavingUsers(false);
    }
  }

  async function inviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const d = new FormData(event.currentTarget);
    const email = String(d.get("email")).trim();
    const fullName = String(d.get("full_name")).trim();
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-invite-user", {
        body: { email, full_name: fullName },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível enviar o convite.");
      toast.success(`Convite enviado para ${email}.`);
      setInviteOpen(false);
      void loadProfiles();
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível convidar o usuário.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function addTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = newTag.trim();
    if (!name) return;
    const { error } = await supabase.from("tags").insert({ name });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Essa tag já existe." : error.message);
      return;
    }
    setNewTag("");
    toast.success("Tag criada.");
    void loadTags();
  }

  async function deleteTag(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tag removida.");
    void loadTags();
  }

  async function addStage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = newStage.trim();
    if (!name) return;
    const wonStage = funnelStages.find((s) => s.is_won);
    const insertPosition = wonStage ? wonStage.position - 0.5 : funnelStages.length;
    const { error } = await supabase
      .from("funnel_stages")
      .insert({ name, position: insertPosition });
    if (error) {
      toast.error(
        error.message.includes("duplicate") ? "Já existe uma etapa com esse nome." : error.message,
      );
      return;
    }
    setNewStage("");
    toast.success("Etapa adicionada.");
    void loadStages();
  }

  async function deleteStage(stage: StageRow) {
    if (!supabase) return;
    if (stage.is_won || stage.is_lost) {
      toast.error("Não é possível remover as etapas de Ganho ou Perdido.");
      return;
    }
    const { error } = await supabase.from("funnel_stages").delete().eq("id", stage.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Etapa removida.");
    void loadStages();
  }

  const inboundWebhookUrl = "https://vvmsikxxoamwqjuihtjk.supabase.co/functions/v1/crm-inbound";

  function copyWebhookUrl() {
    void navigator.clipboard.writeText(inboundWebhookUrl).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Administração</p>
          <h2 className="text-3xl font-semibold">Configurações</h2>
          <p className="mt-1 text-muted-foreground">
            Integrações e parâmetros operacionais do RC360 CRM.
          </p>
        </div>
        {supabase && (
          <Button
            onClick={() => void saveUsers()}
            disabled={!Object.keys(pendingRoles).length || savingUsers}
          >
            {savingUsers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar alterações
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
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
              <Tags className="h-5 w-5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!supabase && (
              <p className="text-sm text-muted-foreground">
                Modo demonstração: conecte o Supabase para gerenciar tags.
              </p>
            )}
            {supabase && (
              <>
                <form onSubmit={addTag} className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Nova tag"
                  />
                  <Button type="submit" size="icon" aria-label="Adicionar tag">
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="gap-1 px-3 py-1">
                      {tag.name}
                      <button
                        onClick={() => void deleteTag(tag.id)}
                        aria-label={`Remover tag ${tag.name}`}
                        className="ml-1 rounded-full hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {!tags.length && (
                    <span className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KanbanSquare className="h-5 w-5" />
            Funis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!supabase && (
            <p className="text-sm text-muted-foreground">
              Modo demonstração: conecte o Supabase para gerenciar as etapas do funil.
            </p>
          )}
          {supabase && !stagesAvailable && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Recurso pendente: aplique a migration 003_dynamic_stages.sql no Supabase para
              personalizar as etapas do funil.
            </p>
          )}
          {supabase && stagesAvailable && (
            <>
              <form onSubmit={addStage} className="flex gap-2">
                <Input
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  placeholder="Nova etapa"
                />
                <Button type="submit" size="icon" aria-label="Adicionar etapa">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
              <div className="space-y-2">
                {funnelStages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span>{stage.name}</span>
                    <div className="flex items-center gap-2">
                      {stage.is_won && <Badge>Ganho</Badge>}
                      {stage.is_lost && <Badge variant="destructive">Perdido</Badge>}
                      {!stage.is_won && !stage.is_lost && (
                        <button
                          onClick={() => void deleteStage(stage)}
                          aria-label={`Remover etapa ${stage.name}`}
                          className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários
          </CardTitle>
          {supabase && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-3.5 w-3.5" /> Convidar usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar usuário</DialogTitle>
                  <DialogDescription>
                    Enviamos um e-mail de convite para o novo usuário definir a senha e entrar no
                    RC360 CRM.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={inviteUser} className="grid gap-3">
                  <Input name="full_name" placeholder="Nome completo" />
                  <Input name="email" type="email" placeholder="E-mail *" required />
                  <Button disabled={inviting}>
                    {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enviar convite
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!supabase && (
            <p className="text-sm text-muted-foreground">
              Modo demonstração: conecte o Supabase para gerenciar usuários.
            </p>
          )}
          {supabase &&
            profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span>{profile.full_name || "Sem nome"}</span>
                <select
                  className={fieldClass}
                  value={pendingRoles[profile.id] ?? profile.role}
                  onChange={(e) => setRole(profile.id, e.target.value as ProfileRow["role"])}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel[role]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          {supabase && !profiles.length && (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">BotConversa</p>
                    <Badge variant={testStatus === "success" ? "default" : "secondary"}>
                      {testStatus === "success" ? "Conectado e testado" : "Configurado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp, qualificação e recuperação.
                  </p>
                  <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                    O teste envia uma mensagem fixa para um contato que já exista no BotConversa. O
                    disparo normal do CRM continua respeitando opt-in.
                  </p>
                </div>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="WhatsApp com DDD"
                    inputMode="tel"
                    aria-label="Número de WhatsApp para teste"
                  />
                  <Button onClick={testBotConversa} disabled={testing || !phone.trim()}>
                    {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Testar WhatsApp
                  </Button>
                </div>
                {testMessage ? (
                  <p
                    className={`flex items-center gap-1 text-xs ${testStatus === "success" ? "text-emerald-700" : "text-destructive"}`}
                  >
                    {testStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {testMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">E-mail (Resend)</p>
                    <Badge variant={emailTestStatus === "success" ? "default" : "secondary"}>
                      {emailTestStatus === "success" ? "Conectado e testado" : "Configurado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Confirmações e propostas por e-mail.
                  </p>
                  <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                    Requer a variável <code>RESEND_API_KEY</code> configurada nos Secrets do projeto
                    no Supabase (Project Settings → Edge Functions).
                  </p>
                </div>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={emailTo}
                    onChange={(event) => setEmailTo(event.target.value)}
                    placeholder="E-mail para teste"
                    type="email"
                    aria-label="E-mail para teste"
                  />
                  <Button onClick={testEmail} disabled={emailTesting || !emailTo.trim()}>
                    {emailTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Testar e-mail
                  </Button>
                </div>
                {emailTestMessage ? (
                  <p
                    className={`flex items-center gap-1 text-xs ${emailTestStatus === "success" ? "text-emerald-700" : "text-destructive"}`}
                  >
                    {emailTestStatus === "success" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : null}
                    {emailTestMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">Kiwify</p>
                  <Badge variant="outline">Configuração manual</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pagamentos e recuperação de carrinho.
                </p>
                <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
                  No painel da Kiwify, cadastre um webhook apontando para a URL abaixo com o header{" "}
                  <code>x-crm-webhook-secret</code> igual ao valor de{" "}
                  <code>CRM_WEBHOOK_SECRET</code> configurado nos Secrets do Supabase.
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <code className="flex-1 truncate text-xs">{inboundWebhookUrl}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={copyWebhookUrl}
                    aria-label="Copiar URL do webhook"
                  >
                    {webhookCopied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
