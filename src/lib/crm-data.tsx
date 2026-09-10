import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";

export type Product = "Rotas do Lucro" | "Fastrack" | "Consultoria 4X";
/**
 * Nome livre da etapa do pipeline. Os 6 nomes em `stages` abaixo são o
 * conjunto padrão (usado em modo demo e como seed no banco); depois que a
 * migration 003_dynamic_stages.sql é aplicada, etapas extras cadastradas em
 * `funnel_stages` também são válidas. "Ganho" e "Perdido" continuam
 * carregando regra de negócio especial por convenção de nome.
 */
export type Stage = string;
export type TaskStatus = "Pendente" | "Concluída";

export interface Contact {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  product: Product;
  source: string;
  campaign: string;
  owner: string;
  tags: string[];
  createdAt: string;
  notes?: string | undefined;
}
export interface Opportunity {
  id: string;
  contactId: string;
  product: string;
  stage: Stage;
  value: number;
  nextAction: string;
  nextActionAt: string;
  lostReason?: string | undefined;
}
export interface Task {
  id: string;
  contactId: string;
  title: string;
  dueAt: string;
  type: "Call" | "Ligação" | "WhatsApp" | "E-mail" | "Follow-up";
  status: TaskStatus;
}
export interface CartRecovery {
  id: string;
  contactId: string;
  product: Product;
  reason: string;
  value: number;
  status: "Em recuperação" | "Recuperado" | "Encerrado";
  updatedAt: string;
}

const today = new Date();
const iso = (days: number, hour = 10) => {
  const value = new Date(today);
  value.setDate(value.getDate() + days);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
};

const demoContacts: Contact[] = [
  {
    id: "c1",
    name: "Priscila Braga",
    company: "PBW",
    phone: "(61) 99911-2233",
    email: "priscila@pbw.com.br",
    product: "Consultoria 4X",
    source: "Indicação",
    campaign: "Diagnóstico 4X",
    owner: "Roberta",
    tags: ["Qualificada"],
    createdAt: iso(-8),
  },
  {
    id: "c2",
    name: "Mariana Lopes",
    company: "ML Arquitetura",
    phone: "(61) 98822-3344",
    email: "mariana@mlarq.com.br",
    product: "Fastrack",
    source: "Instagram",
    campaign: "Conteúdo orgânico",
    owner: "Cinthia",
    tags: ["Pediu call"],
    createdAt: iso(-4),
  },
  {
    id: "c3",
    name: "Carlos Nunes",
    company: "Nunes Serviços",
    phone: "(62) 97733-4455",
    email: "carlos@nunes.com.br",
    product: "Rotas do Lucro",
    source: "Anúncio",
    campaign: "Rota do Lucro",
    owner: "Roberta",
    tags: ["Lead Rotas"],
    createdAt: iso(-2),
  },
  {
    id: "c4",
    name: "Fernanda Reis",
    company: "FR Clínica",
    phone: "(61) 96644-5566",
    email: "fernanda@frclinica.com.br",
    product: "Consultoria 4X",
    source: "Evento",
    campaign: "Seja Startup",
    owner: "Roberta",
    tags: ["Participou", "Proposta sem retorno"],
    createdAt: iso(-12),
  },
  {
    id: "c5",
    name: "Eduardo Melo",
    company: "Melo Contábil",
    phone: "(61) 95555-6677",
    email: "eduardo@melo.com.br",
    product: "Fastrack",
    source: "Redes",
    campaign: "Fastrack Setembro",
    owner: "Cinthia",
    tags: ["Não respondeu"],
    createdAt: iso(-6),
  },
];
const demoOpportunities: Opportunity[] = [
  {
    id: "o1",
    contactId: "c1",
    product: "Consultoria 4X",
    stage: "Call agendada",
    value: 20000,
    nextAction: "Realizar call de diagnóstico",
    nextActionAt: iso(1, 14),
  },
  {
    id: "o2",
    contactId: "c2",
    product: "Fastrack",
    stage: "Em qualificação",
    value: 997,
    nextAction: "Confirmar faturamento e urgência",
    nextActionAt: iso(0, 16),
  },
  {
    id: "o3",
    contactId: "c4",
    product: "Consultoria 4X",
    stage: "Proposta enviada",
    value: 30000,
    nextAction: "Follow-up da proposta",
    nextActionAt: iso(-1, 11),
  },
  {
    id: "o4",
    contactId: "c5",
    product: "Fastrack",
    stage: "Perdido",
    value: 997,
    nextAction: "Retomar em 30 dias",
    nextActionAt: iso(30),
    lostReason: "Sem retorno",
  },
];
const demoTasks: Task[] = [
  {
    id: "t1",
    contactId: "c1",
    title: "Call de diagnóstico",
    dueAt: iso(1, 14),
    type: "Call",
    status: "Pendente",
  },
  {
    id: "t2",
    contactId: "c2",
    title: "Qualificar lead do Fastrack",
    dueAt: iso(0, 16),
    type: "WhatsApp",
    status: "Pendente",
  },
  {
    id: "t3",
    contactId: "c4",
    title: "Retomar proposta",
    dueAt: iso(-1, 11),
    type: "Follow-up",
    status: "Pendente",
  },
];
const demoCarts: CartRecovery[] = [
  {
    id: "r1",
    contactId: "c3",
    product: "Rotas do Lucro",
    reason: "Pix expirado",
    value: 97,
    status: "Em recuperação",
    updatedAt: iso(-1),
  },
];

interface CRMContextValue {
  contacts: Contact[];
  opportunities: Opportunity[];
  tasks: Task[];
  carts: CartRecovery[];
  addContact: (contact: Omit<Contact, "id" | "createdAt" | "tags">) => Promise<void>;
  updateContact: (id: string, contact: Omit<Contact, "id" | "createdAt" | "tags">) => Promise<void>;
  addContactTag: (contactId: string, tagName: string) => Promise<void>;
  removeContactTag: (contactId: string, tagName: string) => Promise<void>;
  addOpportunity: (
    opportunity: Omit<Opportunity, "id" | "stage" | "lostReason"> & { stage?: Stage },
  ) => Promise<void>;
  moveOpportunity: (id: string, stage: Stage, lostReason?: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  addTask: (task: Omit<Task, "id" | "status">) => Promise<void>;
  updateCart: (id: string, status: CartRecovery["status"]) => Promise<void>;
  refresh: () => Promise<void>;
}

const CRMContext = createContext<CRMContextValue | null>(null);
const STORAGE_KEY = "rc360-crm-v2-demo";
type ContactRelation = { tags: { name: string } | { name: string }[] | null };
type ContactRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  product: Product;
  source: string | null;
  campaign: string | null;
  owner_name: string | null;
  notes: string | null;
  created_at: string;
  contact_tags?: ContactRelation[] | null;
};

function mapContact(row: ContactRow): Contact {
  const tags = (row.contact_tags ?? []).flatMap((relation) => {
    if (!relation.tags) return [];
    return Array.isArray(relation.tags)
      ? relation.tags.map((tag) => tag.name)
      : [relation.tags.name];
  });
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? "",
    phone: row.phone,
    email: row.email ?? "",
    product: row.product,
    source: row.source ?? "",
    campaign: row.campaign ?? "",
    owner: row.owner_name ?? "",
    tags,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

async function ensureCompany(name: string) {
  const trimmed = name.trim();
  if (!trimmed || !supabase) return;
  await supabase
    .from("companies")
    .upsert({ name: trimmed }, { onConflict: "organization_id,name", ignoreDuplicates: true });
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(isSupabaseConfigured ? [] : demoContacts);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    isSupabaseConfigured ? [] : demoOpportunities,
  );
  const [tasks, setTasks] = useState<Task[]>(isSupabaseConfigured ? [] : demoTasks);
  const [carts, setCarts] = useState<CartRecovery[]>(isSupabaseConfigured ? [] : demoCarts);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  async function refresh() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const [contactsResult, opportunitiesResult, tasksResult, cartsResult] = await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id,name,company,phone,email,product,source,campaign,owner_name,notes,created_at,contact_tags(tags(name))",
        )
        .order("created_at", { ascending: false }),
      supabase.from("opportunities").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("due_at", { ascending: true }),
      supabase.from("cart_recoveries").select("*").order("updated_at", { ascending: false }),
    ]);
    const firstError =
      contactsResult.error ?? opportunitiesResult.error ?? tasksResult.error ?? cartsResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setContacts(((contactsResult.data ?? []) as unknown as ContactRow[]).map(mapContact));
    setOpportunities(
      (opportunitiesResult.data ?? []).map((row) => ({
        id: row.id,
        contactId: row.contact_id,
        product: row.product,
        stage: row.stage as Stage,
        value: Number(row.value),
        nextAction: row.next_action,
        nextActionAt: row.next_action_at,
        lostReason: row.lost_reason ?? undefined,
      })),
    );
    setTasks(
      (tasksResult.data ?? []).map((row) => ({
        id: row.id,
        contactId: row.contact_id,
        title: row.title,
        dueAt: row.due_at,
        type: row.type as Task["type"],
        status: row.status as TaskStatus,
      })),
    );
    setCarts(
      (cartsResult.data ?? []).map((row) => ({
        id: row.id,
        contactId: row.contact_id,
        product: row.product as Product,
        reason: row.reason,
        value: Number(row.value),
        status: row.status as CartRecovery["status"],
        updatedAt: row.updated_at,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (supabase) {
      void refresh();
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setContacts(data.contacts ?? demoContacts);
      setOpportunities(data.opportunities ?? demoOpportunities);
      setTasks(data.tasks ?? demoTasks);
      setCarts(data.carts ?? demoCarts);
    } catch {
      // Mantém os dados de demonstração se o cache local estiver inválido.
    }
  }, []);

  useEffect(() => {
    if (!supabase)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ contacts, opportunities, tasks, carts }));
  }, [contacts, opportunities, tasks, carts]);

  const value = useMemo<CRMContextValue>(
    () => ({
      contacts,
      opportunities,
      tasks,
      carts,
      refresh,
      addContact: async (contact) => {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        const duplicate = contacts.some(
          (item) =>
            (normalizedPhone && item.phone.replace(/\D/g, "") === normalizedPhone) ||
            (contact.email && item.email.toLowerCase() === contact.email.toLowerCase()),
        );
        if (duplicate) throw new Error("Já existe um contato com este WhatsApp ou e-mail.");
        if (!supabase) {
          setContacts((items) => [
            ...items,
            { ...contact, id: crypto.randomUUID(), tags: [], createdAt: new Date().toISOString() },
          ]);
          return;
        }
        await ensureCompany(contact.company);
        const { data, error: insertError } = await supabase
          .from("contacts")
          .insert({
            name: contact.name,
            company: contact.company || null,
            phone: contact.phone,
            email: contact.email || null,
            product: contact.product,
            source: contact.source || null,
            campaign: contact.campaign || null,
            owner_name: contact.owner || null,
            notes: contact.notes || null,
          })
          .select("id,name,company,phone,email,product,source,campaign,owner_name,notes,created_at")
          .single();
        if (insertError) throw insertError;
        setContacts((items) => [mapContact(data as ContactRow), ...items]);
      },
      updateContact: async (id, contact) => {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        const duplicate = contacts.some(
          (item) =>
            item.id !== id &&
            ((normalizedPhone && item.phone.replace(/\D/g, "") === normalizedPhone) ||
              (contact.email && item.email.toLowerCase() === contact.email.toLowerCase())),
        );
        if (duplicate) throw new Error("Já existe outro contato com este WhatsApp ou e-mail.");
        if (!supabase) {
          setContacts((items) =>
            items.map((item) => (item.id === id ? { ...item, ...contact } : item)),
          );
          return;
        }
        await ensureCompany(contact.company);
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            name: contact.name,
            company: contact.company || null,
            phone: contact.phone,
            email: contact.email || null,
            product: contact.product,
            source: contact.source || null,
            campaign: contact.campaign || null,
            owner_name: contact.owner || null,
            notes: contact.notes || null,
          })
          .eq("id", id);
        if (updateError) throw updateError;
        setContacts((items) =>
          items.map((item) => (item.id === id ? { ...item, ...contact } : item)),
        );
      },
      addContactTag: async (contactId, tagName) => {
        const trimmed = tagName.trim();
        if (!trimmed) return;
        if (!supabase) {
          setContacts((items) =>
            items.map((item) =>
              item.id === contactId && !item.tags.includes(trimmed)
                ? { ...item, tags: [...item.tags, trimmed] }
                : item,
            ),
          );
          return;
        }
        const { data: tag, error: tagError } = await supabase
          .from("tags")
          .upsert({ name: trimmed }, { onConflict: "organization_id,name" })
          .select("id")
          .single();
        if (tagError) throw tagError;
        const { error: linkError } = await supabase
          .from("contact_tags")
          .upsert(
            { contact_id: contactId, tag_id: tag.id },
            { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
          );
        if (linkError) throw linkError;
        setContacts((items) =>
          items.map((item) =>
            item.id === contactId && !item.tags.includes(trimmed)
              ? { ...item, tags: [...item.tags, trimmed] }
              : item,
          ),
        );
      },
      removeContactTag: async (contactId, tagName) => {
        if (!supabase) {
          setContacts((items) =>
            items.map((item) =>
              item.id === contactId
                ? { ...item, tags: item.tags.filter((t) => t !== tagName) }
                : item,
            ),
          );
          return;
        }
        const { data: tag } = await supabase
          .from("tags")
          .select("id")
          .eq("name", tagName)
          .maybeSingle();
        if (tag) {
          const { error: deleteError } = await supabase
            .from("contact_tags")
            .delete()
            .eq("contact_id", contactId)
            .eq("tag_id", tag.id);
          if (deleteError) throw deleteError;
        }
        setContacts((items) =>
          items.map((item) =>
            item.id === contactId
              ? { ...item, tags: item.tags.filter((t) => t !== tagName) }
              : item,
          ),
        );
      },
      addOpportunity: async (opportunity) => {
        const stage = opportunity.stage ?? "Novo lead";
        if (!supabase) {
          setOpportunities((items) => [
            ...items,
            { ...opportunity, id: crypto.randomUUID(), stage },
          ]);
          return;
        }
        const { data, error: insertError } = await supabase
          .from("opportunities")
          .insert({
            contact_id: opportunity.contactId,
            product: opportunity.product,
            stage,
            value: opportunity.value,
            next_action: opportunity.nextAction,
            next_action_at: opportunity.nextActionAt,
          })
          .select("id,contact_id,product,stage,value,next_action,next_action_at,lost_reason")
          .single();
        if (insertError) throw insertError;
        setOpportunities((items) => [
          {
            id: data.id,
            contactId: data.contact_id,
            product: data.product,
            stage: data.stage as Stage,
            value: Number(data.value),
            nextAction: data.next_action,
            nextActionAt: data.next_action_at,
            lostReason: data.lost_reason ?? undefined,
          },
          ...items,
        ]);
      },
      moveOpportunity: async (id, stage, lostReason) => {
        const current = opportunities.find((item) => item.id === id);
        if (!current) return;
        if (stage === "Perdido" && !lostReason && !current.lostReason)
          throw new Error("Informe o motivo da perda.");
        if (stage === "Ganho" && current.value <= 0)
          throw new Error("Informe o valor antes de marcar como ganho.");
        if (supabase) {
          const { error: updateError } = await supabase
            .from("opportunities")
            .update({
              stage,
              lost_reason: stage === "Perdido" ? (lostReason ?? current.lostReason) : null,
            })
            .eq("id", id);
          if (updateError) throw updateError;
        }
        setOpportunities((items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  stage,
                  lostReason: stage === "Perdido" ? (lostReason ?? item.lostReason) : undefined,
                }
              : item,
          ),
        );
      },
      toggleTask: async (id) => {
        const current = tasks.find((item) => item.id === id);
        if (!current) return;
        const status: TaskStatus = current.status === "Pendente" ? "Concluída" : "Pendente";
        if (supabase) {
          const { error: updateError } = await supabase
            .from("tasks")
            .update({ status })
            .eq("id", id);
          if (updateError) throw updateError;
        }
        setTasks((items) => items.map((item) => (item.id === id ? { ...item, status } : item)));
      },
      addTask: async (task) => {
        if (!supabase) {
          setTasks((items) => [...items, { ...task, id: crypto.randomUUID(), status: "Pendente" }]);
          return;
        }
        const { data, error: insertError } = await supabase
          .from("tasks")
          .insert({
            contact_id: task.contactId,
            title: task.title,
            due_at: task.dueAt,
            type: task.type,
          })
          .select("id,contact_id,title,due_at,type,status")
          .single();
        if (insertError) throw insertError;
        setTasks((items) => [
          {
            id: data.id,
            contactId: data.contact_id,
            title: data.title,
            dueAt: data.due_at,
            type: data.type as Task["type"],
            status: data.status as TaskStatus,
          },
          ...items,
        ]);
      },
      updateCart: async (id, status) => {
        const updatedAt = new Date().toISOString();
        if (supabase) {
          const { error: updateError } = await supabase
            .from("cart_recoveries")
            .update({ status, updated_at: updatedAt })
            .eq("id", id);
          if (updateError) throw updateError;
        }
        setCarts((items) =>
          items.map((item) => (item.id === id ? { ...item, status, updatedAt } : item)),
        );
      },
    }),
    [contacts, opportunities, tasks, carts],
  );

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando dados do CRM…
      </div>
    );
  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border bg-card p-6 text-center">
          <h2 className="text-xl font-semibold">Não foi possível carregar o CRM</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => void refresh()}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export function useCRM() {
  const value = useContext(CRMContext);
  if (!value) throw new Error("useCRM deve ser usado dentro de CRMProvider");
  return value;
}

export const stages: Stage[] = [
  "Novo lead",
  "Em qualificação",
  "Call agendada",
  "Proposta enviada",
  "Ganho",
  "Perdido",
];
export const products: Product[] = ["Rotas do Lucro", "Fastrack", "Consultoria 4X"];
export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const shortDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
