import { NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { useInstance, useLogout, useUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { LegalLinks } from "./auth-layout";

/**
 * Laid out like a hyperbook: brand-colored header, navigation on the left,
 * one content column.
 */
export function Layout() {
  const user = useUser();
  const { data: instance } = useInstance();
  const logout = useLogout();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-4 bg-header px-4 text-header-foreground">
        <NavLink to="/" className="flex-1 truncate font-heading text-xl">
          {instance?.name ?? "Hyperbook Cloud"}
        </NavLink>
        <span className="hidden truncate text-sm sm:inline">
          {user.displayName || user.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-header-foreground hover:bg-white/15 hover:text-header-foreground"
          onClick={logout}
        >
          Log out
        </Button>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Main"
          className="flex shrink-0 flex-col border-sidebar-border bg-sidebar p-4 md:w-64 md:border-r"
        >
          <ul className="flex flex-wrap gap-1 md:flex-col">
            <NavItem to="/">Books</NavItem>
            {user.role === "admin" && (
              <>
                <NavItem to="/users">Users</NavItem>
                {instance?.slugSuffix && <NavItem to="/addresses">Addresses</NavItem>}
                <NavItem to="/instance">Settings</NavItem>
                <NavItem to="/audit">Activity</NavItem>
              </>
            )}
            <NavItem to="/account">Your account</NavItem>
          </ul>
          <BuildInfo />
        </nav>
        <main className="mx-auto w-full max-w-245 min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
      <LegalLinks />
    </div>
  );
}

/** Which version runs, so a report can name it. */
function BuildInfo() {
  const { version, commit, run } = __BUILD__;
  return (
    <p className="mt-auto hidden px-3 pt-4 text-xs text-muted-foreground md:block">
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
    </p>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === "/"}
        className={({ isActive }) =>
          cn(
            "block rounded-md px-3 py-1.5 text-sm hover:text-primary",
            isActive && "font-semibold text-primary",
          )
        }
      >
        {children}
      </NavLink>
    </li>
  );
}
