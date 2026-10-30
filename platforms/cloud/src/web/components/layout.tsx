import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { ChevronDownIcon, LogOutIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, type Locale, type MessageKey } from "../../shared/i18n";
import { useLocale, useSetLocale } from "@/i18n";
import { setTheme, useTheme } from "@/lib/theme";
import { useInstance, useLogout, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LegalLinks } from "./auth-layout";

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
        <NavLink
          to="/books"
          className="flex min-w-0 flex-1 items-center gap-3 p-4 font-heading text-[1.1rem] font-bold"
        >
          <img src="/logo.svg" alt="" className="size-8 shrink-0" />
          <span className="truncate">{instance?.name ?? "Hyperbook Cloud"}</span>
        </NavLink>
        <UserMenu />
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
                  <NavItem to="/ai-monitor">{t("nav.aiMonitor")}</NavItem>
                  <NavItem to="/audit">{t("nav.activity")}</NavItem>
                </>
              )}
              <NavItem to="/account">{t("nav.account")}</NavItem>
            </ul>
          </nav>
          <PoweredBy />
        </aside>
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-280 p-4 md:p-8">
            <Outlet />
          </div>
          <LegalLinks />
        </main>
      </div>
    </div>
  );
}

/** Everything that belongs to the signed-in person, behind one menu named after them. */
function UserMenu() {
  const { t } = useTranslation();
  const user = useUser();
  const logout = useLogout();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const theme = useTheme();
  const name = user.displayName || user.email;
  const ThemeIcon = theme === "dark" ? SunIcon : MoonIcon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-0 max-w-64 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-white/15 data-[state=open]:bg-white/15"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-bold uppercase"
          >
            {name.trim().charAt(0)}
          </span>
          <span className="hidden truncate sm:inline">{name}</span>
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/account">
            <UserIcon /> {t("nav.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setTheme(theme === "dark" ? "light" : "dark");
          }}
        >
          <ThemeIcon /> {theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => void setLocale(v as Locale)}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} className="cursor-pointer">
              {t(`common.languages.${l}` as MessageKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={logout}>
          <LogOutIcon /> {t("nav.logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
