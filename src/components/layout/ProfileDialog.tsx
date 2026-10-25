import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Area, Field, Group } from "@/components/forms/fields";
import { useAuth } from "@/lib/auth";
import { useCRM } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

function userInitials(name: string | undefined, email: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (email ?? "RC").slice(0, 2).toUpperCase();
}

export function Avatar({
  url,
  name,
  email,
  className = "h-9 w-9 text-sm",
}: {
  url?: string | undefined;
  name?: string | undefined;
  email?: string | undefined;
  className?: string;
}) {
  return url ? (
    <img src={url} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <div
      className={`${className} flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground`}
    >
      {userInitials(name, email)}
    </div>
  );
}

export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, updateProfile, updatePassword, recovering, clearRecovering } = useAuth();
  const { refresh } = useCRM();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setFullName(profile.fullName);
    setJobTitle(profile.jobTitle);
    setPhone(profile.phone);
    setSignature(profile.signature);
    setPassword("");
    setConfirmation("");
  }, [open, profile]);

  function close() {
    if (recovering) clearRecovering();
    onClose();
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const previousName = profile.fullName.trim();
      const nextName = fullName.trim();
      await updateProfile({ fullName: nextName, jobTitle, phone, signature });
      // O responsável do contato é um texto: acompanha o novo nome.
      if (supabase && previousName && nextName && previousName !== nextName) {
        await supabase
          .from("contacts")
          .update({ owner_name: nextName })
          .eq("owner_name", previousName);
        void refresh();
      }
      toast.success("Perfil salvo.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File | undefined) {
    if (!file || !supabase || !user || !profile) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("A foto pode ter no máximo 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const previous = profile.avatarUrl.split("/avatars/")[1];
      await updateProfile({ avatarUrl: data.publicUrl });
      if (previous) await supabase.storage.from("avatars").remove([previous]);
      toast.success("Foto atualizada.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(password);
      setPassword("");
      setConfirmation("");
      if (recovering) clearRecovering();
      toast.success("Senha alterada.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Não foi possível alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function toggleNotification(key: "overdueTasks" | "failedAutomations", value: boolean) {
    if (!profile) return;
    try {
      await updateProfile({ notificationPrefs: { ...profile.notificationPrefs, [key]: value } });
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Não foi possível salvar a preferência.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            {recovering ? "Defina uma nova senha para continuar usando o CRM." : user?.email}
          </DialogDescription>
        </DialogHeader>

        {!profile ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            {!recovering && (
              <form onSubmit={saveProfile} className="grid gap-4">
                <Group title="Dados">
                  <div className="flex items-center gap-4">
                    <Avatar
                      url={profile.avatarUrl}
                      name={profile.fullName}
                      email={user?.email}
                      className="h-16 w-16 text-lg"
                    />
                    <div className="space-y-1">
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          void uploadAvatar(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInput.current?.click()}
                      >
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        {profile.avatarUrl ? "Trocar foto" : "Enviar foto"}
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 2 MB.</p>
                    </div>
                  </div>
                  <Field label="Nome completo" value={fullName} onChange={setFullName} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Cargo" value={jobTitle} onChange={setJobTitle} />
                    <Field label="Telefone" value={phone} onChange={setPhone} />
                  </div>
                </Group>

                <Group title="Assinatura">
                  <p className="text-xs text-muted-foreground">
                    Aparece no fim da mensagem que acompanha a proposta. Nome e cargo também assinam
                    o PDF.
                  </p>
                  <Area
                    label="Texto da assinatura"
                    value={signature}
                    onChange={setSignature}
                    rows={4}
                  />
                </Group>

                <Button disabled={saving || !fullName.trim()}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar perfil
                </Button>
              </form>
            )}

            <form onSubmit={savePassword}>
              <Group title="Senha">
                <Field
                  label="Nova senha (mínimo 8 caracteres)"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <Field
                  label="Repita a nova senha"
                  type="password"
                  value={confirmation}
                  onChange={setConfirmation}
                />
                <Button variant="outline" disabled={savingPassword || !password}>
                  {savingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  Alterar senha
                </Button>
              </Group>
            </form>

            {!recovering && (
              <Group title="Notificações do sino">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.notificationPrefs.overdueTasks !== false}
                    onChange={(e) => void toggleNotification("overdueTasks", e.target.checked)}
                  />
                  Tarefas atrasadas
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.notificationPrefs.failedAutomations !== false}
                    onChange={(e) => void toggleNotification("failedAutomations", e.target.checked)}
                  />
                  Mensagens que falharam no envio
                </label>
              </Group>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
