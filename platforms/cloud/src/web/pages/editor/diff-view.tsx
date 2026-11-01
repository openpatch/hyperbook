import { cn } from "@/lib/utils";

/*
 * A unified diff, colored line by line, exactly as git writes it — the
 * format the server computes for the AI's proposals and the book's commits.
 */

export function DiffView({
  diff,
  className,
}: {
  diff: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-md border border-border bg-background p-2 text-xs leading-5",
        className,
      )}
    >
      {diff.split("\n").map((line, index) => (
        <div
          key={index}
          className={cn(
            line.startsWith("+") &&
              !line.startsWith("+++") &&
              "bg-green-500/10",
            line.startsWith("-") && !line.startsWith("---") && "bg-red-500/10",
            line.startsWith("@@") && "text-muted-foreground",
          )}
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
