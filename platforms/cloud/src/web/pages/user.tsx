import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { EntitlementsEditor } from "@/components/entitlements-editor";
import { StorageUsage } from "@/components/storage-usage";
import { PageHeader, Section } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, unwrap } from "@/lib/api";
import { useUser } from "@/lib/session";
import { BUILTIN_ENTITLEMENTS } from "./instance";

export function UserPage() {
  const id = useParams().id!;
  const me = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [password, setPassword] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["users", id],
    queryFn: () => unwrap(api.users[":id"].$get({ param: { id } })),
  });
  const { data: settings } = useQuery({
    queryKey: ["instance"],
    queryFn: () => unwrap(api.instance.$get()),
  });

  if (!user || !settings) return null;
  const isMe = user.id === me.id;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const update = async (json: { role?: "admin" | "teacher"; disabled?: boolean }) => {
    try {
      await unwrap(api.users[":id"].$patch({ param: { id }, json }));
      await refresh();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
    }
  };

  return (
    <>
      <PageHeader
        title={user.displayName || user.email}
        description={
          <>
            {user.email} {user.disabled && <Badge variant="outline">{t("users.disabled")}</Badge>}
          </>
        }
      />

      <Section title={t("user.role")}>
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="user-role">{t("user.role")}</Label>
          <Select
            value={user.role}
            disabled={isMe}
            onValueChange={(role) => update({ role: role as "admin" | "teacher" })}
          >
            <SelectTrigger id="user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">{t("users.teacher")}</SelectItem>
              <SelectItem value="admin">{t("users.admin")}</SelectItem>
            </SelectContent>
          </Select>
          {isMe && (
            <p className="text-sm text-muted-foreground">{t("user.roleHint")}</p>
          )}
        </div>
      </Section>

      <Section title={t("user.storage")}>
        <StorageUsage {...user.storage} />
      </Section>
      {user.role === "teacher" && (
        <Section
          title={t("user.entitlements")}
          description={t("user.entitlementsDescription")}
        >
          <EntitlementsEditor
            key={JSON.stringify(user.entitlementOverrides)}
            value={user.entitlementOverrides}
            defaults={{ ...BUILTIN_ENTITLEMENTS, ...settings.defaultEntitlements }}
            onSave={async (json) => {
              try {
                await unwrap(api.users[":id"].entitlements.$put({ param: { id }, json }));
                await refresh();
                toast.success(t("common.saved"));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("common.savingFailed"));
              }
            }}
          />
        </Section>
      )}

      {!isMe && (
        <Section title={t("user.access")}>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton
              variant="default"
              title={t("user.setNewPasswordTitle")}
              description={t("user.setNewPasswordDescription")}
              confirmLabel={t("user.setNewPassword")}
              onConfirm={async () => {
                const res = await unwrap(
                  api.users[":id"].password.$put({ param: { id }, json: {} }),
                );
                setPassword(res.password);
              }}
            >
              {t("user.setNewPassword")}
            </ConfirmButton>
            {user.disabled ? (
              <Button variant="outline" onClick={() => update({ disabled: false })}>
                {t("user.enable")}
              </Button>
            ) : (
              <ConfirmButton
                title={t("user.disableTitle")}
                description={t("user.disableDescription")}
                confirmLabel={t("user.disable")}
                onConfirm={() => update({ disabled: true })}
              >
                {t("user.disable")}
              </ConfirmButton>
            )}
            <ConfirmButton
              title={t("user.deleteTitle")}
              description={t("user.deleteDescription")}
              confirmLabel={t("common.delete")}
              onConfirm={async () => {
                await unwrap(api.users[":id"].$delete({ param: { id } }));
                await refresh();
                navigate("/users");
              }}
            >
              {t("user.delete")}
            </ConfirmButton>
          </div>
        </Section>
      )}

      <SecretDialog
        secret={password}
        title={t("user.newDialogTitle")}
        description={t("user.newDialogDescription", { email: user.email })}
        onClose={() => setPassword(null)}
      />
    </>
  );
}
