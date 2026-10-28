import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { changePasswordInput, updateMeInput } from "../../shared/schemas";
import { PageHeader, Section } from "@/components/page-header";
import { StorageUsage } from "@/components/storage-usage";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { FormError, TextField, applyServerError, useZodForm } from "@/lib/form";
import { useUser } from "@/lib/session";

const passwordSchema = changePasswordInput
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "The passwords do not match",
  });

export function AccountPage() {
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
      toast.success("Saved");
    } catch (error) {
      applyServerError(profile, error);
    }
  });

  const changePassword = password.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await unwrap(api.me.password.$put({ json: { currentPassword, newPassword } }));
      password.reset();
      toast.success("Password changed. Other devices have been logged out.");
    } catch (error) {
      applyServerError(password, error);
    }
  });

  return (
    <>
      <PageHeader title="Your account" description={user.email} />

      <Section title="Profile">
        <form onSubmit={saveProfile} className="grid max-w-md gap-4" noValidate>
          <TextField
            form={profile}
            name="displayName"
            label="Name"
            hint="Shown to other teachers you share books with."
          />
          <FormError form={profile} />
          <div>
            <Button type="submit" disabled={profile.formState.isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Storage">
        <StorageUsage {...user.storage} />
      </Section>
      <Section title="Password">
        <form onSubmit={changePassword} className="grid max-w-md gap-4" noValidate>
          <TextField
            form={password}
            name="currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
          <TextField
            form={password}
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
          />
          <TextField
            form={password}
            name="confirm"
            label="Repeat the new password"
            type="password"
            autoComplete="new-password"
          />
          <FormError form={password} />
          <div>
            <Button type="submit" disabled={password.formState.isSubmitting}>
              Change password
            </Button>
          </div>
        </form>
      </Section>
    </>
  );
}
