import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { cn } from "@/lib/utils";

type Credentials = Awaited<ReturnType<typeof loadCredentials>>;
const loadCredentials = (id: string) =>
  unwrap(api.groups[":id"].credentials.$get({ param: { id } }));

/**
 * Printable credentials: a class list for the teacher (with an empty column
 * for real names) or cut-out cards for the students. Outside the app layout,
 * so the printout is just the sheet.
 */
export function PrintPage() {
  const { t } = useTranslation();
  const id = useParams().id!;
  const [params, setParams] = useSearchParams();
  const layout = params.get("layout") === "list" ? "list" : "cards";
  const { data, error } = useQuery({
    queryKey: ["groups", id, "credentials"],
    queryFn: () => loadCredentials(id),
    // Every view is recorded in the activity log; do not refetch silently.
    staleTime: Infinity,
    refetchOnMount: "always",
  });

  if (error) return <p className="p-8 text-destructive">{error.message}</p>;
  if (!data) return null;

  return (
    <div className="print-sheet min-h-dvh bg-white text-black">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted p-3 print:hidden">
        <Button asChild variant="ghost">
          <Link to={`/groups/${id}`}>{t("print.back")}</Link>
        </Button>
        <div className="flex-1" />
        <div role="group" aria-label={t("print.layout")} className="flex gap-1">
          <Button
            variant={layout === "cards" ? "default" : "outline"}
            aria-pressed={layout === "cards"}
            onClick={() => setParams({ layout: "cards" }, { replace: true })}
          >
            {t("print.cards")}
          </Button>
          <Button
            variant={layout === "list" ? "default" : "outline"}
            aria-pressed={layout === "list"}
            onClick={() => setParams({ layout: "list" }, { replace: true })}
          >
            {t("print.list")}
          </Button>
        </div>
        <Button onClick={() => window.print()}>{t("print.print")}</Button>
      </div>
      <div className="mx-auto max-w-[210mm] p-6 print:max-w-none print:p-0">
        {data.students.length === 0 ? (
          <p>{t("print.noStudents")}</p>
        ) : layout === "list" ? (
          <ClassList data={data} />
        ) : (
          <Cards data={data} />
        )}
      </div>
    </div>
  );
}

function Missing() {
  const { t } = useTranslation();
  return <span className="text-sm italic">{t("print.setNew")}</span>;
}

function ClassList({ data }: { data: Credentials }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl">
        {data.book.title} – {data.group.name}
      </h1>
      <p className="mb-4 text-sm">
        {t("print.loginAt")}{" "}
        <span className="font-mono">{data.loginAddress.replace(/^https?:\/\//, "")}</span>{" "}
        {t("print.loginHint")}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-[40%] py-1 pr-2 font-semibold">{t("print.name")}</th>
            <th className="py-1 pr-2 font-semibold">{t("print.username")}</th>
            <th className="py-1 pr-2 font-semibold">{t("print.password")}</th>
            <th className="py-1 font-semibold">{t("print.qr")}</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.id} className="break-inside-avoid border-b border-black/40">
              <td className="py-1 pr-2" />
              <td className="py-1 pr-2 font-mono">{s.username}</td>
              <td className="py-1 pr-2 font-mono">{s.password ?? <Missing />}</td>
              <td className="py-1">
                {s.loginUrl && (
                  <QrCode value={s.loginUrl} label={t("print.qrFor", { username: s.username })} className="w-[18mm]" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Cards({ data }: { data: Credentials }) {
  const { t } = useTranslation();
  const address = data.loginAddress.replace(/^https?:\/\//, "");
  return (
    <ul className="grid grid-cols-2 gap-[4mm] sm:grid-cols-3">
      {data.students.map((s) => (
        <li
          key={s.id}
          className={cn(
            "flex break-inside-avoid flex-col gap-2 rounded-md border border-dashed border-black p-3",
          )}
        >
          <div className="text-xs leading-tight">
            <div className="font-semibold">{data.book.title}</div>
            <div>{data.group.name}</div>
          </div>
          {s.loginUrl && (
            <QrCode
              value={s.loginUrl}
              label={t("print.qrFor", { username: s.username })}
              className="mx-auto w-[32mm] max-w-full"
            />
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm">
            <dt>{t("print.user")}</dt>
            <dd className="font-mono font-semibold">{s.username}</dd>
            <dt>{t("print.password")}</dt>
            <dd className="font-mono font-semibold">{s.password ?? <Missing />}</dd>
          </dl>
          <div className="mt-1 border-b border-black pb-1 text-xs">{t("print.nameLabel")}</div>
          <div className="truncate text-[10px]">{address}</div>
        </li>
      ))}
    </ul>
  );
}
