import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { changeEmailInput, changePasswordInput, updateMeInput } from "../../shared/schemas";
import { LanguageSelect } from "@/components/language-select";
import { PageHeader, Section } from "@/components/page-header";
import { StorageUsage } from "@/components/storage-usage";
import { Button } from "@/components/ui/button";
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

  const changePassword = password.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await unwrap(api.me.password.$put({ json: { currentPassword, newPassword } }));
      password.reset();
      toast.success(t("account.passwordChanged"));
    } catch (error) {
      applyServerError(password, error);
    }
  });

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
          <TextField form={emailForm} name="email" label={t("account.email")} type="email" />
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

      <Section title={t("account.language")} description={t("account.languageHint")}>
        <LanguageSelect automatic />
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
        <form onSubmit={changePassword} className="grid max-w-md gap-4" noValidate>
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
          <div className={share > 0.9 ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${share * 100}%` }} />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {status.quota === null
          ? t("editor.ai.requestsUnlimited", { used: status.usedToday })
          : t("editor.ai.requests", { used: status.usedToday, limit: status.quota })}
      </p>
      <p className="text-sm text-muted-foreground">{t("editor.ai.creditsTitle", { date: status.tokensResetOn })}</p>
    </div>
  );
}
