import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { changePasswordInput, updateMeInput } from "../../shared/schemas";
import { LanguageSelect } from "@/components/language-select";
import { PageHeader, Section } from "@/components/page-header";
import { StorageUsage } from "@/components/storage-usage";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
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
  const queryClient = useQueryClient();

  const profile = useZodForm(updateMeInput, {
    defaultValues: { displayName: user.displayName },
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

      <Section title={t("account.language")} description={t("account.languageHint")}>
        <LanguageSelect automatic />
      </Section>

      <Section title={t("account.storage")}>
        <StorageUsage {...user.storage} />
      </Section>
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
