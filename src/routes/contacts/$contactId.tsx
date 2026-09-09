import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Instagram,
  Linkedin,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  money,
  products as staticProducts,
  shortDate,
  useCRM,
  type Product,
  type Task,
} from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { CompanyField } from "@/components/contacts/CompanyField";
import { TagManager } from "@/components/contacts/TagManager";
import { toast } from "sonner";

export const Route = createFileRoute("/contacts/$contactId")({ component: ContatoDetalhePage });
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const TASK_TYPES: Task["type"][] = ["Call", "Ligação", "WhatsApp", "E-mail", "Follow-up"];

function ContatoDetalhePage() {
  const { contactId } = Route.useParams();
  const { contacts, opportunities, tasks, carts, updateContact, addTask } = useCRM();
  const contact = contacts.find((c) => c.id === contactId);
  const [open, setOpen] = useState(false);
  const [activeProducts, setActiveProducts] = useState<string[]>(staticProducts);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("products")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data?.length) setActiveProducts(data.map((p) => p.name));
      });
    supabase
      .from("companies")
      .select("id,name")
      .then(({ data, error }) => {
        if (!error && data) setCompanies(data as { id: string; name: string }[]);
      });
  }, []);

  if (!contact) {
    return (
      <div className="space-y-4">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Voltar para contatos
        </Link>
        <p className="text-muted-foreground">Contato não encontrado.</p>
      </div>
    );
  }

  const contactOpportunities = opportunities.filter((o) => o.contactId === contactId);
  const contactTasks = tasks.filter((t) => t.contactId === contactId);
  const contactCarts = carts.filter((c) => c.contactId === contactId);
  const linkedCompany = companies.find((c) => c.name === contact.company);
  const searchTerm = encodeURIComponent([contact.name, contact.company].filter(Boolean).join(" "));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    try {
      await updateContact(contactId, {
        name: String(d.get("name")),
        company: String(d.get("company")),
        phone: String(d.get("phone")),
        email: String(d.get("email")),
        product: String(d.get("product")) as Product,
        source: String(d.get("source")),
        campaign: String(d.get("campaign")),
        owner: String(d.get("owner")),
        notes: String(d.get("notes")),
      });
      setOpen(false);
      toast.success("Contato atualizado.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível atualizar o contato.",
      );
    }
  }

  async function saveNotes() {
    try {
      await updateContact(contactId, {
        name: contact!.name,
        company: contact!.company,
        phone: contact!.phone,
        email: contact!.email,
        product: contact!.product,
        source: contact!.source,
        campaign: contact!.campaign,
        owner: contact!.owner,
        notes: notesDraft,
      });
      setEditingNotes(false);
      toast.success("Observações salvas.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível salvar as observações.",
      );
    }
  }

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget);
    const dueDate = String(d.get("dueDate"));
    const dueTime = String(d.get("dueTime")) || "09:00";
    try {
      await addTask({
        contactId,
        title: String(d.get("title")),
        type: String(d.get("type")) as Task["type"],
        dueAt: new Date(`${dueDate}T${dueTime}`).toISOString(),
      });
      setTaskOpen(false);
      toast.success("Tarefa criada.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível criar a tarefa.");
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowLeft className="h-4 w-4" /> Voltar para contatos
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {contact.company ? (
            linkedCompany ? (
              <Link
                to="/companies/$companyId"
                params={{ companyId: linkedCompany.id }}
                className="text-sm font-medium text-accent hover:underline"
              >
                {contact.company}
              </Link>
            ) : (
              <p className="text-sm font-medium text-accent">{contact.company}</p>
            )
          ) : (
            <p className="text-sm font-medium text-accent">Sem empresa</p>
          )}
          <h2 className="text-3xl font-semibold">{contact.name}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </span>
            {contact.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{contact.product}</Badge>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.google.com/search?q=${searchTerm}`}
              target="_blank"
              rel="noreferrer"
            >
              <Search className="h-3.5 w-3.5" /> Google
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.linkedin.com/search/results/all/?keywords=${searchTerm}`}
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://www.instagram.com/explore/search/keyword/?q=${searchTerm}`}
              target="_blank"
              rel="noreferrer"
            >
              <Instagram className="h-3.5 w-3.5" /> Instagram
            </a>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar contato</DialogTitle>
                <DialogDescription>Atualize os dados cadastrados deste contato.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <Input name="name" placeholder="Nome *" defaultValue={contact.name} required />
                <CompanyField defaultValue={contact.company} />
                <Input
                  name="phone"
                  placeholder="WhatsApp *"
                  defaultValue={contact.phone}
                  required
                />
                <Input
                  name="email"
                  type="email"
                  placeholder="E-mail"
                  defaultValue={contact.email}
                />
                <select name="product" className={fieldClass} defaultValue={contact.product}>
                  {activeProducts.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <Input name="source" placeholder="Origem" defaultValue={contact.source} />
                <Input
                  name="campaign"
                  placeholder="Campanha ou evento"
                  defaultValue={contact.campaign}
                />
                <Input name="owner" placeholder="Responsável" defaultValue={contact.owner} />
                <textarea
                  name="notes"
                  placeholder="Observações"
                  defaultValue={contact.notes}
                  className="min-h-20 rounded-md border bg-background p-3 text-sm sm:col-span-2"
                />
                <Button className="sm:col-span-2">Salvar alterações</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Origem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Canal:</span> {contact.source || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Campanha:</span> {contact.campaign || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Responsável:</span> {contact.owner || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Cadastrado em:</span>{" "}
              {shortDate(contact.createdAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TagManager contactId={contactId} tags={contact.tags} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Observações</CardTitle>
            {supabase && !editingNotes && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setNotesDraft(contact.notes ?? "");
                  setEditingNotes(true);
                }}
                aria-label="Editar observações"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void saveNotes()}>
                    <Save className="h-3.5 w-3.5" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{contact.notes || "Sem observações."}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades ({contactOpportunities.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactOpportunities.length ? (
            contactOpportunities.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{o.nextAction}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(o.nextActionAt)}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{o.stage}</Badge>
                  <p className="mt-1 text-sm font-semibold">{money.format(o.value)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade registrada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tarefas ({contactTasks.length})</CardTitle>
          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> Nova tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova tarefa</DialogTitle>
                <DialogDescription>Associada a {contact.name}.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitTask} className="grid gap-3">
                <Input name="title" placeholder="Título da tarefa *" required />
                <div className="grid grid-cols-2 gap-3">
                  <select name="type" className={fieldClass}>
                    {TASK_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <Input name="dueDate" type="date" required />
                </div>
                <Input name="dueTime" type="time" defaultValue="09:00" />
                <Button>Salvar tarefa</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {contactTasks.length ? (
            contactTasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <p className="font-medium">{t.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.type}</Badge>
                  <Badge variant={t.status === "Concluída" ? "default" : "secondary"}>
                    {t.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{shortDate(t.dueAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa registrada.</p>
          )}
        </CardContent>
      </Card>

      {contactCarts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Carrinhos ({contactCarts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactCarts.map((cart) => (
              <div
                key={cart.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div>
                  <p className="font-medium">{cart.product}</p>
                  <p className="text-xs text-muted-foreground">{cart.reason}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{cart.status}</Badge>
                  <p className="mt-1 text-sm font-semibold">{money.format(cart.value)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
