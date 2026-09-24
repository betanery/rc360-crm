import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, LogOut, Menu, MailWarning, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { shortDate, useCRM } from "@/lib/crm-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/contatos": "Contatos",
  "/pipeline": "Pipeline",
  "/tarefas": "Tarefas",
  "/recuperacoes": "Recuperações",
  "/configuracoes": "Configurações",
};

interface AppHeaderProps {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "RC360 CRM";
  const { user, signOut } = useAuth();
  const { tasks, contacts } = useCRM();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "RC";

  const [failedAutomations, setFailedAutomations] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("automation_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .then(({ count, error }) => {
        if (!error) setFailedAutomations(count ?? 0);
      });
  }, []);

  const overdueTasks = tasks
    .filter((t) => t.status === "Pendente" && new Date(t.dueAt) < new Date())
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const totalNotifications = overdueTasks.length + failedAutomations;

  // Guarda no navegador o que já foi visto, pra bolinha só contar o que
  // é novo desde a última vez que o sino foi aberto — sem isso, ela
  // nunca some mesmo depois de já ter olhado.
  const SEEN_KEY = "rc360_notifications_seen";
  const [seen, setSeen] = useState<{ taskIds: string[]; failedCount: number }>(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      return raw ? JSON.parse(raw) : { taskIds: [], failedCount: 0 };
    } catch {
      return { taskIds: [], failedCount: 0 };
    }
  });

  function markAllAsSeen() {
    const next = { taskIds: overdueTasks.map((t) => t.id), failedCount: failedAutomations };
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // localStorage indisponível (modo privado, etc.) — só não persiste
    }
  }

  const notificationCount =
    overdueTasks.filter((t) => !seen.taskIds.includes(t.id)).length +
    Math.max(0, failedAutomations - seen.failedCount);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {!isSupabaseConfigured && (
          <span className="hidden rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning sm:inline">
            Modo demonstração
          </span>
        )}
        {/* Busca (visual apenas) */}
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar…"
            className="h-9 w-56 rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <Popover onOpenChange={(open) => open && markAllAsSeen()}>
          <PopoverTrigger asChild>
            <button
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="max-h-96 overflow-y-auto">
              {totalNotifications === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Notificações
                    </p>
                    <button
                      onClick={markAllAsSeen}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Marcar tudo como lido
                    </button>
                  </div>
                  {overdueTasks.length > 0 && (
                    <div className="border-b p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {overdueTasks.length} tarefa(s) vencida(s)
                      </p>
                      <div className="space-y-2">
                        {overdueTasks.slice(0, 5).map((task) => (
                          <Link
                            key={task.id}
                            to="/tasks"
                            className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                          >
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {contacts.find((c) => c.id === task.contactId)?.name} ·{" "}
                              {shortDate(task.dueAt)}
                            </p>
                          </Link>
                        ))}
                      </div>
                      {overdueTasks.length > 5 && (
                        <Link
                          to="/tasks"
                          className="mt-1 block px-2 text-xs font-medium text-primary hover:underline"
                        >
                          Ver mais {overdueTasks.length - 5}
                        </Link>
                      )}
                    </div>
                  )}
                  {failedAutomations > 0 && (
                    <div className="p-3">
                      <Link
                        to="/automations"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <MailWarning className="h-4 w-4 shrink-0 text-destructive" />
                        <span>
                          <span className="font-medium">{failedAutomations}</span> automação(ões)
                          com falha de envio
                        </span>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Avatar placeholder */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-label="Perfil do usuário"
        >
          {initials}
        </div>
        {isSupabaseConfigured && (
          <button
            onClick={() => void signOut()}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
