import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { useInstance } from "@/lib/session";
import { LanguageSelect } from "./language-select";
import { ThemeToggle } from "./theme-toggle";

/** Login and password pages: the brand header and one centered card. */
export function AuthLayout() {
  const { data: instance } = useInstance();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-2 bg-header pr-4 text-header-foreground shadow-md">
        <span className="min-w-0 flex-1 truncate p-4 font-heading text-[1.1rem] font-bold">
          {instance?.name ?? "Hyperbook Cloud"}
        </span>
        <LanguageSelect className="text-header-foreground hover:bg-white/15" />
        <ThemeToggle className="hover:bg-white/15" />
      </header>
      <main className="flex flex-1 items-start justify-center p-4 pt-12">
        <div className="w-full max-w-sm">
          <Outlet />
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Power your <b>Hyperbook</b>
          </p>
        </div>
      </main>
      <LegalLinks />
    </div>
  );
}

export function LegalLinks() {
  const { t } = useTranslation();
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
      {instance.imprintHref && link(instance.imprintHref, t("legal.imprint"))}
      {instance.privacyHref && link(instance.privacyHref, t("legal.privacy"))}
    </footer>
  );
}
