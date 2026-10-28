import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
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
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saving failed");
    }
  };

  return (
    <>
      <PageHeader
        title={user.displayName || user.email}
        description={
          <>
            {user.email} {user.disabled && <Badge variant="outline">Disabled</Badge>}
          </>
        }
      />

      <Section title="Role">
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="user-role">Role</Label>
          <Select
            value={user.role}
            disabled={isMe}
            onValueChange={(role) => update({ role: role as "admin" | "teacher" })}
          >
            <SelectTrigger id="user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          {isMe && (
            <p className="text-sm text-muted-foreground">You cannot change your own role.</p>
          )}
        </div>
      </Section>

      <Section title="Storage">
        <StorageUsage {...user.storage} />
      </Section>
      {user.role === "teacher" && (
        <Section
          title="Entitlements"
          description="What this teacher may do beyond the basics. Admins are never limited."
        >
          <EntitlementsEditor
            key={JSON.stringify(user.entitlementOverrides)}
            value={user.entitlementOverrides}
            defaults={{ ...BUILTIN_ENTITLEMENTS, ...settings.defaultEntitlements }}
            onSave={async (json) => {
              try {
                await unwrap(api.users[":id"].entitlements.$put({ param: { id }, json }));
                await refresh();
                toast.success("Saved");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Saving failed");
              }
            }}
          />
        </Section>
      )}

      {!isMe && (
        <Section title="Access">
          <div className="flex flex-wrap gap-2">
            <ConfirmButton
              variant="default"
              title="Set a new password?"
              description="A new password is generated and shown once. The user is logged out everywhere."
              confirmLabel="Set new password"
              onConfirm={async () => {
                const res = await unwrap(
                  api.users[":id"].password.$put({ param: { id }, json: {} }),
                );
                setPassword(res.password);
              }}
            >
              Set new password
            </ConfirmButton>
            {user.disabled ? (
              <Button variant="outline" onClick={() => update({ disabled: false })}>
                Enable account
              </Button>
            ) : (
              <ConfirmButton
                title="Disable this account?"
                description="The user is logged out and cannot log in until the account is enabled again. Their books stay."
                confirmLabel="Disable"
                onConfirm={() => update({ disabled: true })}
              >
                Disable account
              </ConfirmButton>
            )}
            <ConfirmButton
              title="Delete this account?"
              description="This cannot be undone. Books the user owns alone must get another owner first."
              confirmLabel="Delete"
              onConfirm={async () => {
                await unwrap(api.users[":id"].$delete({ param: { id } }));
                await refresh();
                navigate("/users");
              }}
            >
              Delete account
            </ConfirmButton>
          </div>
        </Section>
      )}

      <SecretDialog
        secret={password}
        title="New password"
        description={`The new password for ${user.email} is shown only now.`}
        onClose={() => setPassword(null)}
      />
    </>
  );
}
