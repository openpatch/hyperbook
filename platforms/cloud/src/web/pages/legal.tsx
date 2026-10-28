import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { useInstance } from "@/lib/session";

type Instance = ReturnType<typeof useInstance>["data"];

/** Where the privacy policy is: an external page, or the platform's own. */
export function privacyHref(instance: Instance) {
  return instance?.privacyHref || "/privacy";
}

const TITLES = { imprint: "Imprint", privacy: "Privacy policy" };

/** The imprint or privacy policy the admin wrote in the settings. */
export function LegalPage({ page }: { page: "imprint" | "privacy" }) {
  const { data, error } = useQuery({
    queryKey: ["legal", page],
    queryFn: () => unwrap(api.instance.public.legal[":page{imprint|privacy}"].$get({ param: { page } })),
    retry: false,
  });
  return (
    <article className="grid gap-4">
      <h1 className="text-2xl">{TITLES[page]}</h1>
      {error && <p className="text-muted-foreground">{error.message}</p>}
      {data && (
        // Rendered and made safe on the server (domain/legal.ts).
        <div
          className="prose-legal grid gap-3 [&_a]:text-primary [&_a]:underline [&_h1]:text-xl [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />
      )}
    </article>
  );
}
