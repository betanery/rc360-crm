import { useState } from "react";
import { FileText, Loader2, Save, Sparkles } from "lucide-react";
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
import { Area, Group } from "@/components/forms/fields";
import { useCRM, type Contact, type Task } from "@/lib/crm-data";
import { logActivity } from "@/lib/activity";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const MAX_CHARS = 100_000;
const TASK_TYPES: Task["type"][] = ["Call", "Ligação", "WhatsApp", "E-mail", "Follow-up"];

interface TitledItem {
  title: string;
  text: string;
}
interface Suggestions {
  summary: string;
  contact: {
    company: string;
    mainPain: string;
    marketTime: string;
    teamSize: string;
    referredBy: string;
  };
  opportunity: {
    objections: string[];
    decisionMap: string;
    nextAction: string;
    nextActionDate: string;
  };
  tasks: { title: string; type: Task["type"]; dueDate: string }[];
  proposalDraft: {
    challenges: TitledItem[];
    objectives: TitledItem[];
    stakes: string;
    priority: string;
  };
}

type ContactField = keyof Suggestions["contact"];
const CONTACT_FIELDS: { key: ContactField; label: string }[] = [
  { key: "company", label: "Empresa" },
  { key: "mainPain", label: "Principal dor" },
  { key: "marketTime", label: "Tempo de mercado" },
  { key: "teamSize", label: "Tamanho da equipe" },
  { key: "referredBy", label: "Indicado por" },
];

// Limpa o .vtt do Teams/Meet: tira cabeçalho, numeração e tempos, e deixa
// "Nome: fala" quando a tag de voz existe.
function cleanTranscript(raw: string) {
  const lines: string[] = [];
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    const text = line.trim();
    if (!text || text === "WEBVTT" || text.includes("-->")) continue;
    if (/^NOTE\b/.test(text) || /^[0-9a-f-]{8,}(\/\d+-\d+)?$/i.test(text) || /^\d+$/.test(text)) {
      continue;
    }
    lines.push(text.replace(/<v\s+([^>]+)>/gi, "$1: ").replace(/<\/?[^>]+>/g, ""));
  }
  return lines.join("\n");
}

async function extractMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // corpo não era JSON legível
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

export function MeetingDialog({
  open,
  onClose,
  contact,
  opportunities,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contact: Contact;
  opportunities: { id: string; product: string; nextAction: string; decisionMap: string }[];
  onSaved: () => void;
}) {
  const { updateContact, addOpportunityObjection, updateOpportunityDecisionMap, addTask } =
    useCRM();
  const { updateOpportunityNextAction } = useCRM();
  const [transcript, setTranscript] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);

  // Revisão
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [contactValues, setContactValues] = useState<Record<ContactField, string>>({
    company: "",
    mainPain: "",
    marketTime: "",
    teamSize: "",
    referredBy: "",
  });
  const [contactApply, setContactApply] = useState<Record<ContactField, boolean>>({
    company: false,
    mainPain: false,
    marketTime: false,
    teamSize: false,
    referredBy: false,
  });
  const [objections, setObjections] = useState<{ name: string; apply: boolean }[]>([]);
  const [decisionMap, setDecisionMap] = useState("");
  const [applyDecisionMap, setApplyDecisionMap] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [applyNextAction, setApplyNextAction] = useState(false);
  const [tasks, setTasks] = useState<
    { title: string; type: Task["type"]; dueDate: string; apply: boolean }[]
  >([]);
  const [summary, setSummary] = useState("");
  const [applySummary, setApplySummary] = useState(true);
  const [keepDraft, setKeepDraft] = useState(true);

  const opportunity = opportunities.find((o) => o.id === opportunityId) ?? null;

  function reset() {
    setTranscript("");
    setSugg(null);
    setBusy(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setTranscript(file.name.toLowerCase().endsWith(".vtt") ? cleanTranscript(text) : text);
  }

  async function analyze() {
    if (!supabase) return;
    setBusy("analyze");
    try {
      const { data, error } = await supabase.functions.invoke("crm-meeting-extract", {
        body: { contactId: contact.id, transcript },
      });
      if (error) throw error;
      const result = (data as { suggestions?: Suggestions }).suggestions;
      if (!result) throw new Error("A análise não devolveu sugestões.");
      setSugg(result);

      const opp = opportunities.find((o) => o.id === opportunityId) ?? opportunities[0] ?? null;
      if (opp && !opportunityId) setOpportunityId(opp.id);

      // Só marca por padrão o que hoje está vazio no contato.
      const values = { ...result.contact };
      setContactValues(values);
      setContactApply({
        company: Boolean(values.company) && !contact.company,
        mainPain: Boolean(values.mainPain) && !contact.mainPain,
        marketTime: Boolean(values.marketTime) && !contact.marketTime,
        teamSize: Boolean(values.teamSize) && !contact.teamSize,
        referredBy: Boolean(values.referredBy) && !contact.referredBy,
      });
      setObjections(result.opportunity.objections.map((name) => ({ name, apply: true })));
      setDecisionMap(result.opportunity.decisionMap);
      setApplyDecisionMap(Boolean(result.opportunity.decisionMap) && !opp?.decisionMap);
      setNextAction(result.opportunity.nextAction);
      setNextActionDate(result.opportunity.nextActionDate);
      setApplyNextAction(Boolean(result.opportunity.nextAction));
      setTasks(result.tasks.map((task) => ({ ...task, apply: true })));
      setSummary(result.summary);
      setApplySummary(Boolean(result.summary));
      setKeepDraft(true);
    } catch (reason) {
      toast.error(await extractMessage(reason, "Não foi possível analisar a reunião."));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!supabase || !sugg) return;
    setBusy("save");
    try {
      const changed = CONTACT_FIELDS.filter(
        ({ key }) => contactApply[key] && contactValues[key].trim(),
      );
      if (changed.length) {
        const next = {
          name: contact.name,
          company: contact.company,
          phone: contact.phone,
          email: contact.email,
          instagram: contact.instagram,
          tiktok: contact.tiktok,
          cpf: contact.cpf,
          product: contact.product,
          source: contact.source,
          campaign: contact.campaign,
          owner: contact.owner,
          notes: contact.notes,
          marketTime: contact.marketTime,
          teamSize: contact.teamSize,
          referredBy: contact.referredBy,
          mainPain: contact.mainPain,
          wantsFeedback: contact.wantsFeedback,
        };
        for (const { key } of changed) next[key] = contactValues[key].trim();
        await updateContact(contact.id, next);
      }

      if (opportunityId) {
        for (const item of objections.filter((o) => o.apply && o.name.trim())) {
          await addOpportunityObjection(opportunityId, item.name.trim());
        }
        if (applyDecisionMap && decisionMap.trim()) {
          await updateOpportunityDecisionMap(opportunityId, decisionMap.trim());
        }
        if (applyNextAction && nextAction.trim()) {
          await updateOpportunityNextAction(
            opportunityId,
            nextAction,
            nextActionDate ? new Date(`${nextActionDate}T10:00`).toISOString() : undefined,
          );
        }
      }

      for (const task of tasks.filter((t) => t.apply && t.title.trim())) {
        await addTask({
          contactId: contact.id,
          title: task.title.trim(),
          type: task.type,
          dueAt: new Date(
            `${task.dueDate || new Date().toISOString().slice(0, 10)}T09:00`,
          ).toISOString(),
        });
      }

      if ((applySummary && summary.trim()) || keepDraft) {
        const { error } = await supabase.from("meeting_summaries").insert({
          contact_id: contact.id,
          opportunity_id: opportunityId || null,
          summary: applySummary
            ? summary.trim()
            : "Reunião registrada (apenas rascunho da proposta).",
          proposal_draft: keepDraft ? sugg.proposalDraft : {},
        });
        if (error) throw error;
        await logActivity({
          contactId: contact.id,
          action: "Reunião registrada",
          entityType: "meeting",
          details: { summary: summary.slice(0, 280) },
        });
      }

      toast.success("Dados da reunião salvos.");
      onSaved();
      close();
    } catch (reason) {
      toast.error(await extractMessage(reason, "Não foi possível salvar os dados da reunião."));
    } finally {
      setBusy(null);
    }
  }

  const draft = sugg?.proposalDraft;
  const hasDraft = Boolean(
    draft && (draft.challenges.length || draft.objectives.length || draft.stakes || draft.priority),
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preencher com a transcrição da reunião</DialogTitle>
          <DialogDescription>
            {sugg
              ? "Revise as sugestões. Nada é gravado até você clicar em salvar."
              : "Cole o texto da transcrição ou anexe um arquivo .txt ou .vtt. O texto é analisado por IA e não fica guardado."}
          </DialogDescription>
        </DialogHeader>

        {!sugg ? (
          <div className="grid gap-3">
            <Textarea
              rows={10}
              placeholder="Cole aqui a transcrição da reunião…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <label className="flex cursor-pointer items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Anexar .txt ou .vtt</span>
                <Input
                  type="file"
                  accept=".txt,.vtt,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    void onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className={transcript.length > MAX_CHARS ? "text-destructive" : ""}>
                {transcript.length.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")}{" "}
                caracteres
              </span>
            </div>
            {opportunities.length > 1 && (
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Oportunidade da reunião
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={opportunityId}
                  onChange={(e) => setOpportunityId(e.target.value)}
                >
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.product} — {o.nextAction}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              disabled={
                busy !== null || transcript.trim().length < 80 || transcript.length > MAX_CHARS
              }
              onClick={() => void analyze()}
            >
              {busy === "analyze" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {busy === "analyze" ? "Analisando…" : "Analisar reunião"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <Group title="Dados do contato">
              {CONTACT_FIELDS.map(({ key, label }) => (
                <div key={key} className="grid gap-1">
                  <Check
                    checked={contactApply[key]}
                    onChange={(value) => setContactApply((c) => ({ ...c, [key]: value }))}
                  >
                    <span className="font-medium">{label}</span>
                    {contact[key] ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        hoje: {String(contact[key])}
                      </span>
                    ) : null}
                  </Check>
                  <Input
                    value={contactValues[key]}
                    placeholder="Não mencionado na reunião"
                    onChange={(e) => setContactValues((c) => ({ ...c, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </Group>

            {opportunities.length > 0 && (
              <Group title="Oportunidade">
                {opportunities.length > 1 && (
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={opportunityId}
                    onChange={(e) => setOpportunityId(e.target.value)}
                  >
                    {opportunities.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.product} — {o.nextAction}
                      </option>
                    ))}
                  </select>
                )}
                {objections.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Objeções</p>
                    {objections.map((item, index) => (
                      <Check
                        key={`${item.name}-${index}`}
                        checked={item.apply}
                        onChange={(value) =>
                          setObjections((list) =>
                            list.map((o, i) => (i === index ? { ...o, apply: value } : o)),
                          )
                        }
                      >
                        {item.name}
                      </Check>
                    ))}
                  </div>
                )}
                <Check checked={applyDecisionMap} onChange={setApplyDecisionMap}>
                  <span className="font-medium">Mapa de decisão</span>
                  {opportunity?.decisionMap ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      já existe um texto — marque para substituir
                    </span>
                  ) : null}
                </Check>
                <Area label="" value={decisionMap} onChange={setDecisionMap} />
                <Check checked={applyNextAction} onChange={setApplyNextAction}>
                  <span className="font-medium">Próxima ação</span>
                  {opportunity?.nextAction ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      hoje: {opportunity.nextAction}
                    </span>
                  ) : null}
                </Check>
                <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                  <Input
                    value={nextAction}
                    placeholder="Não combinado na reunião"
                    onChange={(e) => setNextAction(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                  />
                </div>
              </Group>
            )}

            {tasks.length > 0 && (
              <Group title="Tarefas sugeridas">
                {tasks.map((task, index) => (
                  <div key={index} className="grid gap-2 rounded-md bg-muted/40 p-2">
                    <Check
                      checked={task.apply}
                      onChange={(value) =>
                        setTasks((list) =>
                          list.map((t, i) => (i === index ? { ...t, apply: value } : t)),
                        )
                      }
                    >
                      <Input
                        value={task.title}
                        onChange={(e) =>
                          setTasks((list) =>
                            list.map((t, i) => (i === index ? { ...t, title: e.target.value } : t)),
                          )
                        }
                      />
                    </Check>
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={task.type}
                        onChange={(e) =>
                          setTasks((list) =>
                            list.map((t, i) =>
                              i === index ? { ...t, type: e.target.value as Task["type"] } : t,
                            ),
                          )
                        }
                      >
                        {TASK_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <Input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) =>
                          setTasks((list) =>
                            list.map((t, i) =>
                              i === index ? { ...t, dueDate: e.target.value } : t,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </Group>
            )}

            <Group title="Resumo da reunião">
              <Check checked={applySummary} onChange={setApplySummary}>
                Guardar o resumo no contato
              </Check>
              <Area label="" value={summary} onChange={setSummary} rows={5} />
              {hasDraft && (
                <Check checked={keepDraft} onChange={setKeepDraft}>
                  Usar desafios e objetivos como rascunho da próxima proposta
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {draft?.challenges.length ?? 0} desafio(s) · {draft?.objectives.length ?? 0}{" "}
                    objetivo(s)
                  </span>
                </Check>
              )}
            </Group>

            <div className="flex gap-2">
              <Button variant="outline" disabled={busy !== null} onClick={() => setSugg(null)}>
                Voltar
              </Button>
              <Button disabled={busy !== null} onClick={() => void save()}>
                {busy === "save" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar selecionados
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
