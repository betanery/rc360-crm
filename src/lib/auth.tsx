import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  fullName: string;
  role: "admin" | "manager" | "commercial";
  avatarUrl: string;
  jobTitle: string;
  phone: string;
  signature: string;
  notificationPrefs: { overdueTasks?: boolean; failedAutomations?: boolean };
}

interface ProfileDbRow {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  phone?: string | null;
  signature?: string | null;
  notification_prefs?: Profile["notificationPrefs"] | null;
}

export type ProfileChanges = Partial<
  Pick<Profile, "fullName" | "avatarUrl" | "jobTitle" | "phone" | "signature" | "notificationPrefs">
>;

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  recovering: boolean;
  clearRecovering: () => void;
  updateProfile: (changes: ProfileChanges) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);
  const userId = session?.user?.id ?? null;

  async function loadProfile(id: string) {
    if (!supabase) return;
    // Sem a migration de perfil (022) cai para as colunas básicas.
    let { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,role,avatar_url,job_title,phone,signature,notification_prefs")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      const fallback = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", id)
        .maybeSingle();
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error || !data) return;
    const row = data as ProfileDbRow;
    setProfile({
      id: row.id,
      fullName: row.full_name ?? "",
      role: (row.role ?? "commercial") as Profile["role"],
      avatarUrl: row.avatar_url ?? "",
      jobTitle: row.job_title ?? "",
      phone: row.phone ?? "",
      signature: row.signature ?? "",
      notificationPrefs: row.notification_prefs ?? {},
    });
  }

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId);
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      recovering,
      clearRecovering: () => setRecovering(false),
      updateProfile: async (changes) => {
        if (!supabase || !session?.user) return;
        const payload: Record<string, unknown> = {};
        if (changes.fullName !== undefined) payload["full_name"] = changes.fullName.trim();
        if (changes.avatarUrl !== undefined) payload["avatar_url"] = changes.avatarUrl || null;
        if (changes.jobTitle !== undefined) payload["job_title"] = changes.jobTitle.trim() || null;
        if (changes.phone !== undefined) payload["phone"] = changes.phone.trim() || null;
        if (changes.signature !== undefined)
          payload["signature"] = changes.signature.trim() || null;
        if (changes.notificationPrefs !== undefined) {
          payload["notification_prefs"] = changes.notificationPrefs;
        }
        const { error } = await supabase.from("profiles").update(payload).eq("id", session.user.id);
        if (error) throw error;
        await loadProfile(session.user.id);
      },
      updatePassword: async (password) => {
        if (!supabase) return;
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      signIn: async (email, password) => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      resetPassword: async (email) => {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
      },
    }),

    [loading, session, profile, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
