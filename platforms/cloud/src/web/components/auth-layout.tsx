import { Link, Outlet } from "react-router";
import { useInstance } from "@/lib/session";

/** Login and password pages: the brand header and one centered card. */
export function AuthLayout() {
  const { data: instance } = useInstance();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center bg-header px-4 text-header-foreground">
        <span className="font-heading text-xl">{instance?.name ?? "Hyperbook Cloud"}</span>
      </header>
      <main className="flex flex-1 items-start justify-center p-4 pt-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
      <LegalLinks />
    </div>
  );
}

export function LegalLinks() {
  const { data: instance } = useInstance();
  if (!instance?.imprintHref && !instance?.privacyHref) return null;
  // The platform's own pages are routes of this app; others are links out.
  const link = (href: string, label: string) =>
    href.startsWith("/") ? (
      <Link to={href} className="hover:text-primary">
        {label}
      </Link>
    ) : (
      <a href={href} className="hover:text-primary">
        {label}
      </a>
    );
  return (
    <footer className="flex justify-center gap-4 p-4 text-sm text-muted-foreground">
      {instance.imprintHref && link(instance.imprintHref, "Imprint")}
      {instance.privacyHref && link(instance.privacyHref, "Privacy")}
    </footer>
  );
}
