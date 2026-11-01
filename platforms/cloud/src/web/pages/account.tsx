import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import {
  changeEmailInput,
  changePasswordInput,
  updateMeInput,
} from "../../shared/schemas";
import { ConfirmButton } from "@/components/confirm-button";
import { LanguageSelect } from "@/components/language-select";
import { PageHeader, Section } from "@/components/page-header";
import { SecretDialog } from "@/components/secret-dialog";
import { StorageUsage } from "@/components/storage-usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useAiStatus, type AiStatus } from "@/lib/ai";
import { useUser } from "@/lib/session";

// The refinement message is a catalog key; lib/form.tsx translates it.
const passwordSchema = changePasswordInput
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "validation.passwordsMismatch",
  });

export function AccountPage() {
  const { t } = useTranslation();
  const user = useUser();
  const ai = useAiStatus();
  const queryClient = useQueryClient();

  const profile = useZodForm(updateMeInput, {
    defaultValues: { displayName: user.displayName },
  });
  const emailForm = useZodForm(changeEmailInput, {
    defaultValues: { email: user.email, currentPassword: "" },
  });
  const password = useZodForm(passwordSchema, {
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const saveProfile = profile.handleSubmit(async (values) => {
    try {
      await unwrap(api.me.$patch({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("account.saved"));
    } catch (error) {
      applyServerError(profile, error);
    }
  });

  const changeEmail = emailForm.handleSubmit(async (values) => {
    try {
      await unwrap(api.me.email.$put({ json: values }));
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      emailForm.reset({ email: values.email, currentPassword: "" });
      toast.success(t("account.emailChanged"));
    } catch (error) {
      applyServerError(emailForm, error);
    }
  });

  const changePassword = password.handleSubmit(
    async ({ currentPassword, newPassword }) => {
      try {
        await unwrap(
          api.me.password.$put({ json: { currentPassword, newPassword } }),
        );
        password.reset();
        toast.success(t("account.passwordChanged"));
      } catch (error) {
        applyServerError(password, error);
      }
    },
  );

  return (
    <>
      <PageHeader title={t("account.title")} description={user.email} />

      <Section title={t("account.profile")}>
        <form onSubmit={saveProfile} className="grid max-w-md gap-4" noValidate>
          <TextField
            form={profile}
            name="displayName"
            label={t("account.name")}
            hint={t("account.nameHint")}
          />
          <FormError form={profile} />
          <div>
            <Button type="submit" disabled={profile.formState.isSubmitting}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Section>

      <Section title={t("account.email")} description={t("account.emailHint")}>
        <form onSubmit={changeEmail} className="grid max-w-md gap-4" noValidate>
          <TextField
            form={emailForm}
            name="email"
            label={t("account.email")}
            type="email"
          />
          <TextField
            form={emailForm}
            name="currentPassword"
            label={t("account.currentPassword")}
            type="password"
          />
          <FormError form={emailForm} />
          <div>
            <Button type="submit" disabled={emailForm.formState.isSubmitting}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Section>

      <Section
        title={t("account.language")}
        description={t("account.languageHint")}
      >
        <LanguageSelect automatic />
      </Section>

      <Section
        title={t("account.git.title")}
        description={t("account.git.hint")}
      >
        <GitTokens />
      </Section>

      <div className="grid gap-x-6 md:grid-cols-2 [&_section]:mb-6">
        <Section title={t("account.storage")}>
          <StorageUsage {...user.storage} />
        </Section>
        {ai.data?.enabled && ai.data.allowed && (
          <Section title={t("account.aiUsage")}>
            <AiUsage status={ai.data} />
          </Section>
        )}
      </div>
      <Section title={t("account.password")}>
        <form
          onSubmit={changePassword}
          className="grid max-w-md gap-4"
          noValidate
        >
          <TextField
            form={password}
            name="currentPassword"
            label={t("account.currentPassword")}
            type="password"
            autoComplete="current-password"
          />
          <TextField
            form={password}
            name="newPassword"
            label={t("account.newPassword")}
            type="password"
            autoComplete="new-password"
            hint={t("account.passwordHint")}
          />
          <TextField
            form={password}
            name="confirm"
            label={t("account.confirm")}
            type="password"
            autoComplete="new-password"
          />
          <FormError form={password} />
          <div>
            <Button type="submit" disabled={password.formState.isSubmitting}>
              {t("account.changePassword")}
            </Button>
          </div>
        </form>
      </Section>
    </>
  );
}

/** Personal git tokens: username git + token works for every book one may edit. */
function GitTokens() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: tokens } = useQuery({
    queryKey: ["me", "git-tokens"],
    queryFn: () => unwrap(api.me["git-tokens"].$get()),
  });
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["me", "git-tokens"] });

  const create = async () => {
    setBusy(true);
    try {
      const res = await unwrap(
        api.me["git-tokens"].$post({ json: { label: label.trim() } }),
      );
      setSecret(res.token);
      setLabel("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("account.git.createTokenFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (tokenId: string) => {
    try {
      await unwrap(
        api.me["git-tokens"][":tokenId"].$delete({ param: { tokenId } }),
      );
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("account.git.revokeFailed"),
      );
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          className="w-56"
          placeholder={t("account.git.tokenLabel")}
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label={t("account.git.tokenLabel")}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void create()}
        >
          <KeyRoundIcon aria-hidden /> {t("account.git.createToken")}
        </Button>
      </div>

      {tokens && tokens.length > 0 && (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{t("account.git.token")}</TableHead>
              <TableHead>{t("account.git.lastUsed")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>
                  {token.label || (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {token.revokedAt !== null && (
                    <Badge variant="outline">{t("account.git.revoked")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {token.lastUsedAt
                    ? new Date(token.lastUsedAt).toLocaleString()
                    : t("common.never")}
                </TableCell>
                <TableCell className="text-right">
                  {token.revokedAt === null && (
                    <ConfirmButton
                      size="sm"
                      title={t("account.git.revokeTitle")}
                      description={t("account.git.revokeDescription")}
                      confirmLabel={t("account.git.revoke")}
                      onConfirm={() => revoke(token.id)}
                    >
                      {t("account.git.revoke")}
                    </ConfirmButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SecretDialog
        secret={secret}
        title={t("account.git.tokenTitle")}
        description={t("account.git.tokenDescription")}
        onClose={() => setSecret(null)}
      />
    </div>
  );
}

/** This week's credits and today's requests, in the same shape as the storage meter. */
function AiUsage({ status }: { status: AiStatus }) {
  const { t } = useTranslation();
  const { tokenQuota: limit, tokensUsedThisWeek: used } = status;
  const share = limit ? Math.min(1, used / limit) : 0;
  return (
    <div className="grid max-w-sm gap-1.5">
      <p>
        {limit !== null
          ? t("editor.ai.credits", {
              left: Math.max(0, limit - used).toLocaleString(),
              limit: limit.toLocaleString(),
            })
          : t("editor.ai.creditsUsed", { used: used.toLocaleString() })}
      </p>
      {limit !== null && limit > 0 && (
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label={t("account.aiUsage")}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
        >
          <div
            className={
              share > 0.9 ? "h-full bg-destructive" : "h-full bg-primary"
            }
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {status.quota === null
          ? t("editor.ai.requestsUnlimited", { used: status.usedToday })
          : t("editor.ai.requests", {
              used: status.usedToday,
              limit: status.quota,
            })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("editor.ai.creditsTitle", { date: status.tokensResetOn })}
      </p>
    </div>
  );
}
