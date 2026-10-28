import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import {
  type FieldValues,
  type Path,
  type UseFormProps,
  type UseFormReturn,
  useForm,
} from "react-hook-form";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiError } from "./api";

/** react-hook-form with the shared zod schema as validator. */
export function useZodForm<S extends z.ZodType<FieldValues, any>>(
  schema: S,
  options?: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, "resolver">,
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    ...options,
  });
}

/**
 * Shows a failed request in the form: field issues next to their fields, the
 * rest as a form-level error.
 */
export function applyServerError<T extends FieldValues>(
  form: UseFormReturn<T, any, any>,
  error: unknown,
) {
  if (error instanceof ApiError && error.issues.length > 0) {
    for (const issue of error.issues) {
      form.setError(issue.path as Path<T>, { message: issue.message });
    }
    return;
  }
  form.setError("root" as Path<T>, {
    message: error instanceof Error ? error.message : "Something went wrong",
  });
}

export function FormError({ form }: { form: UseFormReturn<any, any, any> }) {
  const message = form.formState.errors.root?.message;
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {String(message)}
    </p>
  );
}

type FieldProps<T extends FieldValues> = {
  form: UseFormReturn<T, any, any>;
  name: Path<T>;
  label: string;
  hint?: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "form">;

/** `onChange` runs after the form has taken the new value. */
export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  className,
  type,
  onChange,
  ...props
}: FieldProps<T>) {
  const id = useId();
  const error = form.formState.errors[name]?.message;
  const registered = form.register(
    name,
    type === "number" ? { valueAsNumber: true } : undefined,
  );
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        {...props}
        {...registered}
        onChange={async (e) => {
          await registered.onChange(e);
          onChange?.(e);
        }}
      />
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ? String(error) : hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  className,
}: Pick<FieldProps<T>, "form" | "name" | "label" | "hint" | "className">) {
  const id = useId();
  const error = form.formState.errors[name]?.message;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        {...form.register(name)}
      />
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ? String(error) : hint}
        </p>
      )}
    </div>
  );
}
