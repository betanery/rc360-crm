import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Product = "Rotas do Lucro" | "Fastrack" | "Consultoria 4X";
export type Stage =
  "Novo lead" | "Em qualificação" | "Call agendada" | "Proposta enviada" | "Ganho" | "Perdido";
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
  notes?: string;
}

export interface Opportunity {
  id: string;
  contactId: string;
  stage: Stage;
  value: number;
  nextAction: string;
  nextActionAt: string;
  lostReason?: string;
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

const initialContacts: Contact[] = [
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

const initialOpportunities: Opportunity[] = [
  {
    id: "o1",
    contactId: "c1",
    stage: "Call agendada",
    value: 20000,
    nextAction: "Realizar call de diagnóstico",
    nextActionAt: iso(1, 14),
  },
  {
    id: "o2",
    contactId: "c2",
    stage: "Em qualificação",
    value: 997,
    nextAction: "Confirmar faturamento e urgência",
    nextActionAt: iso(0, 16),
  },
  {
    id: "o3",
    contactId: "c4",
    stage: "Proposta enviada",
    value: 30000,
    nextAction: "Follow-up da proposta",
    nextActionAt: iso(-1, 11),
  },
  {
    id: "o4",
    contactId: "c5",
    stage: "Perdido",
    value: 997,
    nextAction: "Retomar em 30 dias",
    nextActionAt: iso(30),
    lostReason: "Sem retorno",
  },
];

const initialTasks: Task[] = [
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

const initialCarts: CartRecovery[] = [
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
  addContact: (contact: Omit<Contact, "id" | "createdAt" | "tags">) => void;
  moveOpportunity: (id: string, stage: Stage) => void;
  toggleTask: (id: string) => void;
  updateCart: (id: string, status: CartRecovery["status"]) => void;
}

const CRMContext = createContext<CRMContextValue | null>(null);
const STORAGE_KEY = "rc360-crm-v1";

export function CRMProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [tasks, setTasks] = useState(initialTasks);
  const [carts, setCarts] = useState(initialCarts);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setContacts(data.contacts ?? initialContacts);
      setOpportunities(data.opportunities ?? initialOpportunities);
      setTasks(data.tasks ?? initialTasks);
      setCarts(data.carts ?? initialCarts);
    } catch {
      /* mantém os dados de demonstração */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contacts, opportunities, tasks, carts }));
  }, [contacts, opportunities, tasks, carts]);

  const value = useMemo<CRMContextValue>(
    () => ({
      contacts,
      opportunities,
      tasks,
      carts,
      addContact: (contact) =>
        setContacts((items) => [
          ...items,
          { ...contact, id: crypto.randomUUID(), tags: [], createdAt: new Date().toISOString() },
        ]),
      moveOpportunity: (id, stage) =>
        setOpportunities((items) =>
          items.map((item) => (item.id === id ? { ...item, stage } : item)),
        ),
      toggleTask: (id) =>
        setTasks((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, status: item.status === "Pendente" ? "Concluída" : "Pendente" }
              : item,
          ),
        ),
      updateCart: (id, status) =>
        setCarts((items) =>
          items.map((item) =>
            item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
          ),
        ),
    }),
    [contacts, opportunities, tasks, carts],
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
