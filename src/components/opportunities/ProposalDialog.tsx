import { useEffect, useState } from "react";
import { Download, Eye, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import {
  buildProposalPdf,
  formatMoney,
  type ProposalContent,
  type ProposalTemplate,
  type TitledItem,
  type DeliverableRow,
  type KeyValue,
  type ComponentRow,
} from "@/lib/proposal-pdf";
import { toast } from "sonner";
import { Area, DeliverablesEditor, Field, Group } from "@/components/forms/fields";

const fieldClass = "h-9 rounded-md border bg-background px-2 text-sm";

const TEMPLATE_OPTIONS: { value: ProposalTemplate; label: string; hint: string }[] = [
  { value: "entrada", label: "Produto de entrada", hint: "Curta — ex.: relatório comportamental" },
  { value: "executiva", label: "Executiva", hint: "Intermediária — soluções e projetos" },
  {
    value: "estrategica",
    label: "Estratégica",
    hint: "Completa — mentorias e consultorias estratégicas",
  },
];

const blankItems = (n: number): TitledItem[] =>
  Array.from({ length: n }, () => ({ title: "", text: "" }));
const blankDeliverables = (n: number): DeliverableRow[] =>
  Array.from({ length: n }, () => ({ name: "", qty: "", criteria: "" }));
const blankKV = (labels: string[]): KeyValue[] => labels.map((label) => ({ label, value: "" }));
const blankComponents = (n: number): ComponentRow[] =>
  Array.from({ length: n }, () => ({ name: "", value: null }));

function defaultsFor(
  template: ProposalTemplate,
  base: Pick<
    ProposalContent,
    | "number"
    | "date"
    | "validUntil"
    | "clientName"
    | "company"
    | "decisionMaker"
    | "price"
    | "payment"
  > & { product: string },
): ProposalContent {
  const common: ProposalContent = {
    number: base.number,
    date: base.date,
    validUntil: base.validUntil,
    clientName: base.clientName,
    company: base.company,
    decisionMaker: base.decisionMaker,
    headline: "",
    program: "",
    subtitle: "",
    introTitle: "",
    intro: "",
    included: [],
    challenges: [],
    stakes: "",
    priority: "",
    objective: "",
    momento: "",
    centralChallenge: "",
    desiredTraits: "",
    objectives: [],
    fronts: [],
    deliverables: [],
    terms: [],
    conditions: "",
    impact: [],
    components: [],
    referencePrice: null,
    price: base.price,
    cash: "",
    installments: "",
    payment: base.payment,
    firstDue: "",
    special: "",
    startCondition: "",
    priceNote: "",
  };

  if (template === "entrada") {
    return {
      ...common,
      headline: "Conhecer seu perfil é o primeiro passo para liderar com mais clareza.",
      program: "Relatório Comportamental com Devolutiva Individual",
      introTitle:
        "A maneira como você se comporta influencia a forma como lidera, decide e se relaciona.",
      intro:
        "Conhecer suas características comportamentais permite identificar forças, reconhecer pontos de atenção e compreender como sua maneira de agir impacta as pessoas e os resultados.\nNa RC360, transformamos essas informações em orientações práticas para seu desenvolvimento pessoal e profissional.",
      included: [
        {
          title: "Relatório comportamental individual",
          text: "Análise de características comportamentais, fatores motivacionais, tendências de atuação, comunicação e relacionamento.",
        },
        {
          title: "Devolutiva personalizada",
          text: "Encontro individual de 60 minutos para interpretação dos resultados e esclarecimento das principais características identificadas.",
        },
        {
          title: "Recomendações práticas",
          text: "Orientações para utilizar suas forças, desenvolver pontos de atenção e aprimorar relacionamentos e decisões.",
        },
      ],
      terms: [
        { label: "Formato", value: "Online" },
        { label: "Participantes", value: "1 pessoa" },
        { label: "Duração da devolutiva", value: "60 minutos" },
      ],
      priceNote:
        "O valor corresponde ao pacote individual com relatório e devolutiva de 60 minutos.",
    };
  }

  if (template === "executiva") {
    return {
      ...common,
      subtitle: "Uma solução prática para transformar prioridades em ações e resultados.",
      challenges: blankItems(3),
      fronts: blankItems(3),
      deliverables: blankDeliverables(4),
      terms: blankKV([
        "Duração",
        "Formato",
        "Encontros",
        "Participantes",
        "Suporte",
        "Início previsto",
      ]),
      impact: blankKV(["Impacto atual a considerar"]),
      components: blankComponents(3),
    };
  }

  return {
    ...common,
    subtitle: "Estratégia, liderança e eficiência para construir resultados sustentáveis.",
    challenges: blankItems(4),
    objectives: blankItems(4),
    fronts: [
      "Estratégia e crescimento",
      "Liderança e comportamento",
      "Eficiência e processos",
      "Experiência do cliente e LTV",
      "Resultados e gestão",
    ].map((title) => ({ title, text: "" })),
    deliverables: blankDeliverables(8),
    terms: blankKV([
      "Duração",
      "Modalidade",
      "Encontros estratégicos",
      "Participantes",
      "Acompanhamento",
      "Suporte",
      "Início previsto",
    ]),
    impact: blankKV([
      "Situação atual",
      "Base de cálculo",
      "Custo estimado ou oportunidade econômica",
      "Horizonte analisado",
    ]),
    components: blankComponents(4),
  };
}

function ItemsEditor({
  items,
  onChange,
  titleLabel,
  textLabel,
}: {
  items: TitledItem[];
  onChange: (items: TitledItem[]) => void;
  titleLabel: string;
  textLabel: string;
}) {
  const update = (index: number, patch: Partial<TitledItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md bg-muted/40 p-2">
          <div className="flex gap-2">
            <Input
              placeholder={titleLabel}
              value={item.title}
              onChange={(e) => update(index, { title: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            rows={2}
            placeholder={textLabel}
            value={item.text}
            onChange={(e) => update(index, { text: e.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, { title: "", text: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}

function KVEditor({ rows, onChange }: { rows: KeyValue[]; onChange: (rows: KeyValue[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map((row, index) => (
        <Field
          key={row.label}
          label={row.label}
          value={row.value}
          onChange={(value) => onChange(rows.map((r, i) => (i === index ? { ...r, value } : r)))}
        />
      ))}
    </div>
  );
}

function ComponentsEditor({
  rows,
  onChange,
}: {
  rows: ComponentRow[];
  onChange: (rows: ComponentRow[]) => void;
}) {
  const update = (index: number, patch: Partial<ComponentRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="Componente"
            value={row.name}
            onChange={(e) => update(index, { name: e.target.value })}
          />
          <Input
            className="w-36"
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor (R$)"
            value={row.value ?? ""}
            onChange={(e) =>
              update(index, { value: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { name: "", value: null }])}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}

interface CatalogProduct {
  id: string;
  name: string;
  template: ProposalTemplate;
  price: number | null;
  audience: string;
  summary: string;
  deliverables: DeliverableRow[];
  format: string;
  participants: string;
  duration: string;
  validityDays: number;
  paymentTerms: string;
  notes: string;
}

const CATALOG_COLUMNS =
  "id,name,template,price,audience,summary,deliverables,format,participants,duration,validity_days,payment_terms,notes";

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Preenche a proposta com os dados cadastrados no produto (tudo editável depois).
function contentFromProduct(
  product: CatalogProduct,
  current: ProposalContent,
  template: ProposalTemplate,
): ProposalContent {
  const content = defaultsFor(template, {
    number: current.number,
    date: current.date,
    validUntil: addDays(current.date, product.validityDays),
    clientName: current.clientName,
    company: current.company,
    decisionMaker: current.decisionMaker,
    price: product.price ?? current.price,
    payment: product.paymentTerms,
    product: product.name,
  });
  const rows = product.deliverables.filter((row) => row.name.trim());
  const fromProduct: Record<string, string> = {
    Duração: product.duration,
    "Duração da devolutiva": product.duration,
    Formato: product.format,
    Modalidade: product.format,
    Participantes: product.participants,
  };
  content.program = product.name;
  if (product.summary.trim()) content.subtitle = product.summary.trim();
  content.terms = content.terms.map((term) => ({
    ...term,
    value: fromProduct[term.label]?.trim() ? fromProduct[term.label]! : term.value,
  }));
  if (template === "entrada") {
    if (rows.length) content.included = rows.map((r) => ({ title: r.name, text: r.criteria }));
    if (product.notes.trim()) content.priceNote = product.notes.trim();
  } else {
    if (rows.length) content.deliverables = rows;
    content.conditions = product.notes.trim();
  }
  return content;
}

export function ProposalDialog({
  opportunity,
  contact,
  onClose,
}: {
  opportunity: { id: string; product: string; value: number } | null;
  contact: { id: string; name: string; company: string; phone: string; email: string };
  onClose: () => void;
}) {
  const { moveOpportunity } = useCRM();
  const [template, setTemplate] = useState<ProposalTemplate>("executiva");
  const [content, setContent] = useState<ProposalContent | null>(null);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [approved, setApproved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productId, setProductId] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // Ao abrir: calcula o próximo número (AAAA-NNN) e carrega os padrões.
  useEffect(() => {
    if (!opportunity) return;
    let cancelled = false;
    setTemplate("executiva");
    setApproved(false);
    setChannel(contact.phone ? "whatsapp" : "email");
    setMessage(
      `Olá ${contact.name.split(" ")[0] ?? contact.name}! Segue a proposta personalizada da RC360 em PDF. Qualquer dúvida, é só chamar.`,
    );
    setProductId("");
    const year = new Date().getFullYear();
    const finish = (count: number, products: CatalogProduct[]) => {
      if (cancelled) return;
      setCatalog(products);
      const base = defaultsFor("executiva", {
        number: `${year}-${String(count + 1).padStart(3, "0")}`,
        date: today,
        validUntil: "",
        clientName: contact.name,
        company: contact.company,
        decisionMaker: contact.name,
        price: opportunity.value,
        payment: "",
        product: opportunity.product,
      });
      const match = products.find((p) => p.name === opportunity.product);
      if (match) {
        setProductId(match.id);
        setTemplate(match.template);
        setContent(contentFromProduct(match, base, match.template));
      } else {
        setContent(base);
      }
    };
    if (!supabase) {
      finish(0, []);
      return () => {
        cancelled = true;
      };
    }
    const client = supabase;
    void (async () => {
      const [{ count }, catalogResult] = await Promise.all([
        client
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${year}-01-01`),
        // Sem a migration do catálogo a consulta falha: segue sem produtos.
        client.from("products").select(CATALOG_COLUMNS).eq("active", true).order("name"),
      ]);
      const products: CatalogProduct[] = catalogResult.error
        ? []
        : (catalogResult.data ?? []).map((row) => ({
            id: row.id as string,
            name: row.name as string,
            template: ((row.template as ProposalTemplate) ?? "executiva") as ProposalTemplate,
            price: row.price === null || row.price === undefined ? null : Number(row.price),
            audience: (row.audience as string) ?? "",
            summary: (row.summary as string) ?? "",
            deliverables: Array.isArray(row.deliverables)
              ? (row.deliverables as DeliverableRow[])
              : [],
            format: (row.format as string) ?? "",
            participants: (row.participants as string) ?? "",
            duration: (row.duration as string) ?? "",
            validityDays: (row.validity_days as number) ?? 15,
            paymentTerms: (row.payment_terms as string) ?? "",
            notes: (row.notes as string) ?? "",
          }));
      finish(count ?? 0, products);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunity?.id]);

  function chooseProduct(id: string) {
    setProductId(id);
    const product = catalog.find((p) => p.id === id);
    if (!product || !content) return;
    setTemplate(product.template);
    setContent(contentFromProduct(product, content, product.template));
  }

  function changeTemplate(next: ProposalTemplate) {
    if (!content || !opportunity) return;
    setTemplate(next);
    const product = catalog.find((p) => p.id === productId);
    if (product) {
      setContent(contentFromProduct(product, content, next));
      return;
    }
    setContent(
      defaultsFor(next, {
        number: content.number,
        date: content.date,
        validUntil: content.validUntil,
        clientName: content.clientName,
        company: content.company,
        decisionMaker: content.decisionMaker,
        price: content.price,
        payment: content.payment,
        product: opportunity.product,
      }),
    );
  }

  const patch = (changes: Partial<ProposalContent>) =>
    setContent((current) => (current ? { ...current, ...changes } : current));

  // Pré-visualização dentro da própria tela (abrir aba nova é barrado por
  // bloqueador de pop-up e pelo navegador embutido).
  async function preview() {
    if (!content) return;
    setBusy("preview");
    try {
      const blob = await buildProposalPdf(template, content);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  function closePreview() {
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
  }

  async function send() {
    if (!supabase || !content || !opportunity) return;
    if (!content.price || content.price <= 0) {
      toast.error("Informe o valor do investimento.");
      return;
    }
    setBusy("send");
    try {
      const blob = await buildProposalPdf(template, content);
      const { data: orgId, error: orgError } = await supabase.rpc("current_organization_id");
      if (orgError || !orgId) throw orgError ?? new Error("Organização não encontrada.");

      const proposalId = crypto.randomUUID();
      const pdfPath = `${orgId}/${opportunity.id}/${proposalId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("proposals")
        .upload(pdfPath, blob, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("proposals").insert({
        id: proposalId,
        opportunity_id: opportunity.id,
        contact_id: contact.id,
        template,
        content,
        total: content.price,
        valid_until: content.validUntil || null,
        pdf_path: pdfPath,
      });
      if (insertError) throw insertError;

      const safeName = (content.clientName || contact.name)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const { error: queueError } = await supabase.rpc("enqueue_automation", {
        p_contact_id: contact.id,
        p_opportunity_id: opportunity.id,
        p_channel: channel,
        p_automation_type: "proposal",
        p_message: message,
        p_subject: channel === "email" ? "Sua proposta RC360" : null,
        p_metadata: {
          proposal_id: proposalId,
          pdf_path: pdfPath,
          pdf_name: `Proposta-RC360-${safeName || content.number}.pdf`,
        },
      });
      if (queueError) throw queueError;

      await moveOpportunity(opportunity.id, "Proposta enviada");
      toast.success("Proposta enviada para a fila e etapa atualizada.");
      onClose();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : typeof reason === "object" && reason && "message" in reason
            ? String((reason as { message: unknown }).message)
            : "Não foi possível enviar a proposta.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Dialog open={opportunity !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Proposta em PDF</DialogTitle>
            <DialogDescription>
              Escolha o modelo, preencha o que for específico deste cliente e confira o PDF antes de
              enviar. Campos em branco não aparecem na proposta.
            </DialogDescription>
          </DialogHeader>

          {!content ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {catalog.length > 0 && (
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Produto (preenche modelo, valor, entregáveis e condições)
                  <select
                    className={fieldClass}
                    value={productId}
                    onChange={(e) => chooseProduct(e.target.value)}
                  >
                    <option value="">Preencher manualmente</option>
                    {catalog.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                        {product.price !== null ? ` — ${formatMoney(product.price)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                {TEMPLATE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeTemplate(option.value)}
                    className={`rounded-md border p-3 text-left text-sm ${
                      template === option.value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                ))}
              </div>

              <Group title="Identificação">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field
                    label="Nome do cliente"
                    value={content.clientName}
                    onChange={(clientName) => patch({ clientName })}
                  />
                  {template !== "entrada" && (
                    <Field
                      label="Empresa"
                      value={content.company}
                      onChange={(company) => patch({ company })}
                    />
                  )}
                  {template === "estrategica" && (
                    <Field
                      label="Aos cuidados de (decisor)"
                      value={content.decisionMaker}
                      onChange={(decisionMaker) => patch({ decisionMaker })}
                    />
                  )}
                  <Field
                    label="Nº da proposta"
                    value={content.number}
                    onChange={(number) => patch({ number })}
                  />
                  <Field
                    label="Validade"
                    type="date"
                    value={content.validUntil}
                    onChange={(validUntil) => patch({ validUntil })}
                  />
                </div>
                <Field
                  label={
                    template === "entrada" ? "Título da capa" : "Headline (frase principal da capa)"
                  }
                  value={content.headline}
                  placeholder="Frase conectada ao principal desafio do cliente"
                  onChange={(headline) => patch({ headline })}
                />
                <Field
                  label={
                    template === "entrada" ? "Produto" : "Nome do produto / programa / projeto"
                  }
                  value={content.program}
                  onChange={(program) => patch({ program })}
                />
                <Field
                  label="Frase de apoio da capa"
                  value={content.subtitle}
                  onChange={(subtitle) => patch({ subtitle })}
                />
              </Group>

              {template === "entrada" && (
                <>
                  <Group title="Abertura">
                    <Field
                      label="Título"
                      value={content.introTitle}
                      onChange={(introTitle) => patch({ introTitle })}
                    />
                    <Area
                      label="Texto"
                      value={content.intro}
                      onChange={(intro) => patch({ intro })}
                      rows={5}
                    />
                  </Group>
                  <Group title="O que está incluído">
                    <ItemsEditor
                      items={content.included}
                      onChange={(included) => patch({ included })}
                      titleLabel="Item"
                      textLabel="Descrição"
                    />
                    <KVEditor rows={content.terms} onChange={(terms) => patch({ terms })} />
                  </Group>
                </>
              )}

              {template !== "entrada" && (
                <Group title={template === "estrategica" ? "Cenário atual" : "Ponto de partida"}>
                  {template === "estrategica" && (
                    <Field
                      label="Momento da empresa (ex.: expansão, reestruturação, profissionalização)"
                      value={content.momento}
                      onChange={(momento) => patch({ momento })}
                    />
                  )}
                  <ItemsEditor
                    items={content.challenges}
                    onChange={(challenges) => patch({ challenges })}
                    titleLabel="Desafio"
                    textLabel="Descrição e impacto relatado"
                  />
                  <Area
                    label={
                      template === "estrategica"
                        ? "O que está em jogo (fatos relatados x hipóteses)"
                        : "Esses desafios merecem atenção porque… (áreas e resultados impactados)"
                    }
                    value={content.stakes}
                    onChange={(stakes) => patch({ stakes })}
                  />
                  {template === "executiva" ? (
                    <Field
                      label="Nossa prioridade (objetivo acordado)"
                      value={content.priority}
                      onChange={(priority) => patch({ priority })}
                    />
                  ) : (
                    <Area
                      label="Desafio central (frase de fechamento)"
                      value={content.centralChallenge}
                      onChange={(centralChallenge) => patch({ centralChallenge })}
                      rows={2}
                    />
                  )}
                </Group>
              )}

              {template === "estrategica" && (
                <Group title="Onde queremos chegar">
                  <Field
                    label="Gestão mais… (características desejadas)"
                    value={content.desiredTraits}
                    onChange={(desiredTraits) => patch({ desiredTraits })}
                  />
                  <ItemsEditor
                    items={content.objectives}
                    onChange={(objectives) => patch({ objectives })}
                    titleLabel="Objetivo"
                    textLabel="Indicador ou evidência de evolução"
                  />
                </Group>
              )}

              {template !== "entrada" && (
                <Group
                  title={
                    template === "estrategica" ? "Frentes de atuação" : "O que vamos desenvolver"
                  }
                >
                  {template === "executiva" && (
                    <Field
                      label="Solução direcionada a… (objetivo central)"
                      value={content.objective}
                      onChange={(objective) => patch({ objective })}
                    />
                  )}
                  {template === "estrategica" && (
                    <p className="text-xs text-muted-foreground">
                      Só entram na proposta as frentes com escopo preenchido.
                    </p>
                  )}
                  <ItemsEditor
                    items={content.fronts}
                    onChange={(fronts) => patch({ fronts })}
                    titleLabel="Frente"
                    textLabel="Atividade prevista e benefício esperado"
                  />
                </Group>
              )}

              {template !== "entrada" && (
                <Group title="Entregáveis e execução">
                  <DeliverablesEditor
                    rows={content.deliverables}
                    onChange={(deliverables) => patch({ deliverables })}
                    withQty={template === "estrategica"}
                  />
                  <KVEditor rows={content.terms} onChange={(terms) => patch({ terms })} />
                  <Area
                    label="Condições específicas negociadas"
                    value={content.conditions}
                    onChange={(conditions) => patch({ conditions })}
                  />
                  <Field
                    label="Início (condição ou data)"
                    value={content.startCondition}
                    onChange={(startCondition) => patch({ startCondition })}
                  />
                </Group>
              )}

              {template !== "entrada" && (
                <Group title="Impacto econômico (opcional)">
                  <KVEditor rows={content.impact} onChange={(impact) => patch({ impact })} />
                </Group>
              )}

              {template !== "entrada" && (
                <Group title="Composição do investimento (opcional)">
                  <p className="text-xs text-muted-foreground">
                    Use somente preços avulsos realmente praticados ou referências documentadas.
                  </p>
                  <ComponentsEditor
                    rows={content.components}
                    onChange={(components) => patch({ components })}
                  />
                </Group>
              )}

              <Group title="Investimento">
                <div className="grid gap-2 sm:grid-cols-2">
                  {template === "entrada" && (
                    <Field
                      label="Valor de referência (opcional)"
                      type="number"
                      value={content.referencePrice?.toString() ?? ""}
                      onChange={(value) => patch({ referencePrice: value ? Number(value) : null })}
                    />
                  )}
                  <Field
                    label="Valor final (R$)"
                    type="number"
                    value={content.price ? String(content.price) : ""}
                    onChange={(value) => patch({ price: value ? Number(value) : 0 })}
                  />
                  <Field
                    label="À vista"
                    value={content.cash}
                    onChange={(cash) => patch({ cash })}
                  />
                  <Field
                    label="Parcelamento (ex.: 6 x R$ 500,00)"
                    value={content.installments}
                    onChange={(installments) => patch({ installments })}
                  />
                  <Field
                    label="Forma de pagamento"
                    value={content.payment}
                    onChange={(payment) => patch({ payment })}
                  />
                  {template === "estrategica" && (
                    <Field
                      label="Primeiro vencimento"
                      value={content.firstDue}
                      onChange={(firstDue) => patch({ firstDue })}
                    />
                  )}
                  <Field
                    label="Condição especial negociada"
                    value={content.special}
                    onChange={(special) => patch({ special })}
                  />
                </div>
                {template === "entrada" && (
                  <Field
                    label="Observação sobre o valor"
                    value={content.priceNote}
                    onChange={(priceNote) => patch({ priceNote })}
                  />
                )}
              </Group>

              <Group title="Envio">
                <select
                  className={fieldClass}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "whatsapp" | "email")}
                >
                  <option value="whatsapp">WhatsApp (PDF como documento)</option>
                  <option value="email">E-mail (PDF em anexo)</option>
                </select>
                <Area label="Mensagem que acompanha o PDF" value={message} onChange={setMessage} />
              </Group>

              <label className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                <span>
                  Revisei o PDF (valores, descontos e escopo negociado) e aprovo o envio ao cliente.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void preview()}
                >
                  {busy === "preview" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Ver PDF
                </Button>
                <Button
                  type="button"
                  disabled={busy !== null || !approved || !message.trim() || !supabase}
                  onClick={() => void send()}
                >
                  {busy === "send" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar proposta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewUrl !== null} onOpenChange={(isOpen) => !isOpen && closePreview()}>
        <DialogContent className="flex h-[90vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da proposta</DialogTitle>
            <DialogDescription>
              Confira valores, descontos e escopo. Feche para voltar e ajustar.
            </DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <>
              <iframe
                title="Pré-visualização da proposta"
                src={previewUrl}
                className="min-h-0 w-full flex-1 rounded-md border"
              />
              <Button asChild variant="outline">
                <a href={previewUrl} download={`Proposta-RC360-${content?.number ?? ""}.pdf`}>
                  <Download className="h-4 w-4" /> Baixar PDF
                </a>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
