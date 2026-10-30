import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { useInstance, useLogout, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LegalLinks } from "./auth-layout";
import { LanguageSelect } from "./language-select";
import { ThemeToggle } from "./theme-toggle";

/**
 * Laid out like a hyperbook: brand-colored header, navigation on the left
 * with "Powered by Hyperbook" at its foot, one content column. The shell fills
 * the viewport and the content scrolls on its own, so the sidebar stays put.
 * Narrow screens get the sidebar as a drawer behind a burger, as books do.
 */
export function Layout() {
  const { t } = useTranslation();
  const user = useUser();
  const { data: instance } = useInstance();
  const logout = useLogout();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  return (
    <div className="flex h-dvh flex-col">
      <header className="z-50 flex h-15 shrink-0 items-center gap-2 bg-header pr-4 text-header-foreground shadow-md">
        <button
          type="button"
          className="ml-4 flex size-10 cursor-pointer flex-col items-center justify-center gap-1.5 lg:hidden"
          aria-label={navOpen ? t("nav.close") : t("nav.open")}
          aria-expanded={navOpen}
          aria-controls="main-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          <span className={cn("h-1 w-7.5 bg-current transition-transform", navOpen && "translate-y-2.5 -rotate-45")} />
          <span className={cn("h-1 w-7.5 bg-current transition-opacity", navOpen && "opacity-0")} />
          <span className={cn("h-1 w-7.5 bg-current transition-transform", navOpen && "-translate-y-2.5 rotate-45")} />
        </button>
        <NavLink to="/books" className="min-w-0 flex-1 truncate p-4 font-heading text-[1.1rem] font-bold">
          {instance?.name ?? "Hyperbook Cloud"}
        </NavLink>
        <span className="hidden truncate text-sm sm:inline">
          {user.displayName || user.email}
        </span>
        <LanguageSelect className="text-header-foreground hover:bg-white/15" />
        <ThemeToggle className="hover:bg-white/15" />
        <Button
          variant="ghost"
          size="sm"
          className="text-header-foreground hover:bg-white/15 hover:text-header-foreground"
          onClick={logout}
        >
          {t("nav.logOut")}
        </Button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        {navOpen && (
          <div className="fixed inset-0 top-15 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} />
        )}
        <aside
          id="main-nav"
          className={cn(
            "fixed top-15 bottom-0 left-0 z-40 flex w-75 max-w-[85vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-[0.9rem] [scrollbar-width:thin] transition-transform",
            "lg:static lg:w-[max(15rem,16%)] lg:max-w-none lg:translate-x-0 lg:transition-none",
            !navOpen && "-translate-x-full",
          )}
        >
          <nav aria-label={t("nav.main")} className="flex-1 p-4">
            <ul>
              <NavItem to="/books">{t("nav.books")}</NavItem>
              {user.role === "admin" && (
                <>
                  <NavItem to="/users">{t("nav.users")}</NavItem>
                  {instance?.slugSuffix && <NavItem to="/addresses">{t("nav.addresses")}</NavItem>}
                  <NavItem to="/instance">{t("nav.settings")}</NavItem>
                  <NavItem to="/audit">{t("nav.activity")}</NavItem>
                </>
              )}
              <NavItem to="/account">{t("nav.account")}</NavItem>
            </ul>
          </nav>
          <PoweredBy />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-280 p-4 md:p-8">
            <Outlet />
          </div>
          <LegalLinks />
        </main>
      </div>
    </div>
  );
}

/** A book's author line, with the cloud's slogan and the version that runs, so a report can name it. */
function PoweredBy() {
  const { version, commit, run } = __BUILD__;
  return (
    <div className="shrink-0 bg-author p-4 text-center text-author-foreground">
      <a href="https://hyperbook.openpatch.org" target="_blank" rel="noreferrer" className="hover:text-primary">
        Power your <b>Hyperbook</b>
      </a>
      <span className="block text-[0.7rem] opacity-60">
        v{version}
        {run && ` · build ${run}`}
        {commit && (
          <>
            {" · "}
            <a
              href={`https://github.com/openpatch/hyperbook/commit/${commit}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-primary"
            >
              {commit.slice(0, 7)}
            </a>
          </>
        )}
      </span>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === "/books"}
        className={({ isActive }) =>
          cn("block p-[0.65rem] hover:bg-border", isActive && "bg-background text-primary hover:bg-background")
        }
      >
        {children}
      </NavLink>
    </li>
  );
}
