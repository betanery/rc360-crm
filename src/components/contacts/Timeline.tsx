import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  MousePointerClick,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

interface ActivityRow {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const PAGE = 30;

function describe(row: ActivityRow): { icon: LucideIcon; title: string; detail: string } {
  const action = row.action;
  const details = row.details ?? {};
  const text = (key: string) => (typeof details[key] === "string" ? (details[key] as string) : "");
  const lower = action.toLowerCase();

  if (lower.startsWith("automação") && lower.includes("enviada")) {
    const channel = lower.includes("whatsapp") ? "WhatsApp enviado" : "E-mail enviado";
    return {
      icon: lower.includes("whatsapp") ? MessageCircle : Mail,
      title: channel,
      detail: text("message").slice(0, 120),
    };
  }
  if (lower.includes("aceitou")) {
    return { icon: CheckCircle2, title: action, detail: text("name") };
  }
  if (lower.includes("abriu")) return { icon: Eye, title: action, detail: text("subject") };
  if (lower.includes("clicou")) {
    return { icon: MousePointerClick, title: action, detail: text("url") };
  }
  if (lower.startsWith("mudou para")) {
    return { icon: Repeat, title: action, detail: text("from") ? `de ${text("from")}` : "" };
  }
  if (lower.includes("proposta") || lower.includes("reunião")) {
    return { icon: FileText, title: action, detail: text("program") || text("summary") };
  }
  if (lower.includes("cancelou") || lower.includes("devolvido") || lower.includes("spam")) {
    return { icon: Ban, title: action, detail: "" };
  }
  return { icon: FileText, title: action, detail: "" };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function Timeline({ contactId, refreshKey }: { contactId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [more, setMore] = useState(false);

  async function load(offset: number) {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("id,action,details,created_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    setLoading(false);
    if (error) return;
    const next = (data ?? []) as ActivityRow[];
    setRows((current) => (offset === 0 ? next : [...current, ...next]));
    setMore(next.length === PAGE);
  }

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, refreshKey]);

  if (!supabase) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linha do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ol className="space-y-3">
            {rows.map((row) => {
              const { icon: Icon, title, detail } = describe(row);
              return (
                <li key={row.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                    <p className="text-xs text-muted-foreground">{when(row.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando…" : "Ainda não há histórico para este contato."}
          </p>
        )}
        {more && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            disabled={loading}
            onClick={() => void load(rows.length)}
          >
            Ver mais
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
